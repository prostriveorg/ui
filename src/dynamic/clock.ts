export interface ClockReading {
  elapsedMs: number;
  remainingMs: number;
  fraction: number;
}

/**
 * Elapsed and remaining recording time from one box-clock anchor (the elapsed time the box
 * reported in its latest control snapshot) and the monotonic local clock since that snapshot.
 * Preview samples are never an input. When the recorder is not confirmed running, the reading
 * holds at the last confirmed anchor.
 */
export function clockReading({
  anchorMs,
  observedAt,
  now,
  maxDurationMs,
  running,
}: {
  anchorMs: number;
  observedAt: number;
  now: number;
  maxDurationMs: number;
  running: boolean;
}): ClockReading {
  const elapsedMs = Math.min(
    maxDurationMs,
    Math.max(0, anchorMs + (running ? Math.max(0, now - observedAt) : 0)),
  );
  const remainingMs = Math.max(0, maxDurationMs - elapsedMs);
  return { elapsedMs, remainingMs, fraction: maxDurationMs > 0 ? elapsedMs / maxDurationMs : 0 };
}
