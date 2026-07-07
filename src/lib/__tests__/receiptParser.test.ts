import { describe, expect, it } from 'vitest';
import { allocateProportionally, parseReceiptText, resolveTaxCents } from '../receiptParser';

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

  it('extracts subtotal and tax', () => {
    const parsed = parseReceiptText(HOME_DEPOT);
    expect(parsed.subtotalCents).toBe(7042);
    expect(parsed.taxCents).toBe(581);
  });

  it('sums multiple tax lines', () => {
    const parsed = parseReceiptText('LUMBER 100.00\nSUBTOTAL 100.00\nTAX 1 5.00\nTAX 2 1.25\nTOTAL 106.25');
    expect(parsed.taxCents).toBe(625);
    expect(parsed.totalCents).toBe(10625);
  });

  it('uses a TOTAL TAX summary line without double counting', () => {
    const parsed = parseReceiptText('LUMBER 100.00\nTOTAL TAX 6.25\nTOTAL 106.25');
    expect(parsed.taxCents).toBe(625);
    expect(parsed.totalCents).toBe(10625);
  });

  it('does not mistake a TOTAL TAX line for the receipt total', () => {
    const parsed = parseReceiptText('LUMBER 10.00\nTOTAL TAX 20.00\nTOTAL 12.00');
    expect(parsed.totalCents).toBe(1200);
  });
});

describe('resolveTaxCents', () => {
  it('prefers the explicit tax line', () => {
    expect(resolveTaxCents(7042, 581, 7623)).toBe(581);
  });

  it('derives tax from total minus subtotal when no tax line exists', () => {
    expect(resolveTaxCents(7042, null, 7623)).toBe(581);
  });

  it('returns zero when nothing usable is present', () => {
    expect(resolveTaxCents(null, null, 7623)).toBe(0);
    expect(resolveTaxCents(8000, null, 7623)).toBe(0); // subtotal > total: garbled OCR
  });
});

describe('allocateProportionally', () => {
  it('splits tax proportionally and sums exactly', () => {
    // Home Depot example: 5.98 + 12.48 + 16.97 + 34.99 = 70.42, tax 5.81
    const alloc = allocateProportionally([598, 1248, 1697, 3499], 581);
    expect(alloc.reduce((a, b) => a + b, 0)).toBe(581);
    expect(alloc[3]).toBeGreaterThan(alloc[0]); // bigger items carry more tax
    // ~8.25% of each item, within a cent
    expect(Math.abs(alloc[0] - 49)).toBeLessThanOrEqual(1);
    expect(Math.abs(alloc[3] - 289)).toBeLessThanOrEqual(1);
  });

  it('handles rounding so cents never go missing', () => {
    const alloc = allocateProportionally([100, 100, 100], 100);
    expect(alloc.reduce((a, b) => a + b, 0)).toBe(100);
    expect(alloc.every((v) => v === 33 || v === 34)).toBe(true);
  });

  it('returns zeros for zero tax or empty weights', () => {
    expect(allocateProportionally([100, 200], 0)).toEqual([0, 0]);
    expect(allocateProportionally([], 500)).toEqual([]);
    expect(allocateProportionally([0, 0], 500)).toEqual([0, 0]);
  });

  it('ignores negative line amounts (refunds) when weighting', () => {
    const alloc = allocateProportionally([1000, -500], 100);
    expect(alloc).toEqual([100, 0]);
  });
});
