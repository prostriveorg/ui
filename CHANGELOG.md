# Changelog

## 0.1.0 — initial extraction (2026-11-22)

Live dynamic-analysis presentation extracted from the ProStrive web application
(`prostriveorg/main` at `a141437`), with unchanged appearance and measurement semantics:

- Components: `LiveSignalPlot`, `FootLegend`, `PressureField`, `PressureGrid`,
  `InsoleDiagram`, `ImuSignals`, `LiveWorkspace`, `LiveChannels`, `LiveMovement`,
  `LiveResponse`, `MarkerSummary`, `RecordingStrip`, `StripLabel`; hooks `useTick`,
  `useRecordingClock`.
- Data (`/dynamic/data`): box sample decoding with exact u64 strings, bounded preview
  buffers with continuity breaks, per-foot availability, the hardware and synthetic insole
  layouts, simulator source resolution, signal colour scale, recording clock.
- Theme (`/theme`), tokens and formatting helpers; `styles.css`; optional `fonts.css`.

Changes relative to the application copy:

- A spatial source binding is honoured only for objects returned by `resolveSource`; a
  hand-built, spread or cast object shows raw electrical-order channels.
- `STRIVE_INSOLE_LAYOUT` is frozen, so its unknown hardware mapping cannot be filled in at
  runtime.
- `ImuSignals` defaults to `units="unknown"` (was `physical`); `PressureField` and the live
  components require `units`.
- `ingestSample` and `createPreviewBuffers` replace the per-transport parse-and-push code.
