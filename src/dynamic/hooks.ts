import { useEffect, useState } from 'react';

import { clockReading } from './clock';
import type { ClockReading } from './clock';

/** A `performance.now()` value refreshed `hz` times per second; for status text, not samples. */
export function useTick(hz: number) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(performance.now()), 1000 / hz);
    return () => clearInterval(timer);
  }, [hz]);
  return now;
}

/**
 * Elapsed and remaining recording time from one authoritative box-clock anchor (the latest
 * control snapshot). Only the display animates between snapshots, and only while the recorder is
 * confirmed running; preview samples are never an input. Re-renders at most every 100 ms.
 */
export function useRecordingClock({
  anchorMs,
  observedAt,
  maxDurationMs,
  running,
}: {
  /** Box-reported elapsed time at the latest confirmed snapshot; null without a recording. */
  anchorMs: number | null;
  /** Local monotonic time (`performance.now()`) when that snapshot was accepted. */
  observedAt: number | null;
  maxDurationMs: number;
  /** True only while a fresh snapshot confirms the recorder is running. */
  running: boolean;
}): ClockReading | null {
  const [reading, setReading] = useState<ClockReading | null>(null);
  useEffect(() => {
    if (anchorMs === null || observedAt === null) {
      setReading(null);
      return;
    }
    const at = (now: number) => clockReading({ anchorMs, observedAt, now, maxDurationMs, running });
    setReading(at(performance.now()));
    if (!running) return;
    let animation = 0,
      previousTenths = -1;
    function update(now: number) {
      const next = at(now);
      const tenths = Math.floor(next.elapsedMs / 100);
      if (tenths !== previousTenths) {
        previousTenths = tenths;
        setReading(next);
      }
      animation = requestAnimationFrame(update);
    }
    animation = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animation);
  }, [anchorMs, observedAt, running, maxDurationMs]);
  return reading;
}
