'use client';

import { useCallback, useEffect, useState } from 'react';
import { Store, Plus } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { entityColor } from '@/lib/palette';

interface LocationRow {
  id: number;
  name: string;
  code: string;
  active: number;
  transactionCount: number;
  firstPeriod: string | null;
  lastPeriod: string | null;
}

export default function LocationsPage() {
  const [rows, setRows] = useState<LocationRow[]>([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/locations');
    setRows(await res.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  async function add() {
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, code }),
      });
      if (!res.ok) {
        setError((await res.json()).error ?? 'Could not add location');
        return;
      }
      setName('');
      setCode('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="h-full overflow-y-auto p-6 space-y-5">
        <div>
          <h1 className="font-display text-2xl text-text-primary">Locations</h1>
          <p className="text-sm text-text-secondary">
            The code is what the importer matches against the CSV&apos;s location column.
            Unrecognized codes create a new location automatically.
          </p>
        </div>

        <Card className="p-5">
          <h2 className="mb-3 font-display text-base text-text-primary">Add a location</h2>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-56">
              <label className="mb-1 block text-xs font-medium text-text-secondary">Name</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Downtown" />
            </div>
            <div className="w-32">
              <label className="mb-1 block text-xs font-medium text-text-secondary">Code</label>
              <Input value={code} onChange={e => setCode(e.target.value)} placeholder="DTN" />
            </div>
            <Button onClick={add} disabled={busy || !name.trim() || !code.trim()}>
              <span className="inline-flex items-center gap-1.5"><Plus size={16} /> Add</span>
            </Button>
          </div>
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 font-display text-base text-text-primary">
            {rows.length} location{rows.length === 1 ? '' : 's'}
          </h2>
          {rows.length === 0 ? (
            <div className="py-8 text-center">
              <Store className="mx-auto mb-2 text-text-tertiary" size={28} />
              <p className="text-sm text-text-secondary">No locations yet — importing a CSV will create them.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-text-tertiary">
                  <th className="py-2 text-left font-semibold">Location</th>
                  <th className="py-2 text-left font-semibold">Code</th>
                  <th className="py-2 text-right font-semibold">Transactions</th>
                  <th className="py-2 text-right font-semibold">Data range</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l, i) => (
                  <tr key={l.id} className="border-b border-border/60">
                    <td className="py-2 text-text-primary">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: entityColor(i) }} />
                        {l.name}
                      </span>
                    </td>
                    <td className="py-2 font-mono text-xs text-text-secondary">{l.code}</td>
                    <td className="py-2 text-right tabular-nums text-text-primary">
                      {l.transactionCount.toLocaleString()}
                    </td>
                    <td className="py-2 text-right text-text-secondary">
                      {l.firstPeriod ? `${l.firstPeriod} → ${l.lastPeriod}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
