'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Upload } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import StatTile from '@/components/StatTile';
import TrendChart, { type TrendSeries } from '@/components/charts/TrendChart';
import BarRows from '@/components/charts/BarRows';
import Card from '@/components/ui/Card';
import Select from '@/components/ui/Select';
import Skeleton from '@/components/ui/Skeleton';
import { formatCents, formatCentsCompact } from '@/lib/money';
import { entityColor, MAGNITUDE_FILL } from '@/lib/palette';

interface ReportData {
  empty: boolean;
  range: { from: string; to: string };
  totals: { revenueCents: number; expenseCents: number; netCents: number; transactionCount: number };
  byLocation: { locationId: number; name: string; code: string; revenueCents: number; expenseCents: number; netCents: number; transactionCount: number }[];
  byPeriod: { period: string; revenueCents: number; expenseCents: number; netCents: number }[];
  byPeriodLocation: { period: string; locationId: number; revenueCents: number; expenseCents: number; netCents: number }[];
  byCategory: { category: string; type: 'revenue' | 'expense'; amountCents: number; transactionCount: number }[];
  locations: { id: number; name: string; code: string }[];
  availablePeriods: string[];
}

type Measure = 'netCents' | 'revenueCents' | 'expenseCents';

const MEASURE_LABEL: Record<Measure, string> = {
  revenueCents: 'Revenue',
  netCents: 'Net',
  expenseCents: 'Expenses',
};

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [locationId, setLocationId] = useState('all');
  const [measure, setMeasure] = useState<Measure>('netCents');

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (locationId !== 'all') params.set('locationId', locationId);
    const res = await fetch(`/api/reports?${params}`);
    const json: ReportData = await res.json();
    setData(json);
    if (!from && json.range.from) setFrom(json.range.from);
    if (!to && json.range.to) setTo(json.range.to);
    setLoading(false);
  }, [from, to, locationId]);

  useEffect(() => { load(); }, [load]);

  const periods = useMemo(() => data?.byPeriod.map(p => p.period) ?? [], [data]);

  // One line per location, each keeping its own colour as filters change.
  const series = useMemo<TrendSeries[]>(() => {
    if (!data) return [];
    const order = data.locations.map(l => l.id);
    const shown = locationId === 'all' ? data.locations : data.locations.filter(l => String(l.id) === locationId);

    return shown.map(loc => ({
      id: String(loc.id),
      name: loc.name,
      color: entityColor(order.indexOf(loc.id)),
      values: periods.map(p => {
        const row = data.byPeriodLocation.find(r => r.period === p && r.locationId === loc.id);
        return row ? row[measure] : 0;
      }),
    }));
  }, [data, periods, measure, locationId]);

  const expenseCategories = useMemo(
    () => (data?.byCategory ?? []).filter(c => c.type === 'expense').sort((a, b) => b.amountCents - a.amountCents),
    [data]
  );
  const revenueCategories = useMemo(
    () => (data?.byCategory ?? []).filter(c => c.type === 'revenue').sort((a, b) => b.amountCents - a.amountCents),
    [data]
  );

  const margin = data && data.totals.revenueCents > 0
    ? (data.totals.netCents / data.totals.revenueCents) * 100
    : 0;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 space-y-4">
          <Skeleton className="h-10 w-72" />
          <div className="grid grid-cols-4 gap-4">
            {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-80" />
        </div>
      </DashboardLayout>
    );
  }

  if (!data || data.empty) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center p-6">
          <Card className="max-w-md p-8 text-center">
            <Upload className="mx-auto mb-3 text-text-tertiary" size={32} />
            <h2 className="font-display text-lg text-text-primary">No data yet</h2>
            <p className="mt-1.5 text-sm text-text-secondary">
              Import a CSV to start building consolidated reports across your locations.
            </p>
            <Link
              href="/import"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-ink hover:bg-primary-hover"
            >
              <Upload size={16} /> Import CSV
            </Link>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const scopeLabel = locationId === 'all'
    ? `All ${data.locations.length} locations`
    : data.locations.find(l => String(l.id) === locationId)?.name ?? '';

  return (
    <DashboardLayout>
      <div className="h-full overflow-y-auto p-6 space-y-5">
        {/* Header + filters, all in one row above the charts */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl text-text-primary">Consolidated Reports</h1>
            <p className="text-sm text-text-secondary">
              {scopeLabel} · {data.range.from} to {data.range.to} · {data.totals.transactionCount.toLocaleString()} transactions
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-44">
              <Select value={locationId} onChange={e => setLocationId(e.target.value)} aria-label="Location">
                <option value="all">All locations</option>
                {data.locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </Select>
            </div>
            <div className="w-32">
              <Select value={from} onChange={e => setFrom(e.target.value)} aria-label="From period">
                {data.availablePeriods.map(p => <option key={p} value={p}>{p}</option>)}
              </Select>
            </div>
            <span className="text-sm text-text-tertiary">to</span>
            <div className="w-32">
              <Select value={to} onChange={e => setTo(e.target.value)} aria-label="To period">
                {data.availablePeriods.map(p => <option key={p} value={p}>{p}</option>)}
              </Select>
            </div>
          </div>
        </div>

        {/* KPI row — single values belong in tiles, not one-bar charts */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Revenue" value={formatCents(data.totals.revenueCents)} tone="neutral" hero />
          <StatTile label="Expenses" value={formatCents(data.totals.expenseCents)} tone="neutral" hero />
          <StatTile
            label="Net"
            value={formatCents(data.totals.netCents)}
            tone={data.totals.netCents >= 0 ? 'positive' : 'negative'}
            hero
          />
          <StatTile label="Net Margin" value={`${margin.toFixed(1)}%`} sublabel="Net / revenue" hero />
        </div>

        {/* Trends */}
        <Card className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base text-text-primary">{MEASURE_LABEL[measure]} over time</h2>
              <p className="text-xs text-text-secondary">By location, {periods.length} periods</p>
            </div>
            <div className="flex gap-1 rounded-lg border border-border p-0.5">
              {(Object.keys(MEASURE_LABEL) as Measure[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMeasure(m)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    measure === m ? 'bg-primary text-ink' : 'text-text-secondary hover:bg-surface-secondary'
                  }`}
                >
                  {MEASURE_LABEL[m]}
                </button>
              ))}
            </div>
          </div>
          <TrendChart
            periods={periods}
            series={series}
            formatValue={formatCents}
            formatAxis={formatCentsCompact}
          />
        </Card>

        <div className="grid gap-5 xl:grid-cols-2">
          {/* Location comparison */}
          <Card className="p-5">
            <h2 className="font-display text-base text-text-primary">Location comparison</h2>
            <p className="mb-4 text-xs text-text-secondary">Net for the selected range</p>
            <BarRows
              ariaLabel="Net by location"
              rows={data.byLocation.map(l => ({
                id: String(l.locationId),
                label: l.name,
                value: l.netCents,
                color: entityColor(data.locations.findIndex(x => x.id === l.locationId)),
                secondary: l.revenueCents > 0 ? `${((l.netCents / l.revenueCents) * 100).toFixed(1)}% margin` : undefined,
              }))}
              formatValue={formatCents}
            />
          </Card>

          {/* Expense categories — magnitude, so one hue rather than categorical */}
          <Card className="p-5">
            <h2 className="font-display text-base text-text-primary">Expenses by category</h2>
            <p className="mb-4 text-xs text-text-secondary">Largest first</p>
            <BarRows
              ariaLabel="Expenses by category"
              rows={expenseCategories.map(c => ({
                id: c.category,
                label: c.category,
                value: c.amountCents,
                color: MAGNITUDE_FILL,
              }))}
              formatValue={formatCents}
            />
          </Card>
        </div>

        {/* Consolidated P&L — a table, because these are exact figures to read */}
        <Card className="p-5">
          <h2 className="font-display text-base text-text-primary">Consolidated P&amp;L</h2>
          <p className="mb-4 text-xs text-text-secondary">{scopeLabel} · {data.range.from} to {data.range.to}</p>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-border">
                <th colSpan={3} className="py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Revenue</th>
              </tr>
              {revenueCategories.map(c => (
                <tr key={c.category} className="border-b border-border/60">
                  <td className="py-1.5 text-text-primary">{c.category}</td>
                  <td className="py-1.5 text-right text-text-tertiary tabular-nums">{c.transactionCount.toLocaleString()}</td>
                  <td className="py-1.5 text-right tabular-nums text-text-primary">{formatCents(c.amountCents)}</td>
                </tr>
              ))}
              <tr className="border-b-2 border-border font-medium">
                <td className="py-2 text-text-primary">Total revenue</td>
                <td />
                <td className="py-2 text-right tabular-nums text-text-primary">{formatCents(data.totals.revenueCents)}</td>
              </tr>

              <tr className="border-b border-border">
                <th colSpan={3} className="pt-4 pb-2 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Expenses</th>
              </tr>
              {expenseCategories.map(c => (
                <tr key={c.category} className="border-b border-border/60">
                  <td className="py-1.5 text-text-primary">{c.category}</td>
                  <td className="py-1.5 text-right text-text-tertiary tabular-nums">{c.transactionCount.toLocaleString()}</td>
                  <td className="py-1.5 text-right tabular-nums text-text-primary">{formatCents(c.amountCents)}</td>
                </tr>
              ))}
              <tr className="border-b-2 border-border font-medium">
                <td className="py-2 text-text-primary">Total expenses</td>
                <td />
                <td className="py-2 text-right tabular-nums text-text-primary">{formatCents(data.totals.expenseCents)}</td>
              </tr>

              <tr className="text-base font-semibold">
                <td className="py-3 text-text-primary">Net</td>
                <td />
                <td className={`py-3 text-right tabular-nums ${data.totals.netCents >= 0 ? 'text-success' : 'text-danger'}`}>
                  {formatCents(data.totals.netCents)}
                </td>
              </tr>
            </tbody>
          </table>
        </Card>

        {/* Table view of the location data — the relief rule for palette slots
            that sit below 3:1 against the surface. */}
        <Card className="p-5">
          <h2 className="font-display text-base text-text-primary">Location detail</h2>
          <p className="mb-4 text-xs text-text-secondary">Same figures as the comparison chart, as a table</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-text-tertiary">
                <th className="py-2 text-left font-semibold">Location</th>
                <th className="py-2 text-right font-semibold">Revenue</th>
                <th className="py-2 text-right font-semibold">Expenses</th>
                <th className="py-2 text-right font-semibold">Net</th>
                <th className="py-2 text-right font-semibold">Margin</th>
              </tr>
            </thead>
            <tbody>
              {data.byLocation.map(l => (
                <tr key={l.locationId} className="border-b border-border/60">
                  <td className="py-2 text-text-primary">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ background: entityColor(data.locations.findIndex(x => x.id === l.locationId)) }}
                      />
                      {l.name}
                    </span>
                  </td>
                  <td className="py-2 text-right tabular-nums text-text-primary">{formatCents(l.revenueCents)}</td>
                  <td className="py-2 text-right tabular-nums text-text-primary">{formatCents(l.expenseCents)}</td>
                  <td className={`py-2 text-right tabular-nums ${l.netCents >= 0 ? 'text-success' : 'text-danger'}`}>
                    {formatCents(l.netCents)}
                  </td>
                  <td className="py-2 text-right tabular-nums text-text-secondary">
                    {l.revenueCents > 0 ? `${((l.netCents / l.revenueCents) * 100).toFixed(1)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </DashboardLayout>
  );
}
