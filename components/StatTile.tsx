import { cn } from '@/lib/cn';

interface Props {
  label: string;
  value: string;
  sublabel?: string;
  tone?: 'neutral' | 'positive' | 'negative';
  hero?: boolean;
}

/**
 * A headline number. A stat tile rather than a one-bar chart — these are single
 * values, and a bar of one tells the reader nothing a number doesn't.
 */
export default function StatTile({ label, value, sublabel, tone = 'neutral', hero }: Props) {
  return (
    <div className="rounded-[var(--radius-tin)] border-2 border-border bg-surface p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-text-tertiary">{label}</div>
      <div
        className={cn(
          'mt-1.5 font-semibold tabular-nums',
          hero ? 'text-3xl' : 'text-2xl',
          tone === 'positive' && 'text-success',
          tone === 'negative' && 'text-danger',
          tone === 'neutral' && 'text-text-primary',
        )}
      >
        {value}
      </div>
      {sublabel && <div className="mt-1 text-xs text-text-secondary">{sublabel}</div>}
    </div>
  );
}
