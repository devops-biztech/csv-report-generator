'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Upload, FileText, CircleCheck, TriangleAlert, CircleX } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

interface ImportSummary {
  importId: number | null;
  status: 'complete' | 'failed';
  filename: string;
  rowsTotal: number;
  rowsImported: number;
  rowsDuplicate: number;
  rowsFailed: number;
  errors: { row: number; message: string; raw?: string }[];
  newLocations: string[];
  unmappedHeaders: string[];
  missingRequired: string[];
}

interface ImportRecord {
  id: number;
  filename: string;
  status: string;
  rowsTotal: number;
  rowsImported: number;
  rowsDuplicate: number;
  rowsFailed: number;
  createdAt: string;
}

export default function ImportPage() {
  const [results, setResults] = useState<ImportSummary[]>([]);
  const [history, setHistory] = useState<ImportRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadHistory = useCallback(async () => {
    const res = await fetch('/api/import');
    setHistory(await res.json());
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const upload = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files).filter(f => /\.(csv|txt)$/i.test(f.name));
    if (list.length === 0) return;

    setBusy(true);
    const form = new FormData();
    for (const f of list) form.append('file', f);

    try {
      const res = await fetch('/api/import', { method: 'POST', body: form });
      const json = await res.json();
      setResults(json.results ?? []);
      await loadHistory();
    } finally {
      setBusy(false);
    }
  }, [loadHistory]);

  return (
    <DashboardLayout>
      <div className="h-full overflow-y-auto p-6 space-y-5">
        <div>
          <h1 className="font-display text-2xl text-text-primary">Import Data</h1>
          <p className="text-sm text-text-secondary">
            Upload a CSV per location, or several at once. Re-uploading the same file is safe — duplicate rows are skipped.
          </p>
        </div>

        {/* Drop zone */}
        <Card
          className={`border-2 border-dashed p-10 text-center transition-colors ${
            dragging ? 'border-primary bg-primary-light' : 'border-border-strong'
          }`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files); }}
        >
          <Upload className="mx-auto mb-3 text-text-tertiary" size={32} />
          <p className="text-sm font-medium text-text-primary">
            {busy ? 'Importing…' : 'Drop CSV files here'}
          </p>
          <p className="mt-1 text-xs text-text-secondary">or</p>
          <Button className="mt-3" onClick={() => inputRef.current?.click()} disabled={busy}>
            Choose files
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            multiple
            className="hidden"
            onChange={e => e.target.files && upload(e.target.files)}
          />
          <p className="mt-4 text-xs text-text-tertiary">
            Expected columns: Date, Location, Category, Description, Amount, Type.
            Common header variations are matched automatically.
          </p>
        </Card>

        {/* Results of the most recent upload */}
        {results.length > 0 && (
          <Card className="p-5">
            <h2 className="mb-3 font-display text-base text-text-primary">Import results</h2>
            <div className="space-y-3">
              {results.map((r, i) => (
                <div key={i} className="rounded-lg border border-border p-3">
                  <div className="flex items-start gap-2">
                    {r.status === 'failed'
                      ? <CircleX className="mt-0.5 shrink-0 text-danger" size={16} />
                      : r.rowsFailed > 0
                        ? <TriangleAlert className="mt-0.5 shrink-0 text-danger" size={16} />
                        : <CircleCheck className="mt-0.5 shrink-0 text-success" size={16} />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-primary">{r.filename}</p>

                      {r.missingRequired.length > 0 ? (
                        <p className="mt-1 text-sm text-danger">
                          Could not import — missing required column(s): {r.missingRequired.join(', ')}.
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-text-secondary">
                          <span className="font-medium text-text-primary">{r.rowsImported.toLocaleString()}</span> imported
                          {r.rowsDuplicate > 0 && <> · {r.rowsDuplicate.toLocaleString()} duplicate skipped</>}
                          {r.rowsFailed > 0 && <> · <span className="text-danger">{r.rowsFailed} failed</span></>}
                        </p>
                      )}

                      {r.newLocations.length > 0 && (
                        <p className="mt-1 text-xs text-text-secondary">
                          New locations created: {r.newLocations.join(', ')}
                        </p>
                      )}
                      {r.unmappedHeaders.length > 0 && (
                        <p className="mt-1 text-xs text-text-tertiary">
                          Ignored columns: {r.unmappedHeaders.join(', ')}
                        </p>
                      )}
                      {r.errors.length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-text-secondary">
                            {r.errors.length} row problem{r.errors.length === 1 ? '' : 's'}
                          </summary>
                          <ul className="mt-1 space-y-0.5 text-xs text-text-tertiary">
                            {r.errors.slice(0, 20).map((e, j) => (
                              <li key={j}>Row {e.row}: {e.message}{e.raw ? ` ("${e.raw}")` : ''}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Link href="/" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
              View reports →
            </Link>
          </Card>
        )}

        {/* History */}
        <Card className="p-5">
          <h2 className="mb-3 font-display text-base text-text-primary">Import history</h2>
          {history.length === 0 ? (
            <p className="text-sm text-text-secondary">Nothing imported yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-text-tertiary">
                  <th className="py-2 text-left font-semibold">File</th>
                  <th className="py-2 text-right font-semibold">Imported</th>
                  <th className="py-2 text-right font-semibold">Duplicate</th>
                  <th className="py-2 text-right font-semibold">Failed</th>
                  <th className="py-2 text-right font-semibold">When</th>
                </tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id} className="border-b border-border/60">
                    <td className="py-2 text-text-primary">
                      <span className="inline-flex items-center gap-2">
                        <FileText size={14} className="text-text-tertiary" />
                        {h.filename}
                      </span>
                    </td>
                    <td className="py-2 text-right tabular-nums text-text-primary">{h.rowsImported.toLocaleString()}</td>
                    <td className="py-2 text-right tabular-nums text-text-secondary">{h.rowsDuplicate.toLocaleString()}</td>
                    <td className={`py-2 text-right tabular-nums ${h.rowsFailed > 0 ? 'text-danger' : 'text-text-secondary'}`}>
                      {h.rowsFailed.toLocaleString()}
                    </td>
                    <td className="py-2 text-right text-text-tertiary">
                      {new Date(h.createdAt).toLocaleString()}
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
