/**
 * Movement-sensor (IMU) sample contract as it arrives in a box sample. Placement is not part of a
 * sample: it comes only from validated source metadata, and is otherwise unknown.
 */
export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];
export type ImuStatus = 'valid' | 'missing' | 'invalid' | 'clipped' | 'frozen';
export interface ImuReading {
  status: ImuStatus;
  raw?: { accel: Vec3; gyro: Vec3; mag: Vec3 };
  orientation?: Quat;
}
/** Movement sensor 0 and 1 of one foot. */
export type ImuPair = [ImuReading, ImuReading];

/** One point of a movement-sensor chart: a bounded relative time and the foot's two readings. */
export interface ImuPoint {
  tMs: number;
  imus?: ImuPair;
  breakBefore?: boolean;
}
export type ImuPoints = Record<'Left' | 'Right', ImuPoint[]>;

export const magnitude = (v: readonly number[]) => Math.hypot(...v);

/** A finite numeric vector of exactly `length` entries. */
export function finiteVector(value: unknown, length: number): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === length &&
    value.every((v) => typeof v === 'number' && Number.isFinite(v))
  );
}

const record = (v: unknown): Record<string, unknown> | null =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

export function readImu(value: unknown): ImuReading {
  if (value == null) return { status: 'missing' };
  const item = record(value);
  if (!item) return { status: 'invalid' };
  const status = item.status ?? 'valid'; // Current sensord shape has no status tag.
  if (status === 'missing' || status === 'invalid') return { status };
  if (!['valid', 'clipped', 'frozen'].includes(String(status))) return { status: 'invalid' };
  const raw = record(item.raw);
  if (
    !raw ||
    !finiteVector(raw.accel, 3) ||
    !finiteVector(raw.gyro, 3) ||
    !finiteVector(raw.mag, 3)
  )
    return { status: 'invalid' };
  const q = item.orientation;
  if (q !== undefined && (!finiteVector(q, 4) || Math.abs(magnitude(q) - 1) > 1e-4))
    return { status: 'invalid' };
  return {
    status: status as ImuStatus,
    raw: { accel: [...raw.accel] as Vec3, gyro: [...raw.gyro] as Vec3, mag: [...raw.mag] as Vec3 },
    ...(q !== undefined ? { orientation: [...(q as number[])] as Quat } : {}),
  };
}

/** A malformed IMU never discards the pressure portion of a live sample. */
export function readImus(value: unknown): ImuPair {
  if (value === undefined) return [{ status: 'missing' }, { status: 'missing' }];
  if (!Array.isArray(value) || value.length !== 2)
    return [{ status: 'invalid' }, { status: 'invalid' }];
  return [readImu(value[0]), readImu(value[1])];
}
