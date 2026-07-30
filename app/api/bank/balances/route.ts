import { NextResponse } from 'next/server';
import { db } from '@/db';
import { linkedAccounts } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { getAccounts } from '@/lib/simplefin';
import { requireAuth, isAuthError } from '@/lib/auth';

// Minimum time between live SimpleFIN balance fetches. SimpleFIN refreshes bank
// data only ~once/24h upstream, so re-fetching more often re-reads the same
// snapshot — and each live call originates from a rotating Vercel egress IP,
// which trips SimpleFIN's "new IP" security emails. Between fetches we serve the
// last balance cached on the account row.
const BALANCE_STALENESS_MS = 4 * 60 * 60 * 1000;

// GET - Balances for all linked accounts. Fetches live from the provider only
// when the cached value is older than BALANCE_STALENESS_MS; otherwise serves
// the cached balance without touching SimpleFIN.
export async function GET() {
  try {
    const authResult = await requireAuth();
    if (isAuthError(authResult)) return authResult.error;
    const { userId } = authResult;

    const accounts = await db
      .select()
      .from(linkedAccounts)
      .where(and(eq(linkedAccounts.userId, userId), eq(linkedAccounts.provider, 'simplefin')));

    const balances: Record<string, string> = {};
    const cutoff = new Date(Date.now() - BALANCE_STALENESS_MS);

    // Group accounts by access URL — one call per URL covers all its accounts
    const accountsByUrl = new Map<string, typeof accounts>();
    for (const account of accounts) {
      const group = accountsByUrl.get(account.accessToken);
      if (group) group.push(account);
      else accountsByUrl.set(account.accessToken, [account]);
    }

    const fetches = [...accountsByUrl.entries()].map(async ([accessUrl, urlAccounts]) => {
      // Serve cache while every account on this URL is fresh — no SimpleFIN call
      const anyStale = urlAccounts.some(
        a => !a.balanceFetchedAt || a.balanceFetchedAt < cutoff
      );
      if (!anyStale) {
        for (const account of urlAccounts) {
          if (account.balanceCached != null) balances[String(account.id)] = account.balanceCached;
        }
        return;
      }

      try {
        const accountSet = await getAccounts(accessUrl, { balancesOnly: true });
        const balanceByProviderId = new Map(accountSet.accounts.map(a => [a.id, a.balance]));
        const now = new Date();
        for (const account of urlAccounts) {
          const balance = balanceByProviderId.get(account.tellerAccountId);
          if (balance !== undefined) {
            balances[String(account.id)] = balance;
            await db
              .update(linkedAccounts)
              .set({ balanceCached: balance, balanceFetchedAt: now })
              .where(eq(linkedAccounts.id, account.id));
          } else if (account.balanceCached != null) {
            // Account missing from the response — fall back to last known
            balances[String(account.id)] = account.balanceCached;
          }
        }
      } catch {
        // Live fetch failed (e.g. revoked access URL) — fall back to last known
        for (const account of urlAccounts) {
          if (account.balanceCached != null) balances[String(account.id)] = account.balanceCached;
        }
      }
    });

    await Promise.all(fetches);

    return NextResponse.json(balances);
  } catch (error) {
    console.error('Error fetching balances:', error);
    return NextResponse.json({ error: 'Failed to fetch balances' }, { status: 500 });
  }
}
