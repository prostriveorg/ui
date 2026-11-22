import type { Foot } from '@prostriveorg/ui';

/** Deterministic generated box sample envelope (same shape as the box `Sample` message). */
export function sampleFrame(foot: Foot, frame: number) {
  const phase = frame / 15 + (foot === 'Left' ? 0 : Math.PI);
  return {
    foot,
    sample: {
      tick: frame,
      unified_ts_ns: frame * 20_000_000,
      pressure: Array.from({ length: 64 }, (_, index) =>
        Math.round(
          3000 *
            Math.max(0, Math.sin(phase)) *
            Math.exp(-(((index % 8) - 3.5) ** 2) / 8) *
            (0.4 + Math.floor(index / 8) / 12),
        ),
      ),
    },
  };
}
