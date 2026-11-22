import { Text } from '@mantine/core';
import { useEffect, useRef } from 'react';

import type { Foot } from '../foot';
import { CHART_COLORS, FOOT_COLORS } from '../tokens';
import { InsoleDiagram } from './InsoleDiagram';
import { outlineFor } from './layout';
import type { SensorInsoleLayout } from './layout';
import { signalColor, signalRGB } from './signal';

import classes from './dynamic.module.css';

const W = 76,
  H = 200;
const kernels = new WeakMap<SensorInsoleLayout, { indices: Uint8Array; weights: Float32Array }>();
/** Local physical-pad Gaussian field. No electrical-grid interpolation. */
function kernel(layout: SensorInsoleLayout) {
  let saved = kernels.get(layout);
  if (saved) return saved;
  const indices = new Uint8Array(W * H * 16),
    weights = new Float32Array(W * H * 16);
  for (let r = 0; r < H; r++)
    for (let c = 0; c < W; c++) {
      const x = (c / (W - 1)) * layout.width,
        y = (1 - r / (H - 1)) * layout.length;
      const near = layout.pads
        .map((pad, i) => ({ i, d: (pad.x - x) ** 2 + (pad.y - y) ** 2 }))
        // Fresh scratch array; ES2020 targets do not provide toSorted().
        // oxlint-disable-next-line unicorn/no-array-sort
        .sort((a, b) => a.d - b.d)
        .slice(0, 16);
      const sum = near.reduce((s, p) => s + Math.exp(-p.d / (2 * 14 ** 2)), 0);
      near.forEach((p, n) => {
        const i = (r * W + c) * 16 + n;
        indices[i] = p.i;
        weights[i] = Math.exp(-p.d / (2 * 14 ** 2)) / sum;
      });
    }
  saved = { indices, weights };
  kernels.set(layout, saved);
  return saved;
}

/**
 * Mapped pad values on the physical insole. Internal: reached only through `PressureField`,
 * which supplies values solely for a confirmed, source-bound mapping. The SVG supplies the
 * shape/pads; this canvas adds a smooth field and signal path.
 */
export function PressureInsole({
  foot,
  layout,
  values,
  mode,
  showValues,
  showTrail,
  timeMs = 0,
  live = false,
  message,
  height = 380,
}: {
  foot: Foot;
  layout: SensorInsoleLayout;
  values: readonly (number | null)[] | null;
  mode: string;
  showValues: boolean;
  showTrail: boolean;
  timeMs?: number;
  live?: boolean;
  message: string;
  height?: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef({ values, mode, showTrail, timeMs, live });
  latest.current = { values, mode, showTrail, timeMs, live };
  useEffect(() => {
    const buffer = document.createElement('canvas');
    buffer.width = W;
    buffer.height = H;
    const offscreen = buffer.getContext('2d')!;
    const image = offscreen.createImageData(W, H);
    let animation = 0,
      last = -Infinity,
      previousTime = -Infinity;
    let trail: { x: number; y: number; t: number }[] = [];
    function draw(now: number) {
      animation = requestAnimationFrame(draw);
      if (now - last < 1000 / 30) return;
      last = now;
      const el = canvas.current,
        ctx = el?.getContext('2d');
      if (!el || !ctx) return;
      const width = el.clientWidth,
        height = el.clientHeight,
        ratio = devicePixelRatio || 1;
      if (!width || !height) return;
      if (el.width !== Math.round(width * ratio) || el.height !== Math.round(height * ratio)) {
        el.width = Math.round(width * ratio);
        el.height = Math.round(height * ratio);
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const p = latest.current;
      if (!p.values) {
        trail = [];
        return;
      }
      const scale = Math.min(width / (layout.width + 8), height / (layout.length + 8));
      ctx.translate((width - layout.width * scale) / 2, (height - layout.length * scale) / 2);
      ctx.scale(scale, scale);
      if (p.mode === 'smooth') {
        const { indices, weights } = kernel(layout);
        for (let pixel = 0; pixel < W * H; pixel++) {
          let signal = 0;
          for (let j = 0; j < 16; j++)
            signal += (p.values[indices[pixel * 16 + j]] ?? 0) * weights[pixel * 16 + j];
          image.data.set(signalRGB(signal), pixel * 4);
          image.data[pixel * 4 + 3] = Math.round(Math.min(1, signal / 80) * 255);
        }
        offscreen.putImageData(image, 0, 0);
        ctx.save();
        ctx.beginPath();
        outlineFor(layout, foot).forEach(([x, y], i) => {
          if (!i) ctx.moveTo(x, layout.length - y);
          else ctx.lineTo(x, layout.length - y);
        });
        ctx.closePath();
        ctx.clip();
        if (foot === 'Right') {
          ctx.translate(layout.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(buffer, 0, 0, layout.width, layout.length);
        ctx.restore();
      }
      let total = 0,
        cx = 0,
        cy = 0;
      layout.pads.forEach((pad, i) => {
        const value = Math.max(0, p.values![i] ?? 0);
        total += value;
        cx += pad.x * value;
        cy += pad.y * value;
      });
      if (total <= 0 || p.timeMs < previousTime || p.timeMs - previousTime > 300) trail = [];
      if (total > 0 && p.timeMs !== previousTime)
        trail.push({
          x: foot === 'Right' ? layout.width - cx / total : cx / total,
          y: layout.length - cy / total,
          t: p.timeMs,
        });
      previousTime = p.timeMs;
      trail = trail.filter((point) => point.t >= p.timeMs - 650).slice(-40);
      if (p.showTrail && total > 0 && trail.length) {
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = 0.9;
        trail.slice(1).forEach((point, i) => {
          ctx.beginPath();
          ctx.moveTo(trail[i].x, trail[i].y);
          ctx.lineTo(point.x, point.y);
          ctx.strokeStyle = `rgba(${CHART_COLORS.pathRgb},${0.15 + (0.7 * i) / trail.length})`;
          ctx.stroke();
        });
        const point = trail[trail.length - 1];
        ctx.beginPath();
        ctx.arc(point.x, point.y, 1.7, 0, Math.PI * 2);
        ctx.fillStyle = CHART_COLORS.pathPoint;
        ctx.fill();
        ctx.lineWidth = 0.8;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
      }
    }
    animation = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animation);
  }, [layout, foot]);
  return (
    <div className={classes.map}>
      <div
        className={classes.insoleStage}
        style={height === 380 ? undefined : { height }}
        data-smooth={!!values && mode === 'smooth'}
      >
        <InsoleDiagram
          layout={layout}
          foot={foot}
          maxHeight={height}
          title={`${foot} sensor insole · ${message}`}
          padFill={
            values && mode !== 'smooth'
              ? (pad) => signalColor(values[pad.pad - 1] ?? 0)
              : values
                ? () => 'transparent'
                : undefined
          }
          padLabel={
            showValues && values && mode !== 'smooth'
              ? (pad) => values[pad.pad - 1]?.toFixed(0)
              : undefined
          }
        />
        <canvas
          ref={canvas}
          className={classes.insoleCanvas}
          role="img"
          aria-label={`${foot} ${mode === 'smooth' ? 'interpolated pressure field' : 'signal centroid path'}${values ? '' : ', no mapped data'}`}
        />
      </div>
      <Text
        size="xs"
        fw={650}
        c={FOOT_COLORS[foot]}
        mt={8}
        tt="uppercase"
        style={{ letterSpacing: '0.08em' }}
      >
        {foot} · 64 sensors
      </Text>
      {!values && (
        <Text size="xs" c="dimmed" mt={4}>
          {message}
        </Text>
      )}
    </div>
  );
}
