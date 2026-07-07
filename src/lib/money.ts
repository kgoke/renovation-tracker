/**
 * Money helpers. Amounts are integer cents everywhere in the app.
 * Pure module (no React Native imports) so it can be unit tested on Node.
 */

export function formatCents(cents: number, opts: { compact?: boolean } = {}): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  if (opts.compact && abs >= 100_000_00) {
    // 100k and up: drop the cents for breathing room on dashboards.
    const dollars = Math.round(abs / 100);
    return `${negative ? '-' : ''}$${dollars.toLocaleString('en-US')}`;
  }
  const dollars = Math.floor(abs / 100);
  const rem = abs % 100;
  return `${negative ? '-' : ''}$${dollars.toLocaleString('en-US')}.${String(rem).padStart(2, '0')}`;
}

/**
 * Parse a user-entered amount ("1,234.56", "$12", "12.5") into cents.
 * Returns null when the input is not a usable amount.
 */
export function parseMoney(input: string): number | null {
  const cleaned = input.trim().replace(/[$,\s]/g, '');
  if (!cleaned) return null;
  if (!/^-?\d*(\.\d*)?$/.test(cleaned)) return null;
  const value = Number.parseFloat(cleaned);
  if (Number.isNaN(value)) return null;
  return Math.round(value * 100);
}

/** Format cents as a plain editable string for form fields ("1234.56"). */
export function centsToInput(cents: number): string {
  if (cents === 0) return '';
  const negative = cents < 0;
  const abs = Math.abs(cents);
  return `${negative ? '-' : ''}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
