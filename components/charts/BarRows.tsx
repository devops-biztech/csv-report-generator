'use client';

import { useState } from 'react';
import { CHART_INK } from '@/lib/palette';

export interface BarRow {
  id: string;
  label: string;
  value: number;
  color: string;
  secondary?: string; // optional context line under the label
}

interface Props {
  rows: BarRow[];
  formatValue: (v: number) => string;
  /** Rows are always direct-labelled, which satisfies the relief rule for
   *  palette slots that sit below 3:1 against the surface. */
  ariaLabel: string;
}

/**
 * Horizontal bars for magnitude comparison. Horizontal because the labels are
 * long-named entities; 4px rounded data-ends anchored to the baseline, with a
 * 2px surface gap between adjacent fills.
 */
export default function BarRows({ rows, formatValue, ariaLabel }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const max = Math.max(1, ...rows.map(r => Math.abs(r.value)));

  return (
    <div className="space-y-2.5" role="img" aria-label={ariaLabel}>
      {rows.map(row => {
        const pct = (Math.abs(row.value) / max) * 100;
        const active = hovered === row.id;
        return (
          <div
            key={row.id}
            className="group"
            onMouseEnter={() => setHovered(row.id)}
            onMouseLeave={() => setHovered(null)}
          >
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <span className="text-sm text-text-primary truncate">
                {row.label}
                {row.secondary && (
                  <span className="ml-2 text-xs text-text-tertiary">{row.secondary}</span>
                )}
              </span>
              <span className="text-sm font-medium tabular-nums text-text-primary shrink-0">
                {formatValue(row.value)}
              </span>
            </div>
            <div
              className="h-2.5 w-full rounded-full"
              style={{ background: CHART_INK.grid }}
            >
              <div
                className="h-2.5 rounded-full transition-[width,opacity] duration-200"
                style={{
                  width: `${Math.max(pct, 1.5)}%`,
                  background: row.color,
                  opacity: hovered && !active ? 0.55 : 1,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
