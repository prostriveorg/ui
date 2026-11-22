import { PRESSURE_SCALE_STOPS } from '../tokens';

/** Visualization scale only, not a sensor validation range or physical unit. */
export const DISPLAY_SIGNAL_MAX = 4095;

const stops = PRESSURE_SCALE_STOPS.map((hex) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)),
);
const colors = Array.from({ length: 256 }, (_, i) => {
  const p = (i / 255) * (stops.length - 1),
    a = Math.floor(p),
    b = Math.min(stops.length - 1, a + 1);
  return stops[a].map((v, k) => Math.round(v + (stops[b][k] - v) * (p - a)));
});

/** Neutral intensity colour of a signal on the fixed display scale, as `[r, g, b]`. */
export const signalRGB = (value: number) =>
  colors[Math.round(Math.max(0, Math.min(1, value / DISPLAY_SIGNAL_MAX)) * 255)];
export const signalColor = (value: number) => `rgb(${signalRGB(value).join(',')})`;

/** Display summaries only: original channel order and uncalibrated signal units. */
export function signalSummary(values: ArrayLike<number> | null) {
  if (!values?.length) return null;
  let total = 0;
  let peak = -Infinity;
  for (let i = 0; i < values.length; i++) {
    total += values[i];
    peak = Math.max(peak, values[i]);
  }
  return { mean: total / values.length, peak, total };
}
