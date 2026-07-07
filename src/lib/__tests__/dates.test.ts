import { describe, expect, it } from 'vitest';
import { findDateInText, formatIso, isValidIso, parseLooseDate } from '../dates';

describe('parseLooseDate', () => {
  it('parses common receipt date formats', () => {
    expect(parseLooseDate('2026-07-04')).toBe('2026-07-04');
    expect(parseLooseDate('07/04/2026')).toBe('2026-07-04');
    expect(parseLooseDate('7/4/26')).toBe('2026-07-04');
    expect(parseLooseDate('7-4-2026')).toBe('2026-07-04');
    expect(parseLooseDate('Jul 4, 2026')).toBe('2026-07-04');
    expect(parseLooseDate('July 4 2026')).toBe('2026-07-04');
    expect(parseLooseDate('4 Jul 2026')).toBe('2026-07-04');
  });

  it('rejects impossible dates', () => {
    expect(parseLooseDate('13/45/2026')).toBeNull();
    expect(parseLooseDate('2026-02-30')).toBeNull();
    expect(parseLooseDate('hello')).toBeNull();
  });
});

describe('findDateInText', () => {
  it('finds dates embedded in OCR lines', () => {
    expect(findDateInText('Date: 07/04/2026 Time: 10:31 AM')).toBe('2026-07-04');
    expect(findDateInText('TRANS 07-04-26 #4521')).toBe('2026-07-04');
    expect(findDateInText('no date here')).toBeNull();
  });
});

describe('isValidIso / formatIso', () => {
  it('validates and formats', () => {
    expect(isValidIso('2026-07-04')).toBe(true);
    expect(isValidIso('2026-2-4')).toBe(false);
    expect(isValidIso('2026-02-30')).toBe(false);
    expect(formatIso('2026-07-04')).toBe('Jul 4, 2026');
  });
});
