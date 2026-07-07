/**
 * Date helpers around ISO `YYYY-MM-DD` strings (the storage format).
 * Pure module so it can be unit tested on Node.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function todayIso(): string {
  const now = new Date();
  return toIso(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function toIso(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function isValidIso(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= daysInMonth(year, month);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** "2026-07-04" -> "Jul 4, 2026". Falls back to the raw string. */
export function formatIso(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return value;
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}

/**
 * Best-effort parse of a date found on a receipt into ISO format.
 * Handles 07/04/2026, 7-4-26, 2026-07-04, "Jul 4 2026", "4 Jul 2026".
 */
export function parseLooseDate(raw: string): string | null {
  const text = raw.trim();

  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(text);
  if (m) {
    const iso = toIso(Number(m[1]), Number(m[2]), Number(m[3]));
    return isValidIso(iso) ? iso : null;
  }

  m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/.exec(text);
  if (m) {
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    const iso = toIso(year, Number(m[1]), Number(m[2]));
    return isValidIso(iso) ? iso : null;
  }

  const monthIdx = (name: string) =>
    MONTHS.findIndex((mo) => name.toLowerCase().startsWith(mo.toLowerCase()));

  m = /^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec(text);
  if (m) {
    const mi = monthIdx(m[1]);
    if (mi >= 0) {
      const iso = toIso(Number(m[3]), mi + 1, Number(m[2]));
      return isValidIso(iso) ? iso : null;
    }
  }

  m = /^(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})$/.exec(text);
  if (m) {
    const mi = monthIdx(m[2]);
    if (mi >= 0) {
      const iso = toIso(Number(m[3]), mi + 1, Number(m[1]));
      return isValidIso(iso) ? iso : null;
    }
  }

  return null;
}

/** Find the first plausible date anywhere inside a line of OCR text. */
export function findDateInText(line: string): string | null {
  const patterns = [
    /\d{4}[-/]\d{1,2}[-/]\d{1,2}/,
    /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/,
    /[A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4}/,
    /\d{1,2}\s+[A-Za-z]{3,9}\.?\s+\d{4}/,
  ];
  for (const pattern of patterns) {
    const m = pattern.exec(line);
    if (m) {
      const parsed = parseLooseDate(m[0]);
      if (parsed) return parsed;
    }
  }
  return null;
}
