/**
 * Heuristic parser that turns raw OCR text from a receipt photo into a
 * structured draft: vendor, date, total, and candidate line items.
 * Everything it produces is editable in the review screen, so the goal is
 * "usually right", not perfect. Pure module — unit tested on Node.
 */

import { findDateInText } from './dates';

export interface ParsedReceiptItem {
  description: string;
  amountCents: number;
  quantity: number;
}

export interface ParsedReceipt {
  vendor: string;
  date: string | null;
  totalCents: number | null;
  subtotalCents: number | null;
  taxCents: number | null;
  items: ParsedReceiptItem[];
}

/** Matches a money amount like 1,234.56 / $12.99 / 12.99- (trailing minus on refunds). */
const AMOUNT_RE = /\$?\s*(\d{1,3}(?:,\d{3})*|\d+)\.(\d{2})\s*-?\s*$/;

const TOTAL_LINE_RE = /\b(total|amount\s+due|balance\s+due|grand\s+total)\b/i;
const SUBTOTAL_LINE_RE = /\b(sub\s*-?\s*total|subtotal)\b/i;
const TAX_LINE_RE = /\btax\b/i;
const TAXABLE_LINE_RE = /\btaxable\b/i;

/** Lines that are receipt plumbing rather than purchased items. */
const NOISE_LINE_RE = new RegExp(
  [
    'sub\\s*-?\\s*total', 'total', 'tax', 'change', 'cash', 'credit', 'debit',
    'visa', 'mastercard', 'amex', 'discover', 'card', 'tender', 'payment',
    'balance', 'amount\\s+due', 'refund', 'auth', 'approval', 'account',
    'savings', 'you\\s+saved', 'coupon', 'discount', 'rewards?', 'points',
    'phone', 'tel', 'fax', 'thank', 'receipt', 'cashier', 'register', 'terminal',
    'invoice', 'order', 'transaction', 'ref\\b', 'items?\\s+sold', 'qty\\s+sold',
  ].join('|'),
  'i'
);

function normalizeLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0);
}

function extractAmountCents(line: string): number | null {
  const m = AMOUNT_RE.exec(line);
  if (!m) return null;
  const dollars = Number(m[1].replace(/,/g, ''));
  const cents = Number(m[2]);
  return dollars * 100 + cents;
}

function looksLikeVendor(line: string): boolean {
  if (line.length < 3) return false;
  const letters = line.replace(/[^A-Za-z]/g, '');
  if (letters.length < 3) return false;
  if (findDateInText(line)) return false;
  if (AMOUNT_RE.test(line)) return false;
  if (/^\d/.test(line)) return false; // street addresses usually lead with a number
  if (/\b(www\.|\.com|http)\b/i.test(line)) return false;
  if (NOISE_LINE_RE.test(line)) return false;
  return true;
}

function extractVendor(lines: string[]): string {
  for (const line of lines.slice(0, 6)) {
    if (looksLikeVendor(line)) return titleCase(line);
  }
  return '';
}

function titleCase(raw: string): string {
  return raw
    .toLowerCase()
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function extractDate(lines: string[]): string | null {
  for (const line of lines) {
    const date = findDateInText(line);
    if (date) return date;
  }
  return null;
}

interface TotalCandidate {
  cents: number;
  lineIdx: number;
}

function extractTotal(lines: string[]): TotalCandidate | null {
  let best: TotalCandidate | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!TOTAL_LINE_RE.test(line) || SUBTOTAL_LINE_RE.test(line)) continue;
    // "TOTAL TAX 3.00" is a tax line, not the receipt total.
    if (TAX_LINE_RE.test(line)) continue;
    // Amount is usually on the same line; OCR sometimes splits it onto the next.
    const cents = extractAmountCents(line) ?? (i + 1 < lines.length ? extractAmountCents(lines[i + 1]) : null);
    if (cents == null) continue;
    // Receipts can list several "TOTAL" style lines; the largest wins.
    if (!best || cents > best.cents) best = { cents, lineIdx: i };
  }
  if (best) return best;

  // Fallback: no labeled total — use the largest amount on the receipt.
  let max: TotalCandidate | null = null;
  for (let i = 0; i < lines.length; i++) {
    const cents = extractAmountCents(lines[i]);
    if (cents != null && (!max || cents > max.cents)) max = { cents, lineIdx: i };
  }
  return max;
}

/** Largest amount found on a line matching `labelRe`, checking the next line
 * when OCR pushed the number onto its own row. */
function extractLabeledAmount(lines: string[], labelRe: RegExp): number | null {
  let best: number | null = null;
  for (let i = 0; i < lines.length; i++) {
    if (!labelRe.test(lines[i])) continue;
    const cents = extractAmountCents(lines[i]) ?? (i + 1 < lines.length ? extractAmountCents(lines[i + 1]) : null);
    if (cents != null && (best == null || cents > best)) best = cents;
  }
  return best;
}

/**
 * Tax on the receipt. Sums individual tax lines (TAX 1 / TAX 2 …); when only
 * a "TOTAL TAX" style summary exists, uses that instead to avoid counting
 * the same tax twice.
 */
function extractTax(lines: string[]): number | null {
  const plain: number[] = [];
  const summary: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!TAX_LINE_RE.test(line) || TAXABLE_LINE_RE.test(line)) continue;
    const cents = extractAmountCents(line) ?? (i + 1 < lines.length ? extractAmountCents(lines[i + 1]) : null);
    if (cents == null) continue;
    (/\btotal\b/i.test(line) ? summary : plain).push(cents);
  }
  if (plain.length > 0) return plain.reduce((a, b) => a + b, 0);
  if (summary.length > 0) return Math.max(...summary);
  return null;
}

const QTY_PREFIX_RE = /^(\d{1,3})\s*[xX@]\s+/;

function extractItems(lines: string[], totalLineIdx: number | null): ParsedReceiptItem[] {
  const items: ParsedReceiptItem[] = [];
  const end = totalLineIdx != null ? totalLineIdx : lines.length;

  for (let i = 0; i < end; i++) {
    const line = lines[i];
    if (NOISE_LINE_RE.test(line)) continue;
    const amountCents = extractAmountCents(line);
    if (amountCents == null || amountCents === 0) continue;

    let description = line.replace(AMOUNT_RE, '').trim();
    // Strip SKU-ish trailing codes and price-each hints like "2 @ 5.99".
    description = description.replace(/\b\d{6,}\b/g, '').replace(/\s+/g, ' ').trim();

    let quantity = 1;
    const qty = QTY_PREFIX_RE.exec(description);
    if (qty) {
      quantity = Math.max(1, Number(qty[1]));
      description = description.replace(QTY_PREFIX_RE, '').trim();
    }

    const letters = description.replace(/[^A-Za-z]/g, '');
    if (letters.length < 2) continue; // bare numbers are not items
    if (findDateInText(description)) continue;

    items.push({ description: titleCase(description), amountCents, quantity });
  }
  return items;
}

export function parseReceiptText(text: string): ParsedReceipt {
  const lines = normalizeLines(text);
  const total = extractTotal(lines);
  const items = extractItems(lines, total?.lineIdx ?? null);
  const subtotalCents = extractLabeledAmount(lines, SUBTOTAL_LINE_RE);
  const taxCents = extractTax(lines);

  // If the "total" we found is actually one of many identical line amounts
  // (single-item receipts), keep it anyway — the user reviews everything.
  return {
    vendor: extractVendor(lines),
    date: extractDate(lines),
    totalCents: total?.cents ?? null,
    subtotalCents,
    taxCents,
    items,
  };
}

/**
 * Best available tax figure: an explicit tax line wins; otherwise the
 * difference between the after-tax total and the pre-tax subtotal.
 */
export function resolveTaxCents(
  subtotalCents: number | null | undefined,
  taxCents: number | null | undefined,
  totalCents: number | null | undefined
): number {
  if (taxCents != null && taxCents > 0) return taxCents;
  if (
    subtotalCents != null &&
    totalCents != null &&
    subtotalCents > 0 &&
    totalCents > subtotalCents
  ) {
    return totalCents - subtotalCents;
  }
  return 0;
}

/**
 * Split `totalCents` across `weights` proportionally, in whole cents that
 * sum exactly to `totalCents` (largest-remainder rounding). Used to spread
 * receipt tax over line items so every item carries its share.
 */
export function allocateProportionally(weights: number[], totalCents: number): number[] {
  if (weights.length === 0) return [];
  const negative = totalCents < 0;
  const target = Math.abs(totalCents);
  const positive = weights.map((w) => Math.max(0, w));
  const weightSum = positive.reduce((a, b) => a + b, 0);
  if (weightSum <= 0 || target === 0) return weights.map(() => 0);

  const raw = positive.map((w) => (w * target) / weightSum);
  const result = raw.map(Math.floor);
  let remainder = target - result.reduce((a, b) => a + b, 0);
  const byFraction = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);
  for (let k = 0; remainder > 0; k = (k + 1) % byFraction.length, remainder--) {
    result[byFraction[k].index] += 1;
  }
  return negative ? result.map((v) => -v) : result;
}
