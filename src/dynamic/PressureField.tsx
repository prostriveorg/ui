import { Checkbox, Group, SegmentedControl, Stack, Text, Title } from '@mantine/core';
import { useEffect, useRef, useState } from 'react';

import { FEET } from '../foot';
import type { Foot } from '../foot';
import { formatSignal, unitsCaption } from '../format';
import { CHART_COLORS, FOOT_COLORS } from '../tokens';
import { geometryState, mappedPressureValues } from './geometry';
import { STRIVE_INSOLE_LAYOUT } from './layout';
import { PressureInsole } from './PressureInsole';
import { DISPLAY_SIGNAL_MAX, signalColor, signalSummary } from './signal';
import { boundSource } from './source';
import type { ResolvedSource } from './source';
import type { RecordingConditions } from './types';

import classes from './dynamic.module.css';

/**
 * The 64 original channels of one foot in electrical order (8 × 8, channel 1 top-left).
 * No mirroring, foot clipping or anatomical assumptions: every original channel stays visible.
 */
export function PressureGrid({
  foot,
  pressure,
  compact = false,
  showValues = false,
  live = false,
  displayMax = DISPLAY_SIGNAL_MAX,
  fill = false,
}: {
  foot: Foot;
  pressure: ArrayLike<number> | null;
  compact?: boolean;
  showValues?: boolean;
  live?: boolean;
  /** Top of the colour scale. Original values are shown unchanged. */
  displayMax?: number;
  /** Fill the available card height with the grid instead of using a fixed square. */
  fill?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, 320, 320);
    for (let i = 0; i < 64; i++) {
      context.fillStyle = pressure
        ? signalColor((pressure[i] / Math.max(1e-10, displayMax)) * DISPLAY_SIGNAL_MAX)
        : CHART_COLORS.gridEmpty;
      context.fillRect((i % 8) * 40, Math.floor(i / 8) * 40, 40, 40);
      context.strokeStyle = CHART_COLORS.gridCellLine;
      context.strokeRect((i % 8) * 40, Math.floor(i / 8) * 40, 40, 40);
      if (showValues && pressure) {
        context.fillStyle = pressure[i] > displayMax * 0.8 ? '#fff' : CHART_COLORS.gridValueDark;
        context.font = '600 11px monospace';
        context.textAlign = 'center';
        context.fillText(
          Number(pressure[i].toPrecision(4)).toString(),
          (i % 8) * 40 + 20,
          Math.floor(i / 8) * 40 + 24,
        );
      }
    }
    if (!pressure) {
      context.fillStyle = CHART_COLORS.gridMessage;
      context.font = '500 18px sans-serif';
      context.textAlign = 'center';
      context.fillText('No data', 160, 165);
    }
  }, [pressure, showValues, displayMax]);
  return (
    <div
      className={classes.map}
      style={
        fill
          ? { height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }
          : undefined
      }
    >
      <Text size={compact ? 'sm' : 'md'} fw={650} c={FOOT_COLORS[foot]}>
        {foot}
      </Text>
      {fill ? (
        <div style={{ flex: 1, minHeight: 0, display: 'grid', placeItems: 'center' }}>
          <canvas
            ref={canvas}
            width={320}
            height={320}
            role="img"
            aria-label={`${foot} indexed 8 by 8 sensor grid ${live ? 'in the live preview' : 'at the current replay time'}${pressure ? '' : ', no data'}`}
            className={classes.mapCanvas}
            style={{
              height: '100%',
              width: 'auto',
              maxWidth: '100%',
              maxHeight: '100%',
              margin: 0,
            }}
          />
        </div>
      ) : (
        <canvas
          ref={canvas}
          width={320}
          height={320}
          role="img"
          aria-label={`${foot} indexed 8 by 8 sensor grid ${live ? 'in the live preview' : 'at the current replay time'}${pressure ? '' : ', no data'}`}
          className={classes.mapCanvas}
          style={compact ? { maxWidth: 132 } : undefined}
        />
      )}
      {!compact && !fill && (
        <Text size="xs" c="dimmed">
          Channels 1–64 · row 1 at top
        </Text>
      )}
    </div>
  );
}

const formatTime = (ms: number) => {
  const tenths = Math.floor(Math.max(0, ms) / 100);
  return `${Math.floor(tenths / 600)}:${((tenths % 600) / 10).toFixed(1).padStart(4, '0')}`;
};

/**
 * Channel values at one moment. Mapped field views appear only for a complete channel mapping
 * that the source explicitly binds to (`source`, from `resolveSource`); otherwise every channel
 * stays in electrical order. Hardware recordings have no confirmed mapping yet.
 */
export function PressureField({
  left,
  right,
  live = false,
  source = null,
  timeMs = 0,
  context,
  scaleMax,
  units,
  compact = false,
}: {
  left: ArrayLike<number> | null;
  right: ArrayLike<number> | null;
  live?: boolean;
  /**
   * Layout binding from `resolveSource`; never inferred from the acquisition mode. An object
   * that did not come from `resolveSource` is ignored and the raw channels are shown.
   */
  source?: ResolvedSource | null;
  /** Bounded relative time of the shown values, for the saved-time caption and signal path. */
  timeMs?: number;
  context?: RecordingConditions;
  /** Colour-scale maximum for raw channels; defaults to the fixed display scale. */
  scaleMax?: number;
  /** Recorded pressure units, or `unknown units`. */
  units: string;
  /** Prepare-step signal check: no setup column. */
  compact?: boolean;
}) {
  const bound = boundSource(source);
  const layout = bound?.layout ?? STRIVE_INSOLE_LAYOUT;
  const sourceLayout = bound?.reference;
  const ready = geometryState(layout, sourceLayout) === 'ready';
  const synthetic = ready && !!bound;
  // No choice until the operator picks one, so a source that resolves later still opens mapped.
  const [mode, setMode] = useState<string | null>(null);
  const [showValues, setShowValues] = useState(false);
  const [showTrail, setShowTrail] = useState(true);
  const pressure = { Left: left, Right: right };
  const values = Object.fromEntries(
    FEET.map((foot) => [foot, mappedPressureValues(layout, sourceLayout, pressure[foot])]),
  ) as Record<Foot, (number | null)[] | null>;
  const summaries = { Left: signalSummary(left), Right: signalSummary(right) };
  const displayMax = scaleMax && scaleMax > 0 ? scaleMax : DISPLAY_SIGNAL_MAX;
  const scaleLabel = Number(displayMax.toPrecision(4)).toLocaleString();
  const message =
    geometryState(layout, sourceLayout) === 'unmapped'
      ? 'Awaiting channel mapping'
      : 'Source layout not recorded';
  // Without a confirmed mapping only the electrical channel grid is honest; no layout mode.
  const shownMode = ready ? (mode ?? 'smooth') : 'raw';
  const title = ready
    ? live
      ? 'Live pressure field'
      : 'Recorded pressure field'
    : live
      ? 'Live sensor channels'
      : 'Sensor channels';
  return (
    <section className={classes.field} aria-label={title} data-mode={shownMode}>
      <div className={classes.fieldToolbar}>
        <Group gap="xs" align="baseline">
          <Title order={3} size="h4">
            {title}
          </Title>
          {!ready && (
            <Text size="sm" c="dimmed">
              Electrical order, not foot position
            </Text>
          )}
          {synthetic && (
            <Text size="sm" c="dimmed">
              Generated data · synthetic layout v{layout.version}, not the hardware mapping
            </Text>
          )}
        </Group>
        {live ? (
          <Group gap={8}>
            <span className={classes.streamIndicator} data-active={!!left || !!right} />
            <Text size="xs" c="dimmed">
              {left || right ? 'Preview' : 'Waiting for preview samples'}
            </Text>
          </Group>
        ) : (
          <Text size="xs" c="dimmed">
            Saved samples at {formatTime(timeMs)}
          </Text>
        )}
      </div>
      <div className={classes.fieldBody}>
        <aside className={classes.viewRail} aria-label="Pressure display controls">
          {ready && (
            <div>
              <div className={classes.eyebrow}>View</div>
              <SegmentedControl
                mt="sm"
                fullWidth
                orientation="vertical"
                size="xs"
                aria-label="Pressure map view"
                value={shownMode}
                onChange={setMode}
                data={[
                  ...(ready ? [{ value: 'smooth', label: 'Smooth field' }] : []),
                  { value: 'layout', label: ready ? 'Sensor pads' : 'Insole layout' },
                  { value: 'raw', label: '64 channels' },
                ]}
              />
            </div>
          )}
          <Stack gap="sm">
            {ready && (
              <Checkbox
                label="Signal path"
                size="xs"
                checked={showTrail}
                disabled={shownMode === 'raw'}
                onChange={(e) => setShowTrail(e.currentTarget.checked)}
              />
            )}
            <Checkbox
              label="Show channel values"
              size="sm"
              checked={showValues}
              disabled={shownMode === 'smooth'}
              onChange={(e) => setShowValues(e.currentTarget.checked)}
            />
          </Stack>
          {context && !compact && (
            <div>
              <div className={classes.eyebrow}>Recording setup</div>
              <Text size="xs" c="dimmed" mt="sm">
                Speed
              </Text>
              <Text size="sm" fw={600}>
                {context.speedKmh === null ? 'Not entered' : `${context.speedKmh} km/h`}
              </Text>
              <Text size="xs" c="dimmed" mt="sm">
                Incline
              </Text>
              <Text size="sm" fw={600}>
                {context.inclinePct === null ? 'Not entered' : `${context.inclinePct}%`}
              </Text>
              <Text size="xs" c="dimmed" mt="sm">
                Footwear
              </Text>
              <Text size="sm" fw={600}>
                {context.footwear || 'Not entered'}
              </Text>
            </div>
          )}
          <div className={classes.railFootnote}>
            <Text size="xs" c="dimmed">
              64 channels per foot
              <br />
              Signal: {unitsCaption(units)}
            </Text>
          </div>
        </aside>
        <div className={classes.maps}>
          <div className={classes.mapPair}>
            {FEET.map((foot) =>
              shownMode === 'raw' ? (
                <PressureGrid
                  key={foot}
                  foot={foot}
                  pressure={pressure[foot]}
                  showValues={showValues}
                  live={live}
                  displayMax={displayMax}
                />
              ) : (
                <PressureInsole
                  key={foot}
                  foot={foot}
                  layout={layout}
                  values={values[foot]}
                  mode={shownMode}
                  showValues={showValues}
                  showTrail={showTrail}
                  timeMs={timeMs}
                  live={live}
                  message={message}
                />
              ),
            )}
          </div>
          <div className={classes.legend}>
            <span>{shownMode === 'raw' ? '0' : 'Low'}</span>
            <div className={classes.gradient} />
            <span>{shownMode === 'raw' ? scaleLabel : 'High'}</span>
          </div>
          <Text ta="center" size="xs" c="dimmed" mt={6}>
            {shownMode === 'raw'
              ? `Colour scale 0–${scaleLabel}${scaleMax ? (live ? ' (highest value, last 10 s)' : ' (highest value in recording)') : ''} · ${unitsCaption(units)}`
              : synthetic
                ? 'Generated signal on the synthetic layout'
                : ready
                  ? 'Mapped pressure signal'
                  : 'Reference geometry · awaiting a confirmed mapping'}
          </Text>
        </div>
        <aside
          className={classes.readout}
          aria-label={live ? 'Live signal readout' : 'Replay signal readout'}
        >
          <div className={classes.eyebrow}>{live ? 'Latest preview' : 'At replay time'}</div>
          <div className={classes.readoutPair}>
            {(['peak', 'mean'] as const).flatMap((metric) =>
              FEET.map((foot) => (
                <div key={`${metric}-${foot}`}>
                  <Text size="xs" c="dimmed">
                    {metric === 'peak' ? 'Highest channel' : 'Channel mean'}{' '}
                    <span style={{ color: FOOT_COLORS[foot], fontWeight: 650 }}>{foot}</span>
                  </Text>
                  <div className={classes.value}>
                    {summaries[foot] ? formatSignal(summaries[foot]![metric]) : '—'}
                    {units !== 'unknown units' && units !== 'relative signal' && (
                      <span className={classes.unit}>{units}</span>
                    )}
                  </div>
                </div>
              )),
            )}
          </div>
          <Text size="xs" c="dimmed">
            {unitsCaption(units) === 'units not recorded'
              ? 'Units not recorded.'
              : `Signal: ${unitsCaption(units)}.`}
          </Text>
        </aside>
      </div>
    </section>
  );
}
