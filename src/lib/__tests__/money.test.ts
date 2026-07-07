import { describe, expect, it } from 'vitest';
import { centsToInput, formatCents, parseMoney } from '../money';

describe('parseMoney', () => {
  it('parses plain dollar amounts', () => {
    expect(parseMoney('12.34')).toBe(1234);
    expect(parseMoney('12')).toBe(1200);
    expect(parseMoney('0.99')).toBe(99);
  });

  it('parses currency symbols, commas, and whitespace', () => {
    expect(parseMoney('$1,234.56')).toBe(123456);
    expect(parseMoney(' $ 45 ')).toBe(4500);
  });

  it('parses negative and partial input', () => {
    expect(parseMoney('-5.25')).toBe(-525);
    expect(parseMoney('12.')).toBe(1200);
    expect(parseMoney('.5')).toBe(50);
  });

  it('rejects junk', () => {
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('1.2.3')).toBeNull();
    expect(parseMoney('12-34')).toBeNull();
  });
});

describe('formatCents', () => {
  it('formats dollars and cents', () => {
    expect(formatCents(123456)).toBe('$1,234.56');
    expect(formatCents(99)).toBe('$0.99');
    expect(formatCents(0)).toBe('$0.00');
    expect(formatCents(-525)).toBe('-$5.25');
  });

  it('drops cents for large compact values', () => {
    expect(formatCents(25000000, { compact: true })).toBe('$250,000');
    expect(formatCents(1234, { compact: true })).toBe('$12.34');
  });
});

describe('centsToInput', () => {
  it('round-trips with parseMoney', () => {
    for (const cents of [0, 1, 99, 100, 1234, 123456, -525]) {
      const text = centsToInput(cents);
      expect(parseMoney(text) ?? 0).toBe(cents);
    }
  });
});
