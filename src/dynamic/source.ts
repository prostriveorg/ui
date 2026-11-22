import type { Foot } from '../foot';
import type { SourceLayoutReference } from './geometry';
import { STRIVE_INSOLE_LAYOUT } from './layout';
import type { SensorInsoleLayout } from './layout';

/**
 * Synthetic layout for box-simulator recordings only.
 *
 * The pad centres are the approximate vendor trace in `STRIVE_INSOLE_LAYOUT`; the channel wiring
 * is invented by sensor_core's simulator (`crates/core/src/devices/sim/layout.rs`) and is NOT
 * the hardware mapping, which stays unknown (`channelForPad` null) until a press test. This copy
 * is pinned to the simulator's by `SYNTHETIC_LAYOUT_SHA256`; a recording is drawn with it only
 * when its validated source descriptor names exactly this id, version, wiring and hash.
 */
export const SYNTHETIC_LAYOUT_ID = 'prostrive-synthetic-insole';
export const SYNTHETIC_LAYOUT_VERSION = 1;
export const SYNTHETIC_MAPPING_ID = 'synthetic-wiring-v1';
export const SYNTHETIC_LAYOUT_SHA256 =
  '68bcd1690379c3665683230d4e2d5b0afa509d746f5ea589b465bf55ecb6897f';
export const SIMULATOR_GENERATOR = 'prostrive-sensord-mock-runner';

export const SYNTHETIC_INSOLE_LAYOUT: SensorInsoleLayout = Object.freeze({
  ...STRIVE_INSOLE_LAYOUT,
  id: SYNTHETIC_LAYOUT_ID,
  version: SYNTHETIC_LAYOUT_VERSION,
  source:
    'Synthetic wiring for generated box-simulator data; pad centres from the vendor trace (±1 mm). Not the hardware channel mapping.',
  // Same bijection as the simulator: channel = (7·(pad − 1) + 3) mod 64.
  channelForPad: Object.freeze(STRIVE_INSOLE_LAYOUT.pads.map((_, i) => (7 * i + 3) % 64)),
});

/** Integer-only canonical text, identical to the simulator's `layout::canonical()`. */
export function syntheticLayoutCanonical(layout: SensorInsoleLayout) {
  const pads = layout.pads
    .map(
      (pad, i) =>
        `${pad.pad}:${pad.row}:${Math.round(pad.x * 10)}:${Math.round(pad.y * 10)}:${layout.channelForPad[i]}`,
    )
    .join(';');
  return `${layout.id}@${layout.version};${SYNTHETIC_MAPPING_ID};pad=${Math.round(layout.padSize * 10)};mirror=right-x;${pads}`;
}

export const SIMULATOR_PRESETS = [
  'unloaded',
  'standing',
  'running-heel',
  'running-forefoot',
  'running-differences',
  'treadmill-sequence',
] as const;
export type SimulatorPreset = (typeof SIMULATOR_PRESETS)[number];
export type ShoePlacement = 'heel' | 'laces';

/** The validated part of a simulator descriptor the app relies on. */
export interface SimulationSource {
  generator: typeof SIMULATOR_GENERATOR;
  modelVersion: number;
  preset: SimulatorPreset;
  seed: number;
  variation: number;
  /** IMU 0 is always the ankle; IMU 1 is clipped at the heel or on the laces. */
  placement: Record<Foot, ['ankle', ShoePlacement]>;
  /** Nominal configured gait, for clearly labelled developer diagnostics only. */
  configured: { cadenceSpm: number; contactMs: number } | null;
}

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const finite = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

function layoutMatches(value: unknown) {
  const v = record(value);
  return (
    !!v &&
    v.id === SYNTHETIC_LAYOUT_ID &&
    v.version === SYNTHETIC_LAYOUT_VERSION &&
    v.mapping === SYNTHETIC_MAPPING_ID &&
    v.sha256 === SYNTHETIC_LAYOUT_SHA256
  );
}

/**
 * Bounded validation of a live or frozen simulator descriptor. Unknown generators/versions,
 * a different layout identity or malformed placement return null, so the app falls back to raw
 * indexed channels and unknown placement.
 */
export function readSimulation(value: unknown): SimulationSource | null {
  const v = record(value);
  if (
    !v ||
    v.version !== 1 ||
    v.generator !== SIMULATOR_GENERATOR ||
    v.modelVersion !== 1 ||
    !SIMULATOR_PRESETS.includes(v.preset as SimulatorPreset) ||
    !Number.isInteger(v.seed) ||
    !finite(v.seed, 0, 0xffffffff) ||
    !finite(v.variation, 0, 2)
  )
    return null;
  const layout = record(v.layout);
  if (!layout || !layoutMatches(layout.Left) || !layoutMatches(layout.Right)) return null;
  const placementSource = record(record(v.imu)?.placement) ?? record(v.imuPlacement);
  const placement = {} as SimulationSource['placement'];
  for (const foot of ['Left', 'Right'] as const) {
    const pair = placementSource?.[foot];
    if (
      !Array.isArray(pair) ||
      pair.length !== 2 ||
      pair[0] !== 'ankle' ||
      (pair[1] !== 'heel' && pair[1] !== 'laces')
    )
      return null;
    placement[foot] = ['ankle', pair[1]];
  }
  const gait = record(record(v.settings)?.gait);
  return {
    generator: SIMULATOR_GENERATOR,
    modelVersion: v.modelVersion as number,
    preset: v.preset as SimulatorPreset,
    seed: v.seed as number,
    variation: v.variation as number,
    placement,
    configured:
      gait && finite(gait.cadenceSpm, 1, 400) && finite(gait.contactMs, 1, 2000)
        ? { cadenceSpm: gait.cadenceSpm, contactMs: gait.contactMs }
        : null,
  };
}

/**
 * A spatial layout that a source explicitly binds to, with the source's own layout reference.
 * Obtain it only from `resolveSource`: components check that the object came from there, so a
 * hand-built or cast object (for example real hardware data paired with the synthetic layout)
 * is ignored and the raw electrical-order channels are shown instead.
 */
export interface ResolvedSource {
  readonly layout: SensorInsoleLayout;
  readonly reference: SourceLayoutReference;
  readonly simulation: SimulationSource;
}

const resolved = new WeakSet<object>();

/** True only for an object returned by `resolveSource` in this library instance. */
export function isResolvedSource(value: unknown): value is ResolvedSource {
  return typeof value === 'object' && value !== null && resolved.has(value);
}

/** The source binding to honour: a genuine `resolveSource` result, otherwise null. */
export const boundSource = (value: ResolvedSource | null | undefined): ResolvedSource | null =>
  isResolvedSource(value) ? value : null;

/**
 * The layout a source explicitly binds to. Only a mock-ble source with a valid simulator
 * descriptor resolves; real BLE (`bluez`), legacy recordings and fixtures never do, regardless
 * of any descriptor-shaped data they carry.
 */
export function resolveSource(
  source:
    | { acquisitionMode?: unknown; simulation?: unknown; [key: string]: unknown }
    | null
    | undefined,
): ResolvedSource | null {
  if (!source || source.acquisitionMode !== 'mock-ble') return null;
  const simulation = readSimulation(source.simulation);
  if (!simulation) return null;
  const result: ResolvedSource = Object.freeze({
    layout: SYNTHETIC_INSOLE_LAYOUT,
    reference: Object.freeze({ id: SYNTHETIC_LAYOUT_ID, version: SYNTHETIC_LAYOUT_VERSION }),
    simulation: Object.freeze(simulation),
  });
  resolved.add(result);
  return result;
}

export const placementLabel = (placement: ShoePlacement | 'ankle') =>
  placement === 'ankle' ? 'ankle' : placement === 'heel' ? 'back of heel' : 'laces';
