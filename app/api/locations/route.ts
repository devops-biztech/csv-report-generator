import { NextRequest, NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { locations } from '@/db/schema';

export async function GET() {
  const rows = db.all(sql`
    SELECT l.id, l.name, l.code, l.active,
           COUNT(t.id) AS transactionCount,
           MIN(t.period) AS firstPeriod,
           MAX(t.period) AS lastPeriod
    FROM locations l
    LEFT JOIN transactions t ON t.location_id = l.id
    GROUP BY l.id, l.name, l.code, l.active
    ORDER BY l.name
  `);
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const { name, code } = await request.json();
  if (!name?.trim() || !code?.trim()) {
    return NextResponse.json({ error: 'name and code are required' }, { status: 400 });
  }

  const existing = await db.query.locations.findFirst({
    where: eq(locations.code, code.trim().toUpperCase()),
  });
  if (existing) {
    return NextResponse.json({ error: `Code "${code}" is already in use` }, { status: 409 });
  }

  const [row] = await db.insert(locations)
    .values({ name: name.trim(), code: code.trim().toUpperCase() })
    .returning();
  return NextResponse.json(row);
}
