/**
 * `@prostriveorg/ui/dynamic/data`: the React-free part of the live dynamic-analysis UI. Safe to
 * import from Node tests, workers and non-UI adapter code. Everything here is also re-exported
 * from `@prostriveorg/ui/dynamic`.
 */
export { FEET } from '../foot';
export type { Foot } from '../foot';
export { formatClock, formatLimit, formatSignal, unitsCaption } from '../format';

export { exactU64, relativeMs } from './exact';
export { finiteVector, magnitude, readImu, readImus } from './imu';
export type { ImuPair, ImuPoint, ImuPoints, ImuReading, ImuStatus, Quat, Vec3 } from './imu';

export {
  createPreviewBuffers,
  footStatus,
  imuPoints,
  ingestSample,
  isReceiving,
  latestPressure,
  liveRate,
  parseSample,
  PREVIEW_CAPACITY,
  PREVIEW_LABELS,
  PREVIEW_WINDOW_MS,
  PreviewBuffer,
  previewKind,
  previewKinds,
  previewStatus,
  STALE_AFTER_MS,
  windowPeak,
} from './preview';
export type {
  LivePreview,
  PreviewBuffers,
  PreviewKind,
  PreviewPoint,
  PreviewSeries,
  PreviewStatus,
  SampleOutcome,
} from './preview';

export {
  footX,
  HARDWARE_INSOLE_LAYOUT,
  isFullyMapped,
  outlineFor,
  padPosition,
  padValues,
  STRIVE_INSOLE_LAYOUT,
} from './layout';
export type { InsolePad, SensorInsoleLayout } from './layout';
export { geometryState, mappedPressureValues } from './geometry';
export type { SourceLayoutReference } from './geometry';
export {
  boundSource,
  isResolvedSource,
  placementLabel,
  readSimulation,
  resolveSource,
  SIMULATOR_GENERATOR,
  SIMULATOR_PRESETS,
  SYNTHETIC_INSOLE_LAYOUT,
  SYNTHETIC_LAYOUT_ID,
  SYNTHETIC_LAYOUT_SHA256,
  SYNTHETIC_LAYOUT_VERSION,
  SYNTHETIC_MAPPING_ID,
  syntheticLayoutCanonical,
} from './source';
export type { ResolvedSource, ShoePlacement, SimulationSource, SimulatorPreset } from './source';

export { DISPLAY_SIGNAL_MAX, signalColor, signalRGB, signalSummary } from './signal';
export { clockReading } from './clock';
export type { ClockReading } from './clock';

export type { LiveMarker, RecordingConditions } from './types';
