# @prostriveorg/ui

ProStrive's shared live dynamic-analysis UI: one maintained implementation of the live
sensor-insole views, used by the ProStrive web application and, later, by the desktop
application on the measurement box.

Private package, owned by ProStrive (`UNLICENSED`). Published only to GitHub Packages
under the `prostriveorg` organisation.

**Scope.** Neutral sports-measurement presentation of the live preview: paired signal
plot, raw channel grid, insole field for confirmed source-bound mappings, movement-sensor
traces and recording status. It does not interpret health status, classify, assess risk or
recommend anything; it adds no analysis algorithms. Authentication, routing, capture
commands, persistence, upload and verification stay in the consuming application.

## Entry points

| Import                          | Contents                                                                                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@prostriveorg/ui`              | Tokens (`FOOT_COLORS`, `FOOT_DASH`, `CHART_COLORS`, `PRESSURE_SCALE_STOPS`), `FEET`, formatting (`formatClock`, `formatSignal`, `unitsCaption`). No React/Mantine. |
| `@prostriveorg/ui/theme`        | `prostriveTheme` Mantine override, font-family constants, `variantColorResolver`.                                                                                  |
| `@prostriveorg/ui/dynamic`      | Components and hooks, plus everything in `dynamic/data`.                                                                                                           |
| `@prostriveorg/ui/dynamic/data` | React-free interfaces, sample decoding, preview buffers, layouts, source binding, signal colour, clock. Safe in Node, tests and workers.                           |
| `@prostriveorg/ui/styles.css`   | Required stylesheet for the components (stable `psui-` class names, `--psui-*` tokens).                                                                            |
| `@prostriveorg/ui/fonts.css`    | Optional: Inter and Saira variable fonts (Latin + Latin Extended) bundled as local files, for offline devices.                                                     |

ESM only, with TypeScript declarations. `react`, `react-dom`, `@mantine/core` and
`@mantine/hooks` are peer dependencies and are never bundled.

## Installation

The package lives in GitHub Packages, which requires authentication even to read.

1. Create a GitHub token that can read packages of `prostriveorg` (a classic token with
   `read:packages`, SSO-authorised for the organisation). Keep it in your user
   environment, never in a repository.
2. In your **user** `~/.npmrc` (not the project):

   ```ini
   @prostriveorg:registry=https://npm.pkg.github.com
   //npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
   ```

   and export `NODE_AUTH_TOKEN` in your shell. Yarn 1 reads the same file.

3. Install an exact version: `yarn add @prostriveorg/ui@0.1.0`.

CI that installs the package uses its own `GITHUB_TOKEN` with `packages: read` (grant the
consuming repository read access in the package settings). Deployed devices never install
from the registry: they run the application's built bundle, so no registry credential is
ever needed on a device.

## Styles and providers

```tsx
import '@mantine/core/styles.css'; // 1. Mantine first
import '@prostriveorg/ui/fonts.css'; // 2. optional bundled fonts
import '@prostriveorg/ui/styles.css'; // 3. then the UI styles (equal specificity, later wins)

import { MantineProvider } from '@mantine/core';
import { prostriveTheme } from '@prostriveorg/ui/theme';

<MantineProvider theme={prostriveTheme}>{app}</MantineProvider>;
```

- Every component needs a `MantineProvider` ancestor. The theme is optional but gives the
  ProStrive look (primary orange, Inter/Saira, radii, button resolver).
- To add application-specific overrides (a loader, extra components), merge rather than
  copy: `mergeThemeOverrides(prostriveTheme, createTheme({ components: { Loader: … } }))`.
- `fonts.css` is optional. Without it, the theme falls back to system fonts unless the
  application loads Inter/Saira itself (the web app uses `@fontsource-variable/*`).
- Restyle with the `--psui-*` custom properties (zero-specificity defaults on `:root`), e.g.
  `--psui-strip-bg`. Canvas colours come from `CHART_COLORS`.

## Data interfaces

All in `@prostriveorg/ui/dynamic/data`.

- **Samples** — `parseSample(envelope, receivedAt)` validates one box `Sample` envelope
  (`{ foot, sample: { pressure[64], tick | tickExact, unified_ts_ns | timestampNsExact, imus } }`)
  into a `PreviewPoint`. Ticks and timestamps stay **exact u64 decimal strings**; numbers are
  accepted only while safe integers. The 64 `pressure` values are copied unchanged in
  electrical order. A malformed IMU part never discards the pressure part.
- **Durations** — `relativeMs(timestampNs, originNs)` subtracts in BigInt first and is exact to
  1 µs; use it only for bounded relative durations (chart positions).
- **Preview buffers** — `createPreviewBuffers()` returns one bounded `PreviewBuffer` per foot
  (1200 points, 10 s window). `ingestSample(buffers, envelope, performance.now())` decodes and
  appends, returning `accepted`, `duplicate` or `rejected`. Buffers are mutated in place and
  read by canvases on animation frames: sample arrival never re-renders React.
- **Continuity** — a point has `breakBefore` after late arrival (> 250 ms), a skipped box
  timestamp (> 30 ms), or a counter/timestamp that goes backwards (source reset); `gaps`
  counts them. Traces break there.
- **Availability** — `LivePreview = { buffers, connected, subscribed? }`. `footStatus` and
  `previewKinds` give each foot `receiving`, `interrupted` (stale > 1 s), `waiting` (no
  sample yet: a missing foot) or `disconnected`. Only a receiving foot contributes values.
- **Recorder state is separate** — `RecordingStrip` takes the recorder presentation and the
  clock from the application's authoritative box state, and preview kinds from the buffers.
  `useRecordingClock({ anchorMs, observedAt, maxDurationMs, running })` animates elapsed and
  remaining time from the box-confirmed anchor only, and holds it when not confirmed running.
  Preview samples are never an input to recorder state or time.
- **Markers** — `LiveMarker = { id, label, timestampNs, tMs }`, box-stamped.
- **Units** — pressure units are a string passed through as recorded (`'unknown units'` when
  absent); `unitsCaption` never invents one. Movement-sensor units default to `unknown`.

### Spatial mapping eligibility

Channels are shown in electrical order (8 × 8 grid, "Electrical order, not foot position")
unless the source binds to a complete mapping:

- `STRIVE_INSOLE_LAYOUT` is the hardware geometry. It is frozen and its channel mapping is
  unknown (all `null`) until a press test confirms it, so it never yields spatial values.
- `resolveSource({ acquisitionMode, simulation })` returns a `ResolvedSource` only for a
  `mock-ble` source with a valid, hash-pinned simulator descriptor; real BLE, legacy and
  fixture sources return `null`.
- Components honour a `source` only if that exact object came from `resolveSource`
  (`isResolvedSource`). A hand-built, spread, deserialised or cast object — for example real
  hardware data paired with the synthetic layout — is ignored and raw channels are shown.
- The synthetic layout is always labelled "Generated data · synthetic layout, not the
  hardware mapping". Adding a confirmed hardware mapping is a separate, reviewed change to
  this package (new layout version and resolver), not a consumer option.

## Components (`@prostriveorg/ui/dynamic`)

- `LiveSignalPlot`, `FootLegend` — paired Left (solid) / Right (dashed) mean channel signal,
  last 10 s, box-timestamp axis, markers; canvas at ≤ 30 Hz by default (`maxFps` for a kiosk).
- `PressureField`, `PressureGrid` — raw channel grid, or mapped insole (smooth field, pads,
  signal path) for an eligible source; readout of highest channel and channel mean.
- `InsoleDiagram` — the physical insole drawing; callers choose pad fills and labels.
- `ImuSignals` — movement-sensor traces with sensor and axis selectors.
- `ImuAxes` — all three sensor-frame axes at once, two rows (acceleration and angular speed),
  with Left/Right traces in every panel; useful for technician inspection.
- `LiveChannels`, `LiveMovement`, `LiveResponse`, `MarkerSummary`, `LiveWorkspace` — the live
  workspace and its Overview / Sensor channels / Movement views.
- `RecordingStrip`, `StripLabel`, `useRecordingClock`, `useTick` — recording status
  presentation; the application supplies the controls in `actions`.

## Development

```sh
yarn install
yarn build            # dist/: ESM, declarations, styles.css, fonts
yarn typecheck && yarn lint && yarn format:check
yarn test             # Node test runner against the built package (run yarn build first)
yarn verify:pack      # npm pack → isolated consumer: install, type-check, Node import, Vite build
yarn playground       # http://127.0.0.1:5180 — generated data only (yarn build first)
yarn playground:build && yarn browser:check   # Chrome checks of states and render counts
```

The playground shows receiving (raw), mapped (synthetic descriptor), gaps and resets,
waiting, stale, disconnected and missing-foot states with generated fixtures only. Tests
import the package by its own name, so they exercise `dist/`, not the sources.

Requirements: Node ≥ 22.6, Yarn 1. `browser:check` needs Chrome, or `PSUI_BROWSER` set to a
Chromium executable.

## Releases

Versions are explicit. To release:

1. Update `version` in `package.json` (and the lockfile if dependencies changed), commit.
2. Tag the commit `v<version>` (e.g. `v0.1.0`) and push the tag.
3. The `Release` workflow checks that the tag matches `package.json`, runs the full
   checks and the packed-artifact verification, and publishes that exact tarball to
   GitHub Packages with the workflow's own `GITHUB_TOKEN` (`packages: write` on the
   publish job only). The publish job runs in the `packages` environment, so required
   reviewers can be added in the repository settings.
4. Note the release in `CHANGELOG.md`, then update consumers to the exact version.

`publishConfig.registry` pins publishing to GitHub Packages; there is no public npm
publishing. No registry credential is stored in the repository. Package visibility follows
the private repository; grant consuming repositories (e.g. `prostriveorg/main`) read
access under the package's settings.

## Future desktop (Tauri) integration

The package has no Tauri dependency and no transport. A desktop shell supplies the same
interfaces:

1. **Preview transport.** Either open the box's read-only `/ws` from the webview (as the web
   app does), or receive samples from the Rust side. In the latter case, forward the raw
   `Sample` envelopes in small batches (e.g. one event per animation frame) rather than one IPC
   message per sample, and call `ingestSample(buffers, envelope, performance.now())` for each.
   Keep ticks and timestamps as strings across IPC; never convert them to JS numbers.
2. **Availability.** Set `connected` from the transport and `subscribed` from whether
   samples were requested; buffers handle staleness and missing feet. Kiosk consumers can pass
   `maxFps={60}` to the live canvases without changing the web default.
3. **Recorder state.** Derive the `RecordingStrip` inputs and the clock anchor from the box's
   authoritative control snapshot (`/capture/v1`), exactly as the web app does — never from
   preview samples. Commands, persistence and upload stay in the desktop application.
4. **Source binding.** Read the preview source metadata and pass it through `resolveSource`;
   pass `null` when absent.
5. **Assets.** Import `fonts.css` so the device needs no network fonts; the stylesheet and
   fonts are bundled by the desktop app's own Vite build.

Not yet validated: Orange Pi 5 Plus (aarch64, NixOS, Sway/Wayland) runtime, WebKitGTK
rendering and frame rates. Those belong to the desktop application's qualification.
