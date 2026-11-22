import { FEET } from '../foot';
import type { Foot } from '../foot';
import { exactU64, relativeMs } from './exact';
import { readImus } from './imu';
import type { ImuPair, ImuPoints } from './imu';

/**
 * Transport-free live preview: one decoder/validator for box sample envelopes and a bounded,
 * per-foot rolling buffer. The consuming application owns the transport (browser WebSocket,
 * a desktop shell's event channel, …) and calls `ingestSample` for each envelope.
 *
 * The preview is a lossy display copy. It is never the recording, an upload source, or evidence
 * of the recorder's state; the box records every accepted sample separately.
 */

export const PREVIEW_WINDOW_MS = 10_000;
export const PREVIEW_CAPACITY = 1200;
export const STALE_AFTER_MS = 1000;

export interface PreviewPoint {
  foot: Foot;
  /** Exact u64 sample counter. */
  tick: string;
  /** Exact u64 box timestamp in nanoseconds. */
  timestampNs: string;
  /** The 64 original channel values in electrical order, unchanged. */
  pressure: number[];
  /** Consumer-local monotonic arrival time (`performance.now()`), for freshness only. */
  receivedAt: number;
  mean: number;
  /** Largest channel value of this sample; display scaling only. */
  peak: number;
  /** True when the live view broke before this sample (late, reversed, skipped or reset). */
  breakBefore: boolean;
  imus?: ImuPair;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function finite64(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === 64 &&
    value.every((v) => typeof v === 'number' && Number.isFinite(v))
  );
}

/**
 * Validates one box `Sample` envelope (`{ foot, sample: { pressure, tick, unified_ts_ns, imus } }`,
 * with optional exact-string `tickExact`/`timestampNsExact`). Anything malformed returns null;
 * a malformed IMU part never discards the pressure part.
 */
export function parseSample(value: unknown, receivedAt: number): PreviewPoint | null {
  const envelope = record(value);
  const sample = record(envelope?.sample);
  const foot = envelope?.foot;
  if (!sample || (foot !== 'Left' && foot !== 'Right') || !finite64(sample.pressure)) return null;
  const tick = exactU64(sample.tickExact ?? sample.tick);
  const timestampNs = exactU64(sample.timestampNsExact ?? sample.unified_ts_ns);
  if (tick === null || timestampNs === null) return null;
  return {
    foot,
    tick,
    timestampNs,
    pressure: [...sample.pressure],
    receivedAt,
    mean: sample.pressure.reduce((sum, v) => sum + v / 64, 0),
    peak: Math.max(...sample.pressure),
    breakBefore: false,
    imus: readImus(sample.imus),
  };
}

/** What a live chart needs from one foot's preview; implemented by `PreviewBuffer`. */
export interface PreviewSeries {
  readonly latest: PreviewPoint | null;
  /** Accepted samples since the buffer was created or cleared. */
  readonly count: number;
  /** Breaks in the live view since the buffer was created or cleared. */
  readonly gaps: number;
  /** Chronological points received within the last `PREVIEW_WINDOW_MS` before `now`. */
  points(now: number): PreviewPoint[];
}

/** Rolling browser preview only; never used as the recording or upload source. */
export class PreviewBuffer implements PreviewSeries {
  private slots: (PreviewPoint | undefined)[] = Array.from({ length: PREVIEW_CAPACITY });
  private cursor = 0;
  private size = 0;
  latest: PreviewPoint | null = null;
  count = 0;
  /** Breaks in the live view (late, reversed or skipped samples). The box recording is separate. */
  gaps = 0;
  push(point: PreviewPoint): boolean {
    const previous = this.latest;
    if (previous && previous.tick === point.tick && previous.timestampNs === point.timestampNs)
      return false;
    point.breakBefore =
      !!previous &&
      (point.receivedAt - previous.receivedAt > 250 ||
        BigInt(point.tick) <= BigInt(previous.tick) ||
        BigInt(point.timestampNs) - BigInt(previous.timestampNs) > 30_000_000n ||
        BigInt(point.timestampNs) <= BigInt(previous.timestampNs));
    if (point.breakBefore) this.gaps++;
    this.slots[this.cursor] = point;
    this.cursor = (this.cursor + 1) % PREVIEW_CAPACITY;
    this.size = Math.min(this.size + 1, PREVIEW_CAPACITY);
    this.latest = point;
    this.count++;
    return true;
  }
  points(now: number): PreviewPoint[] {
    const result: PreviewPoint[] = [];
    for (let i = 0; i < this.size; i++) {
      const point = this.slots[(this.cursor - this.size + i + PREVIEW_CAPACITY) % PREVIEW_CAPACITY];
      if (point && now - point.receivedAt <= PREVIEW_WINDOW_MS) result.push(point);
    }
    return result;
  }
  clear() {
    this.slots = Array.from({ length: PREVIEW_CAPACITY });
    this.cursor = this.size = this.count = this.gaps = 0;
    this.latest = null;
  }
}

export type PreviewBuffers = Record<Foot, PreviewSeries>;

export function createPreviewBuffers(): Record<Foot, PreviewBuffer> {
  return { Left: new PreviewBuffer(), Right: new PreviewBuffer() };
}

export type SampleOutcome = 'accepted' | 'duplicate' | 'rejected';

/** Decode one envelope and append it to its foot's buffer. */
export function ingestSample(
  buffers: Record<Foot, PreviewBuffer>,
  value: unknown,
  receivedAt: number,
): SampleOutcome {
  const point = parseSample(value, receivedAt);
  if (!point) return 'rejected';
  return buffers[point.foot].push(point) ? 'accepted' : 'duplicate';
}

/**
 * Preview availability, separate from the recorder state. `connected` is the consumer's
 * transport state; `subscribed` (default true) whether it asked the box for samples.
 */
export interface LivePreview {
  buffers: PreviewBuffers;
  connected: boolean;
  subscribed?: boolean;
}

export type PreviewStatus =
  | 'Disconnected'
  | 'Preview off'
  | 'Waiting for samples'
  | 'Stale'
  | 'Receiving';

export function previewStatus(
  buffer: Pick<PreviewSeries, 'latest'>,
  now: number,
  connected: boolean,
  subscribed: boolean,
): PreviewStatus {
  if (!connected) return 'Disconnected';
  if (!subscribed) return 'Preview off';
  if (!buffer.latest) return 'Waiting for samples';
  return now - buffer.latest.receivedAt > STALE_AFTER_MS ? 'Stale' : 'Receiving';
}

export type PreviewKind = 'receiving' | 'interrupted' | 'waiting' | 'disconnected';

/** Maps a preview buffer status to a neutral per-foot state. */
export function previewKind(status: string): PreviewKind {
  if (status === 'Receiving') return 'receiving';
  if (status === 'Stale') return 'interrupted';
  if (status === 'Disconnected') return 'disconnected';
  return 'waiting';
}

export const PREVIEW_LABELS: Readonly<Record<PreviewKind, string>> = Object.freeze({
  receiving: 'Receiving',
  interrupted: 'Preview interrupted',
  waiting: 'Waiting for preview',
  disconnected: 'Preview disconnected',
});

export const footStatus = (preview: LivePreview, foot: Foot, now: number) =>
  previewStatus(preview.buffers[foot], now, preview.connected, preview.subscribed ?? true);

export const isReceiving = (preview: LivePreview, foot: Foot, now: number) =>
  footStatus(preview, foot, now) === 'Receiving';

/** Per-foot preview freshness; independent of recorder state. */
export function previewKinds(preview: LivePreview, now: number): Record<Foot, PreviewKind> {
  return {
    Left: previewKind(footStatus(preview, 'Left', now)),
    Right: previewKind(footStatus(preview, 'Right', now)),
  };
}

/** The foot's latest original channel values while it is receiving; otherwise null. */
export function latestPressure(preview: LivePreview, foot: Foot, now: number): number[] | null {
  return isReceiving(preview, foot, now) ? (preview.buffers[foot].latest?.pressure ?? null) : null;
}

/** Highest single channel value in the window of the receiving feet; 0 when none. */
export function windowPeak(preview: LivePreview, now: number): number {
  let peak = 0;
  for (const foot of FEET)
    if (isReceiving(preview, foot, now))
      for (const point of preview.buffers[foot].points(now)) peak = Math.max(peak, point.peak);
  return peak;
}

/** Movement-sensor chart points of the receiving feet, timed from `originNs` (default 0). */
export function imuPoints(preview: LivePreview, now: number, originNs = '0'): ImuPoints {
  const points = (foot: Foot) =>
    isReceiving(preview, foot, now)
      ? preview.buffers[foot].points(now).map((point) => ({
          tMs: relativeMs(point.timestampNs, originNs),
          imus: point.imus,
          breakBefore: point.breakBefore,
        }))
      : [];
  return { Left: points('Left'), Right: points('Right') };
}

/** Live sample rate from box timestamps in the preview window; never a recording metric. */
export function liveRate(series: PreviewSeries, now: number) {
  const points = series.points(now);
  if (points.length < 2) return null;
  const spanNs = BigInt(points[points.length - 1].timestampNs) - BigInt(points[0].timestampNs);
  return spanNs > 0n ? ((points.length - 1) * 1e9) / Number(spanNs) : null;
}
