import { NextRequest, NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { db } from '@/db';
import { imports } from '@/db/schema';
import { importCsvText } from '@/lib/importService';

/** POST /api/import — multipart upload of one or more CSV files. */
export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Expected a multipart form upload' }, { status: 400 });
  }

  const files = formData.getAll('file').filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const results = [];
  for (const file of files) {
    const text = await file.text();
    results.push(await importCsvText(file.name, text));
  }

  return NextResponse.json({ results });
}

/** GET /api/import — recent import history. */
export async function GET() {
  const rows = await db.select().from(imports).orderBy(desc(imports.createdAt)).limit(50);
  return NextResponse.json(rows.map(r => ({
    ...r,
    errors: r.errors ? JSON.parse(r.errors) : [],
  })));
}
