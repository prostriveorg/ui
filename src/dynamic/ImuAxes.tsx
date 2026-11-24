import { Group, Paper, SegmentedControl, Stack, Text, Title } from '@mantine/core';
import { useEffect, useRef, useState } from 'react';

import { FEET } from '../foot';
import { CHART_COLORS, FOOT_COLORS, FOOT_DASH } from '../tokens';
import { FootLegend } from './LiveSignalPlot';
import { readImus } from './imu';
import type { ImuPoints } from './imu';

/**
 * All three sensor-frame axes of one movement sensor at once. Three columns (X/Y/Z) by two
 * rows (acceleration / angular speed), with the left and right foot overlaid in each panel.
 *
 * This is the inspection view for a technician: it makes an axis-specific problem visible
 * without cycling through the single-axis plot. It reads the same bounded preview points as
 * `ImuSignals` and never changes the samples.
 */
export function ImuAxes({
  getPoints,
  sensor: controlledSensor,
  onSensor,
  units = 'unknown',
  maxFps = 30,
}: {
  /** Read on each animation frame; return bounded live or replay points. */
  getPoints: () => ImuPoints;
  /** Controlled movement sensor (`0` or `1`). */
  sensor?: string;
  onSensor?: (value: string) => void;
  /** `physical` only when validated source metadata declares m/s² and rad/s. */
  units?: 'physical' | 'unknown';
  /** Canvas redraw ceiling. Lower it for busy pages; kiosk views can use 60. */
  maxFps?: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [localSensor, setLocalSensor] = useState('0');
  const sensor = controlledSensor ?? localSensor;
  const setSensor = onSensor ?? setLocalSensor;
  const [status, setStatus] = useState('Waiting for movement-sensor samples');
  const [empty, setEmpty] = useState(false);
  const props = useRef({ getPoints, units });
  props.current = { getPoints, units };

  useEffect(() => {
    let request = 0;
    let previous = -Infinity;
    let lastStatus = -Infinity;
    const sensorIndex = Number(sensor);

    function draw(now: number) {
      request = requestAnimationFrame(draw);
      if (now - previous < 1000 / Math.max(1, maxFps)) return;
      previous = now;

      const element = canvas.current;
      const context = element?.getContext('2d');
      if (!context || !element?.clientWidth) return;

      const width = Math.max(640, element.clientWidth);
      const height = 420;
      const ratio = window.devicePixelRatio || 1;
      if (
        element.width !== Math.round(width * ratio) ||
        element.height !== Math.round(height * ratio)
      ) {
        element.width = Math.round(width * ratio);
        element.height = Math.round(height * ratio);
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);

      const data = props.current.getPoints();
      const end = Math.max(
        data.Left[data.Left.length - 1]?.tMs ?? 0,
        data.Right[data.Right.length - 1]?.tMs ?? 0,
      );
      const start = Math.max(0, end - 10_000);
      const finish = Math.max(10_000, end);
      const left = 54;
      const right = width - 14;
      const top = 38;
      const bottom = height - 24;
      const columnGap = 12;
      const rowGap = 30;
      const panelWidth = (right - left - columnGap * 2) / 3;
      const panelHeight = (bottom - top - rowGap) / 2;

      const x = (tMs: number) =>
        left + ((tMs - start) / Math.max(1, finish - start)) * (right - left);

      const rows = [
        { field: 'accel' as const, label: 'Acceleration', fallback: 12 },
        { field: 'gyro' as const, label: 'Angular speed', fallback: 1 },
      ];
      const axes = ['X', 'Y', 'Z'];
      const lines = FEET.map((foot) => ({
        foot,
        points: data[foot]
          .filter((point) => point.tMs >= start && point.tMs <= finish)
          .map((point) => {
            const imu = readImus(point.imus)[sensorIndex];
            const raw = imu.status === 'valid' ? imu.raw : undefined;
            return { point, accel: raw?.accel ?? null, gyro: raw?.gyro ?? null };
          }),
      }));

      context.font = '12px system-ui, sans-serif';
      context.fillStyle = CHART_COLORS.movementText;

      for (const [rowIndex, row] of rows.entries()) {
        const panelTop = top + rowIndex * (panelHeight + rowGap);
        context.textAlign = 'right';
        context.font = '12px system-ui, sans-serif';
        context.fillText(row.label, left - 8, panelTop + 12);

        for (const [axisIndex, axis] of axes.entries()) {
          const panelLeft = left + axisIndex * (panelWidth + columnGap);
          const values: number[] = [];
          for (const line of lines) {
            for (const item of line.points) {
              const vector = item[row.field];
              if (!vector) continue;
              const value = vector[axisIndex];
              if (Number.isFinite(value)) values.push(value);
            }
          }
          let low = values.length ? Math.min(...values) : -row.fallback;
          let high = values.length ? Math.max(...values) : row.fallback;
          if (high - low < 0.1) {
            const middle = (high + low) / 2;
            low = middle - 0.05;
            high = middle + 0.05;
          }
          const y = (value: number) =>
            panelTop + panelHeight - ((value - low) / (high - low)) * panelHeight;

          context.strokeStyle = CHART_COLORS.movementFrame;
          context.lineWidth = 1;
          context.strokeRect(panelLeft, panelTop, panelWidth, panelHeight);
          context.fillStyle = CHART_COLORS.movementText;
          context.textAlign = 'left';
          context.font = '600 12px system-ui, sans-serif';
          context.fillText(axis, panelLeft + 6, panelTop + 14);

          if (low < 0 && high > 0) {
            context.strokeStyle = CHART_COLORS.gridLine;
            context.beginPath();
            context.moveTo(panelLeft, y(0));
            context.lineTo(panelLeft + panelWidth, y(0));
            context.stroke();
          }

          if (!values.length) {
            context.fillStyle = CHART_COLORS.axisText;
            context.textAlign = 'center';
            context.font = '12px system-ui, sans-serif';
            context.fillText('No data', panelLeft + panelWidth / 2, panelTop + panelHeight / 2);
            continue;
          }

          for (const { foot, points } of lines) {
            context.beginPath();
            let last: number | null = null;
            for (const item of points) {
              const vector = item[row.field];
              const value = vector?.[axisIndex];
              if (!vector || value === undefined || !Number.isFinite(value)) {
                last = null;
                continue;
              }
              const px = x(item.point.tMs);
              const py = y(value);
              if (
                last === null ||
                item.point.breakBefore ||
                item.point.tMs - last > 30 ||
                item.point.tMs <= last
              )
                context.moveTo(px, py);
              else context.lineTo(px, py);
              last = item.point.tMs;
            }
            context.strokeStyle = FOOT_COLORS[foot];
            context.lineWidth = 1.6;
            context.setLineDash(FOOT_DASH[foot]);
            context.stroke();
            context.setLineDash([]);
          }
          context.fillStyle = CHART_COLORS.movementText;
          context.font = '10px system-ui, sans-serif';
          context.textAlign = 'left';
          context.fillText(high.toFixed(1), panelLeft + 4, panelTop + 26);
          context.fillText(low.toFixed(1), panelLeft + 4, panelTop + panelHeight - 4);
        }
      }

      context.fillStyle = CHART_COLORS.movementText;
      context.font = '12px system-ui, sans-serif';
      context.textAlign = 'left';
      context.fillText(`${(start / 1000).toFixed(2)} s`, left, height - 8);
      context.textAlign = 'right';
      context.fillText(`${(finish / 1000).toFixed(2)} s`, right, height - 8);
      context.textAlign = 'left';
      context.fillText(
        props.current.units === 'physical'
          ? 'Acceleration m/s² · angular speed rad/s'
          : 'Acceleration and angular-speed units unknown',
        left,
        20,
      );

      if (now - lastStatus > 500) {
        lastStatus = now;
        const anyValid = lines.some((line) =>
          line.points.some((item) => (item.accel || item.gyro) !== null),
        );
        setEmpty(!anyValid);
        setStatus(
          FEET.map((foot) => {
            const points = data[foot];
            const latest = points[points.length - 1];
            const imu = latest ? readImus(latest.imus)[sensorIndex] : null;
            return `${foot}: ${imu?.status ?? 'no sample'}`;
          }).join(' · '),
        );
      }
    }

    request = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(request);
  }, [sensor, maxFps]);

  return (
    <Paper
      withBorder
      p="md"
      radius="md"
      component="section"
      aria-label="All movement sensor axes"
    >
      <Stack gap="sm">
        <Group justify="space-between" wrap="wrap">
          <Title order={4}>Movement sensor axes</Title>
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
        <Group gap="md" wrap="wrap">
          <FootLegend foot="Left" />
          <FootLegend foot="Right" />
          <Text size="xs" c="dimmed">
            X/Y/Z are the sensor-frame axes. All three axes are shown for both feet.
          </Text>
        </Group>
        {empty ? (
          <Text size="sm" fw={600}>
            No usable movement-sensor samples from sensor {sensor} in this window.
          </Text>
        ) : (
          <canvas
            ref={canvas}
            width={960}
            height={420}
            role="img"
            aria-label="Acceleration and angular speed for all three sensor axes, left solid and right dashed"
            style={{ width: '100%', height: 420, display: 'block' }}
          />
        )}
        <Text role="status" size="xs">
          {status}
        </Text>
      </Stack>
    </Paper>
  );
}
