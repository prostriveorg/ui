const U64_MAX = 18446744073709551615n;

/**
 * An unsigned 64-bit counter (tick, nanosecond timestamp) as an exact decimal string, or null.
 * Numbers are accepted only while they are safe integers; larger values must arrive as strings,
 * so a box timestamp is never rounded on the way in.
 */
export function exactU64(value: unknown): string | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return String(value);
  if (typeof value === 'string' && /^(0|[1-9]\d{0,19})$/.test(value) && BigInt(value) <= U64_MAX)
    return value;
  return null;
}

/**
 * Milliseconds from `originNs` to `timestampNs`, both exact decimal nanosecond strings. The
 * difference is taken in BigInt and truncated to whole microseconds before it becomes a Number,
 * so the result is exact to 1 µs for any duration below ~285 years. Use it only for bounded
 * relative durations (chart positions, elapsed time); keep the strings for identity and ordering.
 */
export function relativeMs(timestampNs: string, originNs = '0'): number {
  return Number((BigInt(timestampNs) - BigInt(originNs)) / 1000n) / 1000;
}
