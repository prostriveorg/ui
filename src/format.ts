/** `m:ss.t` from milliseconds; negative input reads as zero. */
export function formatClock(ms: number): string {
  const tenths = Math.floor(Math.max(0, ms) / 100);
  const minutes = Math.floor(tenths / 600);
  const seconds = ((tenths % 600) / 10).toFixed(1).padStart(4, '0');
  return `${minutes}:${seconds}`;
}

/** `m:ss` for limits and remaining time. */
export const formatLimit = (ms: number) => formatClock(ms).replace(/\.\d$/, '');

/** Compact numeric label for descriptive signal values in recorded units. */
export const formatSignal = (value: number | null) =>
  value === null
    ? '—'
    : Math.abs(value) >= 100
      ? value.toFixed(0)
      : Number(value.toPrecision(3)).toString();

/** One caption for a signal's units: recorded units, or that none were recorded. Never `raw`. */
export function unitsCaption(units: string) {
  if (units === 'unknown units' || units === 'unknown' || !units) return 'units not recorded';
  if (units === 'relative signal') return 'relative signal';
  return units;
}
