'use client';

import { useMemo, useRef, useState } from 'react';
import { CHART_INK } from '@/lib/palette';

export interface TrendSeries {
  id: string;
  name: string;
  color: string;
  values: number[]; // one per period, same order as `periods`
}

interface Props {
  periods: string[];
  series: TrendSeries[];
  formatValue: (v: number) => string;
  formatAxis: (v: number) => string;
  height?: number;
}

const PAD = { top: 16, right: 16, bottom: 28, left: 64 };

/** Multi-series line chart with a crosshair + shared tooltip. */
export default function TrendChart({ periods, series, formatValue, formatAxis, height = 280 }: Props) {
  const width = 760;
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { min, max, ticks } = useMemo(() => {
    const all = series.flatMap(s => s.values);
    const rawLo = Math.min(0, ...all);
    let lo = rawLo;
    let hi = Math.max(0, ...all);
    if (lo === hi) { hi = lo + 1; }
    const span = hi - lo;
    // Only pad below the axis when the data actually goes negative — otherwise
    // a positive-only series gets a misleading sub-zero floor.
    if (rawLo < 0) lo -= span * 0.05;
    hi += span * 0.08;
    const step = (hi - lo) / 4;
    return { min: lo, max: hi, ticks: [0, 1, 2, 3, 4].map(i => lo + step * i) };
  }, [series]);

  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;

  const x = (i: number) => PAD.left + (periods.length <= 1 ? innerW / 2 : (i / (periods.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - ((v - min) / (max - min)) * innerH;

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    const ratio = (relX - PAD.left) / innerW;
    const idx = Math.round(ratio * (periods.length - 1));
    setHoverIndex(Math.max(0, Math.min(periods.length - 1, idx)));
  }

  // Label every other period when they'd otherwise collide.
  const labelEvery = periods.length > 8 ? 2 : 1;

  return (
    <div className="w-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIndex(null)}
        role="img"
        aria-label={`Trend over ${periods.length} periods for ${series.map(s => s.name).join(', ')}`}
      >
        {/* Recessive gridlines + value axis */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={CHART_INK.grid} strokeWidth={1} />
            <text x={PAD.left - 10} y={y(t) + 4} textAnchor="end" fontSize={11} fill={CHART_INK.muted}>
              {formatAxis(t)}
            </text>
          </g>
        ))}

        {/* Zero baseline, emphasized when the range crosses it */}
        {min < 0 && max > 0 && (
          <line x1={PAD.left} x2={width - PAD.right} y1={y(0)} y2={y(0)} stroke={CHART_INK.secondary} strokeWidth={1} />
        )}

        {/* Period axis */}
        {periods.map((p, i) => (
          i % labelEvery === 0 ? (
            <text key={p} x={x(i)} y={height - 8} textAnchor="middle" fontSize={11} fill={CHART_INK.muted}>
              {p.slice(2)}
            </text>
          ) : null
        ))}

        {/* Crosshair */}
        {hoverIndex !== null && (
          <line
            x1={x(hoverIndex)} x2={x(hoverIndex)} y1={PAD.top} y2={PAD.top + innerH}
            stroke={CHART_INK.secondary} strokeWidth={1} strokeDasharray="3 3"
          />
        )}

        {/* Series lines — 2px, round joins */}
        {series.map(s => (
          <path
            key={s.id}
            d={s.values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ')}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {/* Hover markers — surface ring keeps overlapping marks readable */}
        {hoverIndex !== null && series.map(s => (
          <circle
            key={s.id}
            cx={x(hoverIndex)}
            cy={y(s.values[hoverIndex])}
            r={5}
            fill={s.color}
            stroke={CHART_INK.surface}
            strokeWidth={2}
          />
        ))}
      </svg>

      {/* Tooltip as HTML below the plot — avoids clipping and stays readable */}
      <div className="mt-2 min-h-[2.5rem]">
        {hoverIndex !== null ? (
          <div className="rounded-[var(--radius-panel)] border-2 border-border bg-surface-lit px-3 py-2 shadow-sm">
            <div className="text-xs font-semibold text-text-primary mb-1">{periods[hoverIndex]}</div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {series.map(s => (
                <span key={s.id} className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  {s.name}
                  <span className="font-medium text-text-primary">{formatValue(s.values[hoverIndex])}</span>
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-text-tertiary">Hover the chart for period detail.</p>
        )}
      </div>

      {/* Legend — always present for 2+ series, so identity is never colour alone */}
      {series.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {series.map(s => (
            <span key={s.id} className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
