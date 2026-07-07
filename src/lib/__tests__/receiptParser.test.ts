import { describe, expect, it } from 'vitest';
import { parseReceiptText } from '../receiptParser';

const HOME_DEPOT = `
THE HOME DEPOT
1255 CONTRACTOR WAY
SPRINGFIELD, IL 62704
(217) 555-0192

07/04/2026 10:31 AM
CASHIER SELF CHECKOUT

2X4X8 STUD PREMIUM KD 482913 5.98
DRYWALL 1/2IN 4X8 019283 12.48
JOINT COMPOUND 4.5GAL 98214 16.97
DECK SCREW 3IN 5LB 55521 34.99

SUBTOTAL 70.42
SALES TAX 5.81
TOTAL 76.23

VISA XXXX1234
AUTH 042113
THANK YOU FOR SHOPPING
`;

describe('parseReceiptText', () => {
  it('extracts vendor, date, total, and items from a hardware receipt', () => {
    const parsed = parseReceiptText(HOME_DEPOT);
    expect(parsed.vendor).toBe('The Home Depot');
    expect(parsed.date).toBe('2026-07-04');
    expect(parsed.totalCents).toBe(7623);
    expect(parsed.items).toHaveLength(4);
    expect(parsed.items[0].description).toContain('2x4x8 Stud');
    expect(parsed.items.map((i) => i.amountCents)).toEqual([598, 1248, 1697, 3499]);
  });

  it('excludes subtotal, tax, and payment lines from items', () => {
    const parsed = parseReceiptText(HOME_DEPOT);
    const descriptions = parsed.items.map((i) => i.description.toLowerCase()).join(' ');
    expect(descriptions).not.toContain('subtotal');
    expect(descriptions).not.toContain('tax');
    expect(descriptions).not.toContain('visa');
  });

  it('prefers TOTAL over SUBTOTAL even when subtotal appears first', () => {
    const parsed = parseReceiptText('SUBTOTAL 99.99\nTOTAL 105.49');
    expect(parsed.totalCents).toBe(10549);
  });

  it('picks up the amount when OCR splits TOTAL onto its own line', () => {
    const parsed = parseReceiptText('LUMBER 10.00\nTOTAL\n10.85');
    expect(parsed.totalCents).toBe(1085);
  });

  it('falls back to the largest amount when no total label exists', () => {
    const parsed = parseReceiptText('PAINT 45.99\nBRUSH 7.99');
    expect(parsed.totalCents).toBe(4599);
  });

  it('parses quantity prefixes', () => {
    const parsed = parseReceiptText('3 x OUTLET COVER 12.99\nTOTAL 12.99');
    expect(parsed.items[0].quantity).toBe(3);
    expect(parsed.items[0].description).toBe('Outlet Cover');
  });

  it('handles comma-grouped amounts', () => {
    const parsed = parseReceiptText('CABINET SET 1,249.00\nTOTAL 1,249.00');
    expect(parsed.totalCents).toBe(124900);
    expect(parsed.items[0].amountCents).toBe(124900);
  });

  it('returns empty results for unusable text', () => {
    const parsed = parseReceiptText('%%% ??? !!!');
    expect(parsed.vendor).toBe('');
    expect(parsed.date).toBeNull();
    expect(parsed.totalCents).toBeNull();
    expect(parsed.items).toHaveLength(0);
  });

  it('ignores phone numbers and addresses as vendors', () => {
    const parsed = parseReceiptText('(217) 555-0192\n123 MAIN ST\nACE HARDWARE\nBOLT 0.99\nTOTAL 0.99');
    expect(parsed.vendor).toBe('Ace Hardware');
  });
});
