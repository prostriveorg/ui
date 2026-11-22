import { Group, Progress, Stack, Text } from '@mantine/core';
import type { CSSProperties, ReactNode } from 'react';

import { FEET } from '../foot';
import type { Foot } from '../foot';
import { formatClock, formatLimit } from '../format';
import type { ClockReading } from './clock';
import { PREVIEW_LABELS } from './preview';
import type { PreviewKind } from './preview';

import classes from './dynamic.module.css';

/** Recorder status as the consuming application derived it from the authoritative box state. */
export interface RecorderPresentation {
  headline: string;
  /** Second line under the headline (detail, or the recording conditions). */
  detail: ReactNode;
  tone: 'live' | 'neutral' | 'attention';
}

/** Small caption text styled for the dark recording strip. */
export function StripLabel({
  children,
  span = false,
  style,
}: {
  children?: ReactNode;
  span?: boolean;
  style?: CSSProperties;
}) {
  return span ? (
    <span className={classes.stripLabel} style={style}>
      {children}
    </span>
  ) : (
    <Text className={classes.stripLabel} style={style}>
      {children}
    </Text>
  );
}

/**
 * The persistent recording strip: recorder status, elapsed/remaining time and per-foot preview
 * availability, plus the application's own controls in `actions`.
 *
 * Its three inputs stay separate: `recorder` and `clock` come from the box's confirmed control
 * state (see `useRecordingClock`), `preview` from the preview buffers. Nothing here infers one
 * from the other; the strip only presents them.
 */
export function RecordingStrip({
  recorder,
  clock,
  limitMs,
  running,
  preview,
  previewDetail,
  actions,
  sticky = true,
}: {
  recorder: RecorderPresentation;
  /** From `useRecordingClock`; null when no recording is confirmed. */
  clock: ClockReading | null;
  /** The box's maximum recording duration. */
  limitMs: number;
  /** True only while a fresh snapshot confirms the recorder is running. */
  running: boolean;
  preview: Record<Foot, PreviewKind>;
  /** One sentence about preview continuity, phrased from the recorder state by the application. */
  previewDetail: ReactNode;
  actions?: ReactNode;
  sticky?: boolean;
}) {
  return (
    <section className={classes.recordingStrip} data-sticky={sticky} aria-label="Recording status">
      <div className={classes.stripGrid}>
        <Stack gap={2} role="status">
          <div className={classes.stripState}>
            <span className={classes.stateDot} data-tone={recorder.tone} aria-hidden="true" />
            {recorder.headline}
          </div>
          <Text className={classes.stripLabel}>{recorder.detail}</Text>
        </Stack>
        <Stack gap={4}>
          <span className={classes.recordingClock} aria-label="Elapsed recording time">
            {clock ? formatClock(clock.elapsedMs) : '—'}
          </span>
          <Text className={classes.stripLabel}>
            {clock
              ? `${formatLimit(clock.remainingMs)} left · stops at ${formatLimit(limitMs)}${running ? '' : ' · last confirmed'}`
              : `Stops at ${formatLimit(limitMs)}`}
          </Text>
          <Progress
            size="xs"
            color="gray.3"
            bg="rgb(255 255 255 / 18%)"
            value={Math.min(100, (clock?.fraction ?? 0) * 100)}
            aria-label="Recording time used of the box limit"
          />
        </Stack>
        <Stack gap={4}>
          <Group gap="md">
            {FEET.map((foot) => (
              <span key={foot} className={classes.previewPill}>
                <span className={classes.previewDot} data-kind={preview[foot]} aria-hidden="true" />
                {foot} · {PREVIEW_LABELS[preview[foot]]}
              </span>
            ))}
          </Group>
          <Text className={classes.stripLabel}>{previewDetail}</Text>
        </Stack>
        {actions !== undefined && <div className={classes.stripActions}>{actions}</div>}
      </div>
    </section>
  );
}
