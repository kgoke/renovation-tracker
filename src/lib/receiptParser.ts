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
  items: ParsedReceiptItem[];
}

/** Matches a money amount like 1,234.56 / $12.99 / 12.99- (trailing minus on refunds). */
const AMOUNT_RE = /\$?\s*(\d{1,3}(?:,\d{3})*|\d+)\.(\d{2})\s*-?\s*$/;

const TOTAL_LINE_RE = /\b(total|amount\s+due|balance\s+due|grand\s+total)\b/i;
const SUBTOTAL_LINE_RE = /\b(sub\s*-?\s*total|subtotal)\b/i;

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

  // If the "total" we found is actually one of many identical line amounts
  // (single-item receipts), keep it anyway — the user reviews everything.
  return {
    vendor: extractVendor(lines),
    date: extractDate(lines),
    totalCents: total?.cents ?? null,
    items,
  };
}
