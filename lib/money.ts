/**
 * Money helpers. Everything internal is integer cents.
 *
 * Parsing is done by string surgery rather than parseFloat so that a value
 * like "1234.565" rounds predictably instead of inheriting binary-float
 * representation error.
 */

/**
 * Parse a CSV amount cell into cents. Handles the forms finance exports
 * actually produce: "$1,234.56", "1234.56", "(123.45)" (accounting negative),
 * "-123.45", "1 234,00"-free plain forms, and stray whitespace.
 *
 * Returns null when the cell isn't a number, so the caller can report the row
 * rather than silently importing a zero.
 */
export function parseAmountToCents(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim();
  if (!s) return null;

  let negative = false;

  // Accounting notation: (123.45) means -123.45
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1).trim();
  }

  s = s.replace(/[$£€\s,]/g, '');

  if (s.startsWith('-')) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }

  if (s === '' || s === '.' || !/^\d*(\.\d*)?$/.test(s)) return null;

  const [intPart = '', fracRaw = ''] = s.split('.');
  // Three digits so we can round half-up on the third.
  const frac = (fracRaw + '000').slice(0, 3);

  let cents = Number(intPart || '0') * 100 + Number(frac.slice(0, 2));
  if (Number(frac[2]) >= 5) cents += 1;

  return negative ? -cents : cents;
}

/** Format cents as currency: 123456 -> "$1,234.56", -5000 -> "-$50.00" */
export function formatCents(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const dollars = Math.floor(abs / 100);
  const remainder = String(abs % 100).padStart(2, '0');
  const grouped = dollars.toLocaleString('en-US');
  return `${negative ? '-' : ''}$${grouped}.${remainder}`;
}

/** Compact form for chart axes and tiles: 1234567 -> "$12.3k" */
export function formatCentsCompact(cents: number): string {
  const negative = cents < 0;
  const dollars = Math.abs(cents) / 100;
  let out: string;
  if (dollars >= 1_000_000) out = `$${(dollars / 1_000_000).toFixed(1)}M`;
  else if (dollars >= 1_000) out = `$${(dollars / 1_000).toFixed(1)}k`;
  else out = `$${dollars.toFixed(0)}`;
  return (negative ? '-' : '') + out;
}

/** Cents -> plain decimal number, for chart scales only. Never for arithmetic. */
export function centsToNumber(cents: number): number {
  return cents / 100;
}
