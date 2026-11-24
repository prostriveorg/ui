import { Group, Text, Title } from '@mantine/core';
import { useEffect, useRef } from 'react';

import { FEET } from '../foot';
import type { Foot } from '../foot';
import { unitsCaption } from '../format';
import { CHART_COLORS, FOOT_COLORS, FOOT_DASH } from '../tokens';
import { PREVIEW_WINDOW_MS, STALE_AFTER_MS } from './preview';
import type { PreviewSeries } from './preview';

import classes from './dynamic.module.css';

/** Legend swatch drawn with the same stroke style as the chart line. */
export function FootLegend({ foot }: { foot: Foot }) {
  return (
    <Group gap={6} wrap="nowrap">
      <svg width="26" height="10" aria-hidden="true">
        <line
          x1="1"
          x2="25"
          y1="5"
          y2="5"
          stroke={FOOT_COLORS[foot]}
          strokeWidth="2.5"
          strokeDasharray={FOOT_DASH[foot].join(' ') || undefined}
        />
      </svg>
      <Text size="sm" fw={600} c={FOOT_COLORS[foot]}>
        {foot}
      </Text>
    </Group>
  );
}

/**
 * Ten seconds of each foot's mean channel signal from the read-only preview stream. Time follows
 * the box sample timestamps; traces break where the live view broke. Box-stamped markers share the
 * same clock. Redraws at most `maxFps` (default 30) without re-rendering React.
 */
export function LiveSignalPlot({
  preview,
  units,
  height = 190,
  title = 'Mean channel signal',
  markers = [],
  bare = false,
  maxFps = 30,
  fill = false,
}: {
  /** Per-foot preview series; read on each animation frame, never copied into React state. */
  preview: Readonly<Record<Foot, PreviewSeries>>;
  /** Recorded pressure units, or `unknown units`. */
  units: string;
  height?: number;
  title?: string;
  /** Box-stamped markers; drawn when inside the preview window. */
  markers?: readonly { timestampNs: string; label: string }[];
  /** Without the card frame, for embedding. */
  bare?: boolean;
  /** Canvas redraw ceiling. Lower it for a busy web page; kiosk views can use 60. */
  maxFps?: number;
  /** Stretch the canvas to the caller's height instead of using the `height` prop. */
  fill?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const markerRef = useRef(markers);
  markerRef.current = markers;
  useEffect(() => {
    let animation = 0;
    let previous = -Infinity;
    function draw(now: number) {
      animation = requestAnimationFrame(draw);
      if (now - previous < 1000 / Math.max(1, maxFps)) return;
      previous = now;
      const element = canvas.current;
      const context = element?.getContext('2d');
      if (!element || !context || !element.clientWidth) return;
      const width = element.clientWidth;
      const renderedHeight = fill ? element.clientHeight : height;
      if (!renderedHeight) return;
      const ratio = window.devicePixelRatio || 1;
      if (
        element.width !== Math.round(width * ratio) ||
        element.height !== Math.round(renderedHeight * ratio)
      ) {
        element.width = Math.round(width * ratio);
        element.height = Math.round(renderedHeight * ratio);
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, renderedHeight);
      const series = FEET.map((foot) => {
        const buffer = preview[foot];
        const fresh = !!buffer.latest && now - buffer.latest.receivedAt <= STALE_AFTER_MS;
        return { foot, buffer, points: fresh ? buffer.points(now) : [] };
      });
      // A shared time origin: the newest timestamp of either foot.
      let endNs = 0n;
      for (const { points } of series) {
        const last = points[points.length - 1];
        if (last && BigInt(last.timestampNs) > endNs) endNs = BigInt(last.timestampNs);
      }
      let peak = 0;
      for (const { points } of series)
        for (const point of points) peak = Math.max(peak, point.mean);
      peak = peak > 0 ? peak * 1.1 : 1;
      const left = 52,
        right = width - 14,
        top = 12,
        bottom = renderedHeight - 28;
      const x = (ageMs: number) => right - (ageMs / PREVIEW_WINDOW_MS) * (right - left);
      const y = (value: number) => bottom - (Math.max(0, value) / peak) * (bottom - top);
      context.font = '12px system-ui, sans-serif';
      context.fillStyle = CHART_COLORS.axisText;
      context.strokeStyle = CHART_COLORS.gridLine;
      context.lineWidth = 1;
      for (const fraction of [0, 0.5, 1]) {
        context.beginPath();
        context.moveTo(left, y(fraction * peak));
        context.lineTo(right, y(fraction * peak));
        context.stroke();
        context.textAlign = 'right';
        context.fillText(
          Number((fraction * peak).toPrecision(3)).toString(),
          left - 8,
          y(fraction * peak) + 4,
        );
      }
      for (const seconds of [10, 8, 6, 4, 2, 0]) {
        context.textAlign = seconds === 10 ? 'left' : seconds === 0 ? 'right' : 'center';
        context.fillText(seconds ? `−${seconds} s` : 'now', x(seconds * 1000), renderedHeight - 8);
      }
      if (endNs > 0n)
        for (const marker of markerRef.current) {
          const age = Number(endNs - BigInt(marker.timestampNs)) / 1e6;
          if (age < 0 || age > PREVIEW_WINDOW_MS) continue;
          context.strokeStyle = CHART_COLORS.marker;
          context.setLineDash([3, 3]);
          context.beginPath();
          context.moveTo(x(age), top);
          context.lineTo(x(age), bottom);
          context.stroke();
          context.setLineDash([]);
          context.fillStyle = CHART_COLORS.markerText;
          context.textAlign = age > PREVIEW_WINDOW_MS * 0.85 ? 'left' : 'right';
          context.fillText(
            marker.label,
            x(age) + (context.textAlign === 'left' ? 4 : -4),
            top + 10,
          );
        }
      for (const { foot, points } of series) {
        context.beginPath();
        let penDown = false;
        for (const point of points) {
          const age = Number(endNs - BigInt(point.timestampNs)) / 1e6;
          if (age < 0 || age > PREVIEW_WINDOW_MS) {
            penDown = false;
            continue;
          }
          if (!penDown || point.breakBefore) context.moveTo(x(age), y(point.mean));
          else context.lineTo(x(age), y(point.mean));
          penDown = true;
        }
        context.strokeStyle = FOOT_COLORS[foot];
        context.lineWidth = 2;
        context.lineJoin = 'round';
        context.setLineDash(FOOT_DASH[foot]);
        context.stroke();
        context.setLineDash([]);
      }
      if (series.every(({ points }) => !points.length)) {
        context.fillStyle = CHART_COLORS.axisText;
        context.textAlign = 'center';
        context.font = '14px system-ui, sans-serif';
        context.fillText('No live preview samples', (left + right) / 2, (top + bottom) / 2);
      }
    }
    animation = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animation);
  }, [preview, height, maxFps, fill]);
  const body = (
    <div
      style={
        fill
          ? { height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }
          : undefined
      }
    >
      <Group justify="space-between" mb={4} wrap="wrap" gap="xs">
        <Group gap="xs" align="baseline">
          <Title order={4}>{title}</Title>
          <Text size="sm" c="dimmed">
            Mean of 64 channels · {unitsCaption(units)} · preview, last 10 s
          </Text>
        </Group>
        <Group gap="md">
          {FEET.map((foot) => (
            <FootLegend key={foot} foot={foot} />
          ))}
        </Group>
      </Group>
      <canvas
        ref={canvas}
        role="img"
        aria-label="Left (solid) and right (dashed) mean channel signal over the last ten seconds of live preview. Breaks are preview gaps."
        style={{
          width: '100%',
          height: fill ? 0 : height,
          display: 'block',
          flex: fill ? 1 : undefined,
          minHeight: fill ? 0 : undefined,
        }}
      />
    </div>
  );
  return bare ? (
    <div style={fill ? { height: '100%', minHeight: 0 } : undefined}>{body}</div>
  ) : (
    <section
      className={classes.chartCard}
      aria-label="Live signal over time"
      style={
        fill
          ? { height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }
          : undefined
      }
    >
      {body}
    </section>
  );
}
