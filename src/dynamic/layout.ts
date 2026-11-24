import type { Foot } from '../foot';

/**
 * Physical layout of the pressure-sensor insole: where each of the 64 pads sits.
 *
 * The 64 channels arrive in the protocol's electrical order (8 lines × 8 lines, see
 * sensor_core docs/foot-sensor-ble.md §6). That order is NOT a physical grid: the pads sit in
 * 18 rows of 2–5 pads. Which channel belongs to which pad is only known once a press test has
 * been run on a real insole; until then `channelForPad` is all `null`.
 *
 * Coordinates are millimetres for the LEFT insole seen from above (foot side): origin at the
 * outer (lateral) edge and the heel end, +x toward the inner (medial) side, +y toward the toes.
 * The right insole is the same sensor turned over, so it has the same channels with x mirrored.
 */
export interface InsolePad {
  /** 1–64, numbered heel → toe, then outer → inner side within a row. */
  pad: number;
  /** Physical row, 1 (heel) – 18 (toes). */
  row: number;
  x: number;
  y: number;
}

export interface SensorInsoleLayout {
  id: string;
  version: number;
  /** Where the geometry came from and how accurate it is. */
  source: string;
  width: number;
  length: number;
  /** Square pad edge length. */
  padSize: number;
  /** Closed outline, left insole, without the cable tail. */
  outline: readonly (readonly [number, number])[];
  pads: readonly InsolePad[];
  /** Index `pad - 1` → protocol channel 0–63, or null while not yet mapped. */
  channelForPad: readonly (number | null)[];
}

/** The hardware insole geometry. Frozen: its channel mapping stays unknown (all null) until confirmed. */
export const STRIVE_INSOLE_LAYOUT: SensorInsoleLayout = Object.freeze<SensorInsoleLayout>({
  id: 'strive-sensor-insole-size-1',
  version: 1,
  source:
    'Traced from the vendor drawing image (2026-11-03), about ±1 mm. No vector source exists.',
  width: 94.2,
  length: 256.5,
  padSize: 9,
  outline: [
    [34, 0],
    [26.8, 1.6],
    [23.1, 3.2],
    [18.3, 6.4],
    [14.9, 9.6],
    [11.4, 14.3],
    [8.2, 22.3],
    [7.2, 28.7],
    [7.2, 82.9],
    [6.9, 95.6],
    [6.1, 105.2],
    [2.1, 127.5],
    [0.5, 138.7],
    [0, 146.6],
    [0, 165.8],
    [0.5, 172.1],
    [3.2, 189.7],
    [7.4, 204],
    [10.6, 212],
    [13.8, 218.4],
    [18.6, 226.3],
    [27.1, 237.5],
    [32.9, 243.9],
    [38.3, 248.7],
    [45.2, 253.4],
    [49.1, 255],
    [57.4, 256.6],
    [64.6, 256.6],
    [71.2, 255],
    [74.9, 253.4],
    [82.4, 248.7],
    [87.9, 242.3],
    [90.9, 235.9],
    [92.4, 229.5],
    [94, 213.6],
    [93.8, 197.6],
    [93, 189.7],
    [91.1, 178.5],
    [87.7, 165.8],
    [85.3, 159.4],
    [82.1, 153],
    [75.4, 137.1],
    [70.4, 121.1],
    [68.5, 113.2],
    [66.9, 92.4],
    [66.7, 82.9],
    [66.9, 30.3],
    [66.7, 27.1],
    [65.1, 19.1],
    [63, 14.3],
    [60.6, 11.2],
    [55.5, 6.4],
    [50.7, 3.2],
    [47.3, 1.6],
    [40.6, 0],
  ],
  pads: [
    { pad: 1, row: 1, x: 30.4, y: 16.5 },
    { pad: 2, row: 1, x: 43.4, y: 16.5 },
    { pad: 3, row: 2, x: 23.8, y: 29.7 },
    { pad: 4, row: 2, x: 37.2, y: 29.8 },
    { pad: 5, row: 2, x: 50.1, y: 29.8 },
    { pad: 6, row: 3, x: 23.8, y: 42.8 },
    { pad: 7, row: 3, x: 37.2, y: 42.8 },
    { pad: 8, row: 3, x: 50.2, y: 42.7 },
    { pad: 9, row: 4, x: 23.8, y: 55.6 },
    { pad: 10, row: 4, x: 37.4, y: 55.7 },
    { pad: 11, row: 4, x: 50.2, y: 55.6 },
    { pad: 12, row: 5, x: 23.9, y: 69.1 },
    { pad: 13, row: 5, x: 36.8, y: 69.1 },
    { pad: 14, row: 5, x: 50.1, y: 69 },
    { pad: 15, row: 6, x: 23.9, y: 81.8 },
    { pad: 16, row: 6, x: 36.8, y: 81.7 },
    { pad: 17, row: 6, x: 50.2, y: 81.7 },
    { pad: 18, row: 7, x: 23.6, y: 94.9 },
    { pad: 19, row: 7, x: 36.7, y: 94.9 },
    { pad: 20, row: 7, x: 50.2, y: 94.9 },
    { pad: 21, row: 8, x: 23.5, y: 108.1 },
    { pad: 22, row: 8, x: 36.9, y: 108.1 },
    { pad: 23, row: 8, x: 50, y: 108.2 },
    { pad: 24, row: 9, x: 20.2, y: 120.9 },
    { pad: 25, row: 9, x: 36.7, y: 120.9 },
    { pad: 26, row: 9, x: 52.8, y: 120.9 },
    { pad: 27, row: 10, x: 21, y: 134.3 },
    { pad: 28, row: 10, x: 37.4, y: 134.3 },
    { pad: 29, row: 10, x: 53.1, y: 134.3 },
    { pad: 30, row: 11, x: 16.9, y: 147.3 },
    { pad: 31, row: 11, x: 29.7, y: 147.3 },
    { pad: 32, row: 11, x: 42.8, y: 147.3 },
    { pad: 33, row: 11, x: 56.3, y: 147.3 },
    { pad: 34, row: 12, x: 20.7, y: 160.2 },
    { pad: 35, row: 12, x: 34.8, y: 160.3 },
    { pad: 36, row: 12, x: 49.5, y: 160.2 },
    { pad: 37, row: 12, x: 63.9, y: 160.3 },
    { pad: 38, row: 13, x: 16.3, y: 173.2 },
    { pad: 39, row: 13, x: 29.6, y: 173.4 },
    { pad: 40, row: 13, x: 42.7, y: 173.2 },
    { pad: 41, row: 13, x: 56.1, y: 173.2 },
    { pad: 42, row: 13, x: 68.9, y: 173.2 },
    { pad: 43, row: 14, x: 19.6, y: 186.7 },
    { pad: 44, row: 14, x: 32.8, y: 186.7 },
    { pad: 45, row: 14, x: 46.1, y: 186.7 },
    { pad: 46, row: 14, x: 59.2, y: 186.7 },
    { pad: 47, row: 14, x: 72.2, y: 186.7 },
    { pad: 48, row: 15, x: 23, y: 199.6 },
    { pad: 49, row: 15, x: 35.9, y: 199.6 },
    { pad: 50, row: 15, x: 49, y: 199.6 },
    { pad: 51, row: 15, x: 62.2, y: 199.6 },
    { pad: 52, row: 15, x: 75.5, y: 199.6 },
    { pad: 53, row: 16, x: 27.3, y: 212.5 },
    { pad: 54, row: 16, x: 40.3, y: 212.5 },
    { pad: 55, row: 16, x: 53.9, y: 212.6 },
    { pad: 56, row: 16, x: 66.7, y: 212.6 },
    { pad: 57, row: 16, x: 79.6, y: 212.5 },
    { pad: 58, row: 17, x: 36.3, y: 225.7 },
    { pad: 59, row: 17, x: 49.5, y: 225.7 },
    { pad: 60, row: 17, x: 62.6, y: 225.7 },
    { pad: 61, row: 17, x: 75.9, y: 225.7 },
    { pad: 62, row: 18, x: 46, y: 238.5 },
    { pad: 63, row: 18, x: 59, y: 238.5 },
    { pad: 64, row: 18, x: 72.5, y: 238.4 },
  ],
  channelForPad: Object.freeze(Array.from({ length: 64 }, () => null)),
});

/**
 * Hardware channel mapping from the vendor drawing labels (A1–H8), used by the native
 * technician view. This is the live hardware layout; it is not a source binding and does not
 * change the recorded provenance.
 */
export const HARDWARE_INSOLE_LAYOUT: SensorInsoleLayout = Object.freeze<SensorInsoleLayout>({
  ...STRIVE_INSOLE_LAYOUT,
  source:
    'Pad centres traced from the vendor drawing; channel mapping from the vendor drawing labels.',
  channelForPad: Object.freeze([
    56, 57, 48, 58, 59, 49, 50, 60, 40, 51, 61, 41, 52, 62, 42, 53, 63, 43, 54, 55, 44, 45, 46, 32,
    33, 47, 24, 34, 35, 16, 25, 26, 36, 8, 17, 27, 37, 0, 9, 18, 28, 38, 1, 10, 19, 29, 39, 2, 11,
    20, 30, 31, 3, 12, 21, 22, 23, 4, 13, 14, 15, 5, 6, 7,
  ]),
});

/** Weighted pressure centroid in the layout's foot-side coordinates; null for no pressure. */
export function pressureCentroid(
  layout: SensorInsoleLayout,
  values: readonly (number | null)[],
  foot: Foot,
): { x: number; y: number } | null {
  let total = 0;
  let x = 0;
  let y = 0;
  layout.pads.forEach((pad, index) => {
    const value = Math.max(0, values[index] ?? 0);
    total += value;
    x += pad.x * value;
    y += pad.y * value;
  });
  if (total <= 0) return null;
  return {
    x: foot === 'Right' ? layout.width - x / total : x / total,
    y: y / total,
  };
}

/** Mirror an x coordinate for the right foot; the right insole is the left sensor turned over. */
export function footX(layout: SensorInsoleLayout, x: number, foot: Foot) {
  return foot === 'Right' ? layout.width - x : x;
}

export function padPosition(layout: SensorInsoleLayout, pad: InsolePad, foot: Foot) {
  return { x: footX(layout, pad.x, foot), y: pad.y };
}

export function outlineFor(layout: SensorInsoleLayout, foot: Foot) {
  return layout.outline.map(([x, y]) => [footX(layout, x, foot), y] as const);
}

/** True only when every pad has a distinct channel 0–63. */
export function isFullyMapped(layout: SensorInsoleLayout) {
  const channels = layout.channelForPad;
  return (
    channels.length === layout.pads.length &&
    channels.every((channel) => channel !== null) &&
    new Set(channels).size === channels.length
  );
}

/** Per-pad values in pad order, or null for pads without a known channel. */
export function padValues(layout: SensorInsoleLayout, channels: ArrayLike<number>) {
  return layout.channelForPad.map((channel) =>
    channel === null || channel >= channels.length ? null : channels[channel],
  );
}
