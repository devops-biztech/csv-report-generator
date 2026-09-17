import { NextRequest, NextResponse } from 'next/server';
import { getReport, getPeriodBounds } from '@/lib/reports';

/**
 * GET /api/reports?from=YYYY-MM&to=YYYY-MM&locationId=3
 *
 * Returns everything the dashboard needs in one payload. The reports all read
 * the same filtered slice, so one round trip keeps them consistent with each
 * other and avoids a waterfall of requests.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const bounds = await getPeriodBounds();
  if (!bounds) {
    return NextResponse.json({
      empty: true,
      range: { from: '', to: '' },
      totals: { revenueCents: 0, expenseCents: 0, netCents: 0, transactionCount: 0 },
      byLocation: [], byPeriod: [], byPeriodLocation: [], byCategory: [],
      locations: [], availablePeriods: [],
    });
  }

  const from = params.get('from') || bounds.min;
  const to = params.get('to') || bounds.max;

  const rawLocation = params.get('locationId');
  const locationId = rawLocation && rawLocation !== 'all' ? Number(rawLocation) : null;
  if (rawLocation && rawLocation !== 'all' && !Number.isInteger(locationId)) {
    return NextResponse.json({ error: 'Invalid locationId' }, { status: 400 });
  }

  const report = await getReport({ from, to, locationId });
  return NextResponse.json({ ...report, empty: false, bounds });
}
