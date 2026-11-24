import {
  Accordion,
  Button,
  Group,
  Popover,
  SegmentedControl,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { useState } from 'react';

import { FEET } from '../foot';
import type { Foot } from '../foot';
import { formatClock } from '../format';
import { FOOT_COLORS } from '../tokens';
import { relativeMs } from './exact';
import { useTick } from './hooks';
import { ImuSignals } from './ImuSignals';
import { LiveSignalPlot } from './LiveSignalPlot';
import { PressureField } from './PressureField';
import { imuPoints, isReceiving, latestPressure, liveRate, windowPeak } from './preview';
import type { LivePreview } from './preview';
import { boundSource } from './source';
import type { ResolvedSource } from './source';
import type { LiveMarker } from './types';

import classes from './dynamic.module.css';

/**
 * Live channel values (raw electrical-order grid, or the mapped field for a source-bound layout).
 * Values refresh at `refreshHz` (default 10 Hz): readable, and cheap for 128 canvas cells.
 */
export function LiveChannels({
  preview,
  units,
  source = null,
  refreshHz = 10,
  originNs = '0',
}: {
  preview: LivePreview;
  units: string;
  /** From `resolveSource`; anything else shows raw channels. */
  source?: ResolvedSource | null;
  refreshHz?: number;
  /** Time origin of the signal path; only differences matter. */
  originNs?: string;
}) {
  const now = useTick(refreshHz);
  const peak = windowPeak(preview, now);
  const at = performance.now();
  return (
    <PressureField
      live
      timeMs={relativeMs(preview.buffers.Left.latest?.timestampNs ?? '0', originNs)}
      left={latestPressure(preview, 'Left', at)}
      right={latestPressure(preview, 'Right', at)}
      scaleMax={peak || undefined}
      units={units}
      source={source}
    />
  );
}

/** Live movement-sensor traces. Units and placement come only from a resolved source. */
export function LiveMovement({
  preview,
  source = null,
  originNs = '0',
  maxFps = 30,
}: {
  preview: LivePreview;
  source?: ResolvedSource | null;
  /** Chart time origin in box nanoseconds; default 0 shows box-clock seconds. */
  originNs?: string;
  /** Canvas redraw ceiling for the movement chart. */
  maxFps?: number;
}) {
  const bound = boundSource(source);
  return (
    <ImuSignals
      live
      units={bound ? 'physical' : 'unknown'}
      placement={bound?.simulation.placement}
      getPoints={() => imuPoints(preview, performance.now(), originNs)}
      maxFps={maxFps}
    />
  );
}

/** The latest marked moment, with every marked moment in a popover. */
export function MarkerSummary({
  markers,
}: {
  markers: readonly Omit<LiveMarker, 'timestampNs'>[];
}) {
  if (!markers.length)
    return (
      <Text size="sm" c="dimmed">
        No marked moments yet.
      </Text>
    );
  const last = markers[markers.length - 1];
  return (
    <Group gap="sm" wrap="wrap">
      <Text size="sm">
        Last mark: <strong>{last.label}</strong> · {formatClock(last.tMs)}
      </Text>
      <Popover position="bottom-start" shadow="md" withArrow>
        <Popover.Target>
          <Button size="compact-sm" variant="subtle">
            All marked moments ({markers.length})
          </Button>
        </Popover.Target>
        <Popover.Dropdown>
          <Stack gap={4} mah={260} style={{ overflowY: 'auto' }}>
            {markers.map((marker) => (
              <Text key={marker.id} size="sm" ff="monospace">
                {formatClock(marker.tMs)} · {marker.label}
              </Text>
            ))}
          </Stack>
        </Popover.Dropdown>
      </Popover>
    </Group>
  );
}

/** Prepare: a compact paired response trace, plus channel values when a source is known. */
export function LiveResponse({
  preview,
  units,
  source = null,
}: {
  preview: LivePreview;
  units: string;
  source?: ResolvedSource | null;
}) {
  return (
    <Stack gap="sm">
      <LiveSignalPlot preview={preview.buffers} units={units} height={130} title="Live response" />
      {source && <LiveChannels preview={preview} units={units} source={source} />}
    </Stack>
  );
}

export type LiveView = 'overview' | 'channels' | 'movement';

/**
 * The live workspace below a recording strip: one paired trace by default, with channel values
 * and movement sensors as intentional inspection views. Status text refreshes at 2 Hz; samples
 * never re-render it.
 */
export function LiveWorkspace({
  preview,
  units,
  source = null,
  markers = [],
  recording = null,
  defaultView = 'overview',
  maxFps = 30,
}: {
  preview: LivePreview;
  units: string;
  /** From `resolveSource` for the recording's frozen descriptor; null for real or legacy sources. */
  source?: ResolvedSource | null;
  /** Box-stamped markers of the current recording. */
  markers?: readonly LiveMarker[];
  /** The confirmed recording, for the details panel; null before the box confirms one. */
  recording?: { id: string; startedTsNs: string } | null;
  defaultView?: LiveView;
  /** Canvas redraw ceiling shared by the live plot and movement chart. */
  maxFps?: number;
}) {
  const now = useTick(2);
  const [view, setView] = useState<string>(defaultView);
  // Count gaps from when this workspace opened; remount (key) it per recording.
  const [gapBaseline] = useState(() => ({
    Left: preview.buffers.Left.gaps,
    Right: preview.buffers.Right.gaps,
  }));
  const gaps = (foot: Foot) => preview.buffers[foot].gaps - gapBaseline[foot];
  const totalGaps = gaps('Left') + gaps('Right');
  return (
    <Stack gap="sm" className={classes.workspace}>
      <SegmentedControl
        aria-label="Recording view"
        value={view}
        onChange={setView}
        data={[
          { value: 'overview', label: 'Overview' },
          { value: 'channels', label: 'Sensor channels' },
          { value: 'movement', label: 'Movement' },
        ]}
        w="fit-content"
      />
      {view === 'overview' && (
        <>
          <LiveSignalPlot
            preview={preview.buffers}
            units={units}
            height={230}
            markers={markers}
            maxFps={maxFps}
          />
          <Group justify="space-between" wrap="wrap" gap="xs">
            <MarkerSummary markers={markers} />
            {totalGaps > 0 && (
              <Text size="sm" c="dimmed">
                Preview gaps since start: {totalGaps}. Preview only; the saved file is checked after
                Stop.
              </Text>
            )}
          </Group>
        </>
      )}
      {view === 'channels' && <LiveChannels preview={preview} units={units} source={source} />}
      {view === 'movement' && (
        <LiveMovement preview={preview} source={source} maxFps={maxFps} />
      )}
      <Accordion variant="contained" radius="md" chevronPosition="left">
        <Accordion.Item value="details">
          <Accordion.Control>Recording details</Accordion.Control>
          <Accordion.Panel>
            <Table fz="sm" withRowBorders={false} verticalSpacing={4}>
              <Table.Tbody>
                {FEET.map((foot) => {
                  const rate = isReceiving(preview, foot, now)
                    ? liveRate(preview.buffers[foot], now)
                    : null;
                  return (
                    <Table.Tr key={foot}>
                      <Table.Td c={FOOT_COLORS[foot]} fw={600} w={80}>
                        {foot}
                      </Table.Td>
                      <Table.Td>
                        Preview {rate === null ? 'rate unavailable' : `${rate.toFixed(0)} Hz`} ·{' '}
                        {preview.buffers[foot].count.toLocaleString()} preview samples ·{' '}
                        {gaps(foot)} preview gap{gaps(foot) === 1 ? '' : 's'}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
                {recording && (
                  <>
                    <Table.Tr>
                      <Table.Td c="dimmed">Recording</Table.Td>
                      <Table.Td ff="monospace">{recording.id}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td c="dimmed">Box start</Table.Td>
                      <Table.Td ff="monospace">{recording.startedTsNs} ns</Table.Td>
                    </Table.Tr>
                  </>
                )}
              </Table.Tbody>
            </Table>
            <Text size="xs" c="dimmed" mt="xs">
              Preview values are a lossy live copy. The box records every accepted sample
              separately.
            </Text>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Stack>
  );
}
