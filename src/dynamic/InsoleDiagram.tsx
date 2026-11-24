import type { CSSProperties } from 'react';

import type { Foot } from '../foot';
import { outlineFor, padPosition } from './layout';
import type { InsolePad, SensorInsoleLayout } from './layout';

const MARGIN = 4;

/**
 * Insole seen from above, toes up, drawn from the physical layout. Purely presentational:
 * callers decide each pad's fill and label, so it never maps channels by itself.
 */
export function InsoleDiagram({
  layout,
  foot,
  padFill,
  padLabel,
  highlightPad,
  onPadClick,
  maxHeight = 420,
  title,
  style,
}: {
  layout: SensorInsoleLayout;
  foot: Foot;
  padFill?: (pad: InsolePad) => string | undefined;
  padLabel?: (pad: InsolePad) => string | undefined;
  highlightPad?: number | null;
  onPadClick?: (pad: number) => void;
  maxHeight?: number;
  title: string;
  /** Caller-controlled sizing; useful for a card that fills a fixed row. */
  style?: CSSProperties;
}) {
  const flipY = (y: number) => layout.length - y;
  const outline = outlineFor(layout, foot)
    .map(([x, y]) => `${x},${flipY(y)}`)
    .join(' ');
  const half = layout.padSize / 2;
  return (
    <svg
      viewBox={`${-MARGIN} ${-MARGIN} ${layout.width + MARGIN * 2} ${layout.length + MARGIN * 2}`}
      role="img"
      aria-label={title}
      style={{ display: 'block', width: '100%', maxHeight, margin: '0 auto', ...style }}
    >
      <polygon
        points={outline}
        fill="var(--mantine-color-gray-1)"
        stroke="var(--mantine-color-gray-5)"
        strokeWidth={0.8}
      />
      {layout.pads.map((pad) => {
        const { x, y } = padPosition(layout, pad, foot);
        const highlighted = pad.pad === highlightPad;
        const label = padLabel?.(pad);
        return (
          <g
            key={pad.pad}
            onClick={onPadClick ? () => onPadClick(pad.pad) : undefined}
            style={onPadClick ? { cursor: 'pointer' } : undefined}
          >
            <rect
              x={x - half}
              y={flipY(y) - half}
              width={layout.padSize}
              height={layout.padSize}
              rx={1}
              fill={padFill?.(pad) ?? 'var(--mantine-color-white)'}
              stroke={
                highlighted ? 'var(--mantine-color-primary-6)' : 'var(--mantine-color-gray-5)'
              }
              strokeWidth={highlighted ? 1.8 : 0.5}
            />
            {label && (
              <text
                x={x}
                y={flipY(y) + 1.4}
                textAnchor="middle"
                fontSize={4}
                fontWeight={600}
                fill="var(--mantine-color-dark-7)"
                pointerEvents="none"
              >
                {label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
