/** A sensor insole side. The right insole is the left sensor turned over. */
export type Foot = 'Left' | 'Right';

/** Display order of the two feet everywhere: Left, then Right. */
export const FEET = ['Left', 'Right'] as const satisfies readonly Foot[];
