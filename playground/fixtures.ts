import type { Foot } from '@prostriveorg/ui';
import {
  createPreviewBuffers,
  ingestSample,
  resolveSource,
  SIMULATOR_GENERATOR,
  STRIVE_INSOLE_LAYOUT,
  SYNTHETIC_INSOLE_LAYOUT,
  SYNTHETIC_LAYOUT_ID,
  SYNTHETIC_LAYOUT_SHA256,
  SYNTHETIC_LAYOUT_VERSION,
  SYNTHETIC_MAPPING_ID,
} from '@prostriveorg/ui/dynamic/data';
import type { LiveMarker, PreviewBuffer } from '@prostriveorg/ui/dynamic/data';

/**
 * Generated playground data only. Nothing here is a measurement: pressure is a synthetic stance
 * pattern, movement-sensor values are smooth synthetic curves, timestamps are invented.
 */

export type Scenario =
  | 'receiving'
  | 'mapped'
  | 'gaps'
  | 'waiting'
  | 'stale'
  | 'disconnected'
  | 'missing-foot';

export const SCENARIOS: { value: Scenario; label: string; description: string }[] = [
  {
    value: 'receiving',
    label: 'Receiving · raw',
    description: 'Both feet stream; no source binding, so channels stay in electrical order.',
  },
  {
    value: 'mapped',
    label: 'Mapped · synthetic',
    description:
      'Both feet stream with a generated simulator descriptor resolved by resolveSource().',
  },
  {
    value: 'gaps',
    label: 'Gaps & reset',
    description: 'Dropped samples every 3 s and a counter reset every 7 s break the traces.',
  },
  { value: 'waiting', label: 'Waiting', description: 'Connected; no sample has arrived yet.' },
  {
    value: 'stale',
    label: 'Stale',
    description: 'Both feet stream for 2.5 s, then stop; the preview reads as interrupted.',
  },
  {
    value: 'disconnected',
    label: 'Disconnected',
    description: 'The transport is closed; preview and buffers show no live values.',
  },
  {
    value: 'missing-foot',
    label: 'Missing foot',
    description: 'Only the left foot streams; the right foot never sends a sample.',
  },
];

/** A generated descriptor that passes the simulator validation (layout identity and placement). */
export const generatedDescriptor = {
  version: 1,
  generator: SIMULATOR_GENERATOR,
  modelVersion: 1,
  preset: 'running-heel',
  seed: 20261122,
  variation: 0.5,
  layout: Object.fromEntries(
    (['Left', 'Right'] as const).map((foot) => [
      foot,
      {
        id: SYNTHETIC_LAYOUT_ID,
        version: SYNTHETIC_LAYOUT_VERSION,
        mapping: SYNTHETIC_MAPPING_ID,
        sha256: SYNTHETIC_LAYOUT_SHA256,
      },
    ]),
  ),
  imu: { placement: { Left: ['ankle', 'heel'], Right: ['ankle', 'laces'] } },
};

export const mappedSource = () =>
  resolveSource({ acquisitionMode: 'mock-ble', simulation: generatedDescriptor });

const RATE_HZ = 100;
const STEP_NS = 1_000_000_000n / BigInt(RATE_HZ);
const CYCLE_MS = 700;
/** A large epoch-like origin so exact u64 timestamp handling is exercised. */
export const ORIGIN_NS = 1_763_846_400_000_000_000n;

/** Synthetic per-pad stance load: a blob that travels heel → toe during stance. */
function padLoad(foot: Foot, tMs: number) {
  const phase = ((tMs + (foot === 'Right' ? CYCLE_MS / 2 : 0)) % CYCLE_MS) / CYCLE_MS;
  const stance = phase < 0.55 ? phase / 0.55 : null;
  return STRIVE_INSOLE_LAYOUT.pads.map((pad) => {
    if (stance === null) return 0;
    const centre = 20 + stance * 210;
    const envelope = Math.sin(Math.PI * stance);
    return Math.round(
      3200 *
        envelope *
        Math.exp(-((pad.y - centre) ** 2) / (2 * 38 ** 2)) *
        (0.7 + 0.3 * Math.cos((pad.x - 40) / 30)),
    );
  });
}

/** Raw-mode pattern: a load that sweeps across the electrical channel index. */
function channelLoad(foot: Foot, tMs: number) {
  const phase = ((tMs + (foot === 'Right' ? CYCLE_MS / 2 : 0)) % CYCLE_MS) / CYCLE_MS;
  const stance = phase < 0.55 ? phase / 0.55 : null;
  return Array.from({ length: 64 }, (_, i) =>
    stance === null
      ? 0
      : Math.round(
          3000 *
            Math.sin(Math.PI * stance) *
            Math.exp(-(((i % 8) - 3.5) ** 2) / 8) *
            Math.exp(-((Math.floor(i / 8) - stance * 7) ** 2) / 6),
        ),
  );
}

/** Pad values → electrical channels through the synthetic wiring, as the simulator does. */
function toChannels(pads: number[]) {
  const channels = Array.from({ length: 64 }, () => 0);
  SYNTHETIC_INSOLE_LAYOUT.channelForPad.forEach((channel, pad) => {
    if (channel !== null) channels[channel] = pads[pad];
  });
  return channels;
}

function imu(foot: Foot, tMs: number, sensor: number) {
  const w = (2 * Math.PI) / CYCLE_MS;
  const shift = foot === 'Right' ? Math.PI : 0;
  const a = (k: number) => Math.sin(w * tMs * k + shift + sensor);
  return {
    raw: {
      accel: [3 * a(1), 2 * a(2), 9.81 + 4 * a(1)],
      gyro: [2 * a(1.5), 1.2 * a(1), 0.6 * a(3)],
      mag: [20, 5, -40],
    },
  };
}

export interface Feed {
  buffers: ReturnType<typeof createPreviewBuffers>;
  connected: boolean;
  markers: LiveMarker[];
  startedTsNs: string;
  /** Accepted sample count, for the render-count check. */
  accepted: number;
  stop(): void;
}

/** Starts a generated 100 Hz feed for one scenario, pushing samples straight into the buffers. */
export function startFeed(scenario: Scenario, onMarker: (markers: LiveMarker[]) => void): Feed {
  const buffers = createPreviewBuffers();
  const feed: Feed = {
    buffers,
    connected: scenario !== 'disconnected',
    markers: [],
    startedTsNs: ORIGIN_NS.toString(),
    accepted: 0,
    stop: () => clearInterval(timer),
  };
  const feet: Foot[] =
    scenario === 'missing-foot'
      ? ['Left']
      : scenario === 'waiting' || scenario === 'disconnected'
        ? []
        : ['Left', 'Right'];
  const started = performance.now();
  let index = 0;
  let tick = 0;
  function emit(foot: Foot, tMs: number, receivedAt: number) {
    const pressure =
      scenario === 'mapped' ? toChannels(padLoad(foot, tMs)) : channelLoad(foot, tMs);
    const envelope = {
      foot,
      sample: {
        tickExact: String(tick),
        timestampNsExact: (ORIGIN_NS + BigInt(index) * STEP_NS).toString(),
        pressure,
        imus: [imu(foot, tMs, 0), imu(foot, tMs, 1)],
      },
    };
    if (ingestSample(buffers, envelope, receivedAt) === 'accepted') feed.accepted++;
  }
  const timer = setInterval(() => {
    const now = performance.now();
    const due = Math.floor(((now - started) * RATE_HZ) / 1000);
    while (index < due) {
      const tMs = (index * 1000) / RATE_HZ;
      const dropped = scenario === 'gaps' && tMs % 3000 > 2800;
      if (scenario === 'gaps' && index > 0 && tMs % 7000 === 0) tick = 0;
      const stopped = scenario === 'stale' && tMs > 2500;
      if (!dropped && !stopped) for (const foot of feet) emit(foot, tMs, now);
      if (feet.length && !stopped && index > 0 && index % 400 === 0) {
        feed.markers = [
          ...feed.markers,
          {
            id: `m${index}`,
            label: feed.markers.length % 2 ? 'Turn' : 'Moment',
            timestampNs: (ORIGIN_NS + BigInt(index) * STEP_NS).toString(),
            tMs,
          },
        ];
        onMarker(feed.markers);
      }
      index++;
      tick++;
    }
  }, 20);
  return feed;
}

export type { PreviewBuffer };
