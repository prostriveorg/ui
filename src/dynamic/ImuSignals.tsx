import { Group, Paper, SegmentedControl, Stack, Text, Title } from '@mantine/core';
import { useEffect, useRef, useState } from 'react';

import { CHART_COLORS, FOOT_COLORS, FOOT_DASH } from '../tokens';
import { magnitude, readImus } from './imu';
import type { ImuPoint, ImuPoints } from './imu';
import { FootLegend } from './LiveSignalPlot';
import { placementLabel } from './source';
import type { SimulationSource } from './source';

type Marker = { tMs: number; label: string };
/**
 * Accelerometer and angular-speed traces of both feet in sample time, with a sensor and axis
 * selector. Canvas refresh is capped at `maxFps` (default 30) and status text at 2 Hz; selectors
 * and status never re-render at sample rate. Units are `unknown` unless the caller states that
 * the source declares physical units.
 */
export function ImuSignals({
  getPoints,
  cursor,
  range,
  markers = [],
  onSeek,
  live = false,
  sensor: controlledSensor,
  onSensor,
  units = 'unknown',
  placement,
  maxFps = 30,
}: {
  /** Read on each animation frame; keep it cheap and return bounded windows. */
  getPoints: () => ImuPoints;
  cursor?: number;
  range?: { startMs: number; endMs: number };
  markers?: Marker[];
  onSeek?: (t: number) => void;
  live?: boolean;
  sensor?: string;
  onSensor?: (value: string) => void;
  /** `physical` only when validated source metadata declares m/s² and rad/s. */
  units?: 'physical' | 'unknown';
  /** Simulated placement from a validated descriptor; absent means placement is not recorded. */
  placement?: SimulationSource['placement'];
  /** Canvas redraw ceiling. Lower it for busy pages; kiosk views can use 60. */
  maxFps?: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [localSensor, setLocalSensor] = useState('0');
  const sensor = controlledSensor ?? localSensor;
  const setSensor = onSensor ?? setLocalSensor;
  const [axis, setAxis] = useState('magnitude');
  const [status, setStatus] = useState('Waiting for movement-sensor samples');
  /** No valid sample from this sensor for either foot in the shown window. */
  const [empty, setEmpty] = useState(false);
  const bounds = useRef({ startMs: 0, endMs: 10000 });
  const props = useRef({ getPoints, cursor, range, markers, units });
  props.current = { getPoints, cursor, range, markers, units };
  useEffect(() => {
    let request = 0,
      previous = -Infinity,
      lastStatus = -Infinity;
    function draw(now: number) {
      request = requestAnimationFrame(draw);
      if (now - previous < 1000 / Math.max(1, maxFps)) return;
      previous = now;
      const {
        getPoints: read,
        cursor: position,
        range: requestedRange,
        markers: events,
      } = props.current;
      const data = read();
      const end = Math.max(
        data.Left[data.Left.length - 1]?.tMs ?? 0,
        data.Right[data.Right.length - 1]?.tMs ?? 0,
      );
      const start = requestedRange?.startMs ?? Math.max(0, end - 10000);
      const finish = requestedRange?.endMs ?? Math.max(10000, end);
      bounds.current = { startMs: start, endMs: finish };
      const element = canvas.current;
      const ctx = element?.getContext('2d');
      if (!ctx || !element) return;
      const width = Math.max(300, element.clientWidth);
      const ratio = window.devicePixelRatio || 1;
      if (
        element.width !== Math.round(width * ratio) ||
        element.height !== Math.round(300 * ratio)
      ) {
        element.width = Math.round(width * ratio);
        element.height = Math.round(300 * ratio);
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, 300);
      const plotWidth = width - 75;
      const x = (t: number) => 55 + ((t - start) / Math.max(1, finish - start)) * plotWidth;
      const selector = (raw: number[]) =>
        axis === 'magnitude' ? magnitude(raw) : raw[Number(axis)];
      const lines = (['Left', 'Right'] as const).map((foot) => ({
        foot,
        points: data[foot]
          .filter((p) => p.tMs >= start && p.tMs <= finish)
          .map((p) => {
            const imu = readImus(p.imus)[Number(sensor)];
            return {
              ...p,
              imu,
              a: imu.status === 'valid' && imu.raw ? selector(imu.raw.accel) : null,
              g: imu.status === 'valid' && imu.raw ? selector(imu.raw.gyro) : null,
            };
          }),
      }));
      for (const [key, top, unit, title] of [
        [
          'a',
          30,
          props.current.units === 'physical' ? 'm/s²' : 'units unknown',
          props.current.units === 'physical'
            ? 'Acceleration (includes gravity)'
            : 'Accelerometer channels',
        ],
        [
          'g',
          165,
          props.current.units === 'physical' ? 'rad/s' : 'units unknown',
          'Angular speed / velocity',
        ],
      ] as const) {
        const values = lines.flatMap((line) =>
          line.points.flatMap((p) => (p[key] === null ? [] : [p[key]!])),
        );
        let low = Math.min(0, ...values),
          high = Math.max(key === 'a' ? 12 : 1, ...values);
        if (axis !== 'magnitude') low = Math.min(low, -high);
        const y = (v: number) => top + 100 - ((v - low) / Math.max(0.1, high - low)) * 100;
        ctx.fillStyle = CHART_COLORS.movementText;
        ctx.font = '13px sans-serif';
        ctx.fillText(`${title} · ${unit}`, 70, top - 10);
        ctx.fillText(high.toFixed(1), 5, top + 6);
        ctx.fillText(low.toFixed(1), 5, top + 100);
        ctx.strokeStyle = CHART_COLORS.movementFrame;
        ctx.strokeRect(55, top, plotWidth, 100);
        for (const { foot, points } of lines) {
          ctx.beginPath();
          let last: ImuPoint | null = null;
          for (const p of points) {
            const value = p[key];
            if (value === null) {
              last = null;
              continue;
            }
            if (!last || p.breakBefore || p.tMs - last.tMs > 30 || p.tMs <= last.tMs)
              ctx.moveTo(x(p.tMs), y(value));
            else ctx.lineTo(x(p.tMs), y(value));
            last = p;
          }
          ctx.strokeStyle = FOOT_COLORS[foot];
          ctx.lineWidth = 2;
          ctx.setLineDash(FOOT_DASH[foot]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      ctx.font = '12px sans-serif';
      ctx.fillStyle = CHART_COLORS.movementText;
      ctx.fillText(`${(start / 1000).toFixed(2)} s`, 55, 294);
      ctx.fillText(`${(finish / 1000).toFixed(2)} s`, width - 80, 294);
      for (const event of events.filter((m) => m.tMs >= start && m.tMs <= finish)) {
        ctx.beginPath();
        ctx.moveTo(x(event.tMs), 26);
        ctx.lineTo(x(event.tMs), 267);
        ctx.strokeStyle = CHART_COLORS.movementMarker;
        ctx.setLineDash([3, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (position !== undefined && position >= start && position <= finish) {
        ctx.beginPath();
        ctx.moveTo(x(position), 25);
        ctx.lineTo(x(position), 270);
        ctx.strokeStyle = CHART_COLORS.movementCursor;
        ctx.stroke();
      }
      if (now - lastStatus > 500) {
        lastStatus = now;
        setEmpty(lines.every((line) => line.points.every((p) => p.a === null && p.g === null)));
        setStatus(
          (['Left', 'Right'] as const)
            .map((foot) => {
              const points = data[foot];
              let target = position === undefined ? points[points.length - 1] : undefined;
              if (position !== undefined)
                for (let i = points.length - 1; i >= 0; i--) {
                  if (points[i].tMs <= position) {
                    target = points[i];
                    break;
                  }
                }
              const imu =
                target && (position === undefined || position - target.tMs < 30)
                  ? readImus(target.imus)[Number(sensor)]
                  : null;
              const flagged = points.filter(
                (p) => readImus(p.imus)[Number(sensor)].status !== 'valid',
              ).length;
              return `${foot}: ${imu?.status ?? 'no sample'}${flagged ? ` · ${flagged} ${live ? 'preview points' : 'samples'} not usable in window` : ''}`;
            })
            .join(' · '),
        );
      }
    }
    request = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(request);
  }, [sensor, axis, live, maxFps]);
  return (
    <Paper
      withBorder
      p="md"
      radius="md"
      component="section"
      aria-label={live ? 'Live movement sensor signals' : 'Saved movement sensor signals'}
    >
      <Stack gap="sm">
        <Group justify="space-between" wrap="wrap">
          <Title order={4}>Movement sensor signals</Title>
          <SegmentedControl
            aria-label="Movement sensor"
            value={sensor}
            onChange={setSensor}
            data={[
              { value: '0', label: 'Movement sensor 0' },
              { value: '1', label: 'Movement sensor 1' },
            ]}
          />
        </Group>
        <Group wrap="wrap">
          <FootLegend foot="Left" />
          <FootLegend foot="Right" />
          <Text size="xs" c="dimmed">
            {placement
              ? `Simulated placement: sensor ${sensor} at ${
                  sensor === '0'
                    ? 'the ankle'
                    : placement.Left[1] === placement.Right[1]
                      ? `the ${placementLabel(placement.Left[1])}`
                      : `Left ${placementLabel(placement.Left[1])}, Right ${placementLabel(placement.Right[1])}`
                } · sensor-frame axes`
              : 'Placement not recorded'}
          </Text>
          <SegmentedControl
            aria-label="Movement sensor axis"
            size="xs"
            value={axis}
            onChange={setAxis}
            data={[
              { value: 'magnitude', label: 'Combined axes' },
              { value: '0', label: 'X' },
              { value: '1', label: 'Y' },
              { value: '2', label: 'Z' },
            ]}
          />
        </Group>
        <Text size="xs" c="dimmed">
          X/Y/Z are the sensor's own axes, not body directions. Time follows sample timestamps;
          missing, invalid, clipped and frozen samples break traces.
        </Text>
        {empty && (
          <Text size="sm" fw={600}>
            No usable movement-sensor samples from sensor {sensor} in this window.
          </Text>
        )}
        <canvas
          ref={canvas}
          width={960}
          height={300}
          role="img"
          aria-label="Accelerometer and angular-speed traces, left solid and right dashed, aligned in sample time"
          style={{
            width: '100%',
            height: 300,
            display: empty ? 'none' : 'block',
            cursor: onSeek ? 'pointer' : undefined,
          }}
          onPointerDown={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const f = Math.max(
              0,
              Math.min(1, (event.clientX - rect.left - 55) / (rect.width - 75)),
            );
            onSeek?.(bounds.current.startMs + f * (bounds.current.endMs - bounds.current.startMs));
          }}
        />
        <Text role="status" size="xs">
          {status}
        </Text>
        {markers.length > 0 && (
          <Text size="xs" c="dimmed">
            Dashed markers: pressure-derived contact / release.{' '}
            {markers
              .filter((m) => m.tMs >= bounds.current.startMs && m.tMs <= bounds.current.endMs)
              .slice(0, 4)
              .map((m) => `${m.label} ${(m.tMs / 1000).toFixed(2)} s`)
              .join(' · ')}
          </Text>
        )}
      </Stack>
    </Paper>
  );
}
