/** Optional recording conditions entered by the operator; shown, never interpreted. */
export interface RecordingConditions {
  speedKmh: number | null;
  inclinePct: number | null;
  footwear: string | null;
}

/** A box-stamped marked moment: exact box timestamp plus a bounded relative time. */
export interface LiveMarker {
  id: string;
  label: string;
  /** Box timestamp in nanoseconds, exact decimal string. */
  timestampNs: string;
  /** Milliseconds since the recording started, as reported by the box. */
  tMs: number;
}
