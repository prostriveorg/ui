import { Group, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { useEffect, useRef, useState } from 'react';

import { FEET } from '../foot';
import { CHART_COLORS, FOOT_COLORS, FOOT_DASH } from '../tokens';
import { magnitude, readImus } from './imu';
import type { ImuPoints } from './imu';
import { FootLegend } from './LiveSignalPlot';

type Metric = 'accel' | 'gyro' | 'mag';

const METRICS: readonly {
  key: Metric;
  label: string;
  short: string;
  unit: (physical: boolean) => string;
}[] = [
  {
    key: 'accel',
    label: 'Acceleration magnitude',
    short: 'Accel',
    unit: (physical) => (physical ? 'm/s²' : 'units unknown'),
  },
  {
    key: 'gyro',
    label: 'Angular speed magnitude',
    short: 'Gyro',
    unit: (physical) => (physical ? 'rad/s' : 'units unknown'),
  },
  {
    key: 'mag',
    label: 'Magnetic field magnitude',
    short: 'Mag',
    unit: () => 'units unknown',
  },
];

/**
 * Three compact magnitude traces for one movement sensor: acceleration, angular speed and
 * magnetic field. Left is solid, right dashed. This is a technician overview; per-axis detail
 * remains available in `ImuSignals` and `ImuAxes`.
 */
export function ImuMagnitudes({
  getPoints,
  sensor = '0',
  units = 'unknown',
  maxFps = 30,
  fragment = false,
}: {
  /** Read on each animation frame; return bounded live or replay points. */
  getPoints: () => ImuPoints;
  /** Movement sensor index (`0` or `1`). */
  sensor?: string;
  /** `physical` only when validated source metadata declares m/s² and rad/s. */
  units?: 'physical' | 'unknown';
  /** Canvas redraw ceiling. Lower it for a busy page; kiosk views can use 60. */
  maxFps?: number;
  /** Return the three cards as grid children instead of wrapping them in a row. */
  fragment?: boolean;
}) {
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);
  const [empty, setEmpty] = useState(false);
  const props = useRef({ getPoints, units });
  props.current = { getPoints, units };

  useEffect(() => {
    let request = 0;
    let previous = -Infinity;
    let lastEmpty: boolean | null = null;
    const sensorIndex = Number(sensor);

    function draw(now: number) {
      request = requestAnimationFrame(draw);
      if (now - previous < 1000 / Math.max(1, maxFps)) return;
      previous = now;

      const data = props.current.getPoints();
      const end = Math.max(
        data.Left[data.Left.length - 1]?.tMs ?? 0,
        data.Right[data.Right.length - 1]?.tMs ?? 0,
      );
      const start = Math.max(0, end - 10_000);
      const finish = Math.max(10_000, end);
      const lines = FEET.map((foot) => ({
        foot,
        points: data[foot]
          .filter((point) => point.tMs >= start && point.tMs <= finish)
          .map((point) => {
            const imu = readImus(point.imus)[sensorIndex];
            const raw = imu.status === 'valid' ? imu.raw : undefined;
            return {
              tMs: point.tMs,
              breakBefore: point.breakBefore,
              accel: raw ? magnitude(raw.accel) : null,
              gyro: raw ? magnitude(raw.gyro) : null,
              mag: raw ? magnitude(raw.mag) : null,
            };
          }),
      }));
      const any = lines.some((line) =>
        line.points.some(
          (point) => point.accel !== null || point.gyro !== null || point.mag !== null,
        ),
      );
      if (any !== lastEmpty) {
        lastEmpty = any;
        setEmpty(!any);
      }

      for (const [index, metric] of METRICS.entries()) {
        const element = canvases.current[index];
        const context = element?.getContext('2d');
        if (!element || !context || !element.clientWidth) continue;
        const width = Math.max(180, element.clientWidth);
        const height = Math.max(90, element.clientHeight);
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

        let high = 0;
        for (const line of lines)
          for (const point of line.points) high = Math.max(high, point[metric.key] ?? 0);
        high = Math.max(high * 1.1, metric.key === 'accel' ? 12 : 1);

        const left = 36;
        const right = width - 8;
        const top = 8;
        const bottom = height - 18;
        const x = (tMs: number) =>
          left + ((tMs - start) / Math.max(1, finish - start)) * (right - left);
        const y = (value: number) => bottom - (Math.max(0, value) / high) * (bottom - top);

        context.strokeStyle = CHART_COLORS.gridLine;
        context.lineWidth = 1;
        for (const fraction of [0, 0.5, 1]) {
          context.beginPath();
          context.moveTo(left, y(fraction * high));
          context.lineTo(right, y(fraction * high));
          context.stroke();
          context.fillStyle = CHART_COLORS.axisText;
          context.font = '10px system-ui, sans-serif';
          context.textAlign = 'right';
          context.fillText(
            Number((fraction * high).toPrecision(3)).toString(),
            left - 5,
            y(fraction * high) + 3,
          );
        }

        for (const { foot, points } of lines) {
          context.beginPath();
          let last: number | null = null;
          for (const point of points) {
            const value = point[metric.key];
            if (value === null) {
              last = null;
              continue;
            }
            if (last === null || point.breakBefore || point.tMs - last > 30)
              context.moveTo(x(point.tMs), y(value));
            else context.lineTo(x(point.tMs), y(value));
            last = point.tMs;
          }
          context.strokeStyle = FOOT_COLORS[foot];
          context.lineWidth = 1.8;
          context.setLineDash(FOOT_DASH[foot]);
          context.stroke();
          context.setLineDash([]);
        }

        if (!any) {
          context.fillStyle = CHART_COLORS.axisText;
          context.textAlign = 'center';
          context.font = '12px system-ui, sans-serif';
          context.fillText('No data', (left + right) / 2, (top + bottom) / 2);
        }

        context.fillStyle = CHART_COLORS.movementText;
        context.font = '10px system-ui, sans-serif';
        context.textAlign = 'left';
        context.fillText(`${(start / 1000).toFixed(1)} s`, left, height - 4);
        context.textAlign = 'right';
        context.fillText('now', right, height - 4);
      }
    }

    request = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(request);
  }, [sensor, maxFps]);

  const cards = METRICS.map((metric, index) => (
    <Paper
      key={metric.key}
      withBorder
      p="xs"
      radius="md"
      style={{ minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <Group justify="space-between" gap="xs" wrap="nowrap">
        <Text size="xs" fw={700}>
          {metric.label}
        </Text>
        <Text size="10px" c="dimmed">
          {metric.unit(units === 'physical')}
        </Text>
      </Group>
      <div style={{ flex: 1, minHeight: 0 }}>
        <canvas
          ref={(node) => {
            canvases.current[index] = node;
          }}
          role="img"
          aria-label={`${metric.label}, left solid and right dashed`}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </div>
    </Paper>
  ));

  if (fragment) return <>{cards}</>;

  return (
    <Stack gap={4} style={{ height: '100%', minHeight: 0 }}>
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm" align="baseline">
          <Title order={3} size="h4">
            Movement magnitudes
          </Title>
          <Text size="xs" c="dimmed">
            IMU {Number(sensor)} · sensor-frame magnitude · last 10 s
          </Text>
        </Group>
        <Group gap="md">
          <FootLegend foot="Left" />
          <FootLegend foot="Right" />
        </Group>
      </Group>
      {empty && (
        <Text size="xs" fw={600}>
          No usable movement-sensor samples from IMU {Number(sensor)}.
        </Text>
      )}
      <SimpleGrid
        cols={3}
        spacing="sm"
        style={{ flex: 1, minHeight: 0, gridTemplateRows: 'minmax(0, 1fr)' }}
      >
        {cards}
      </SimpleGrid>
    </Stack>
  );
}
