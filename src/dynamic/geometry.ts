import { isFullyMapped, padValues } from './layout';
import type { SensorInsoleLayout } from './layout';

/** A reference supplied by the source, never inferred from the current default layout. */
export interface SourceLayoutReference {
  id: string;
  version: number;
}

export function geometryState(layout: SensorInsoleLayout, source?: SourceLayoutReference) {
  if (
    !isFullyMapped(layout) ||
    layout.channelForPad.length !== 64 ||
    !layout.channelForPad.every(
      (channel) => Number.isInteger(channel) && channel !== null && channel >= 0 && channel < 64,
    )
  )
    return 'unmapped';
  if (!source || source.id !== layout.id || source.version !== layout.version) return 'unbound';
  return 'ready';
}

/** No spatial values until the complete mapping AND the source's immutable layout reference match. */
export function mappedPressureValues(
  layout: SensorInsoleLayout,
  source: SourceLayoutReference | undefined,
  channels: ArrayLike<number> | null,
) {
  if (geometryState(layout, source) !== 'ready' || !channels || channels.length !== 64) return null;
  return padValues(layout, channels);
}
