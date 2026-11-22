import type { Foot } from './foot';

/** Left and right foot colours shared by every dynamic chart. */
export const FOOT_COLORS: Readonly<Record<Foot, string>> = Object.freeze({
  Left: '#087f78',
  Right: '#c34726',
});

/** Left is solid, Right dashed, so a pair of traces never relies on colour alone. */
export const FOOT_DASH: Readonly<Record<Foot, number[]>> = Object.freeze({
  Left: [] as number[],
  Right: [7, 4],
});

/**
 * Canvas colours. CSS custom properties (`--psui-*` in `styles.css`) cover the DOM; canvases
 * read these constants so a drawing matches its surrounding card. Neutral information colours
 * only: none of them encodes a judgement about the measured person.
 */
export const CHART_COLORS = Object.freeze({
  /** Axis labels and the empty-chart message of the paired signal plot. */
  axisText: '#4f5f6d',
  /** Horizontal grid lines of the paired signal plot. */
  gridLine: '#e2e9ee',
  /** Box-stamped marker line and its label. */
  marker: '#d9480f',
  markerText: '#a33a09',
  /** Movement-sensor chart labels, frames, contact markers and replay cursor. */
  movementText: '#495057',
  movementFrame: '#dee2e6',
  movementMarker: '#adb5bd',
  movementCursor: '#212529',
  /** Raw channel grid: cell without data, cell border, dark value text, no-data message. */
  gridEmpty: '#e9ecef',
  gridCellLine: '#ffffff80',
  gridValueDark: '#152230',
  gridMessage: '#526777',
  /** Signal path on the mapped insole: RGB of the fading trail and the current point. */
  pathRgb: '239,98,58',
  pathPoint: '#f2542d',
});

/** Pressure-intensity colour stops, low to high. A neutral numeric scale. */
export const PRESSURE_SCALE_STOPS = Object.freeze([
  '#e9f0f5',
  '#b4d1e0',
  '#3082be',
  '#18a5a0',
  '#4ebc60',
  '#cdcd38',
  '#f0961e',
  '#e84628',
  '#780c1e',
] as const);
