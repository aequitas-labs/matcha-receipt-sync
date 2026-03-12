import { describe, it, expect } from 'vitest';
import { computeEffectivePrices } from './effectivePrice';
import type { ScrapedItem } from '../types/scraper';

function item(
  name: string,
  totalPrice: number,
  quantity = 1,
  unitPrice = totalPrice
): ScrapedItem {
  return { name, quantity, unitPrice, totalPrice };
}

function sumPaid(items: ScrapedItem[]): number {
  return (
    Math.round(
      items.reduce((s, i) => s + i.effectivePrice! * (i.quantity ?? 1), 0) * 100
    ) / 100
  );
}

// ─── Basic proportional distribution ─────────────────────────────────────────

describe('computeEffectivePrices (proportional, no taxable[])', () => {
  it('single item: effectivePrice = totalAmount / quantity', () => {
    const items = [item('Widget', 10, 2)];
    const result = computeEffectivePrices(items, 11); // $1 tax
    expect(result[0].effectivePrice).toBeCloseTo(11 / 2, 2);
  });

  it('two items split proportionally by totalPrice', () => {
    // subtotal = $50, totalAmount = $55 (10% overhead)
    const items = [item('Cheap', 10), item('Expensive', 40)];
    const result = computeEffectivePrices(items, 55);
    expect(result[0].effectivePrice).toBeCloseTo(55 * (10 / 50), 2); // $11
    expect(result[1].effectivePrice).toBeCloseTo(55 * (40 / 50), 2); // $44
  });

  it('effectivePrice × quantity sums to totalAmount exactly', () => {
    const items = [item('A', 12.5, 2), item('B', 7.5, 1)];
    const result = computeEffectivePrices(items, 22);
    expect(sumPaid(result)).toBe(22);
  });

  it('preserves all other item fields', () => {
    const items = [item('Widget', 10)];
    const result = computeEffectivePrices(items, 10);
    expect(result[0].name).toBe('Widget');
    expect(result[0].totalPrice).toBe(10);
    expect(result[0].unitPrice).toBe(10);
    expect(result[0].quantity).toBe(1);
  });

  it('when totalAmount equals subtotal, effectivePrice = totalPrice / quantity', () => {
    const items = [item('A', 20, 2), item('B', 30, 3)];
    const result = computeEffectivePrices(items, 50);
    expect(result[0].effectivePrice).toBeCloseTo(10, 2); // 20/2
    expect(result[1].effectivePrice).toBeCloseTo(10, 2); // 30/3
  });

  it('when totalAmount < subtotal (rewards applied), effectivePrice is proportionally reduced', () => {
    // Amazon-style: subtotal $36.38 but only paid $7.80 after rewards
    const items = [item('Item1', 11.99), item('Item2', 24.39)];
    const result = computeEffectivePrices(items, 7.8);
    expect(result[0].effectivePrice).toBeCloseTo(7.8 * (11.99 / 36.38), 2);
    expect(result[1].effectivePrice).toBeCloseTo(7.8 * (24.39 / 36.38), 2);
    expect(sumPaid(result)).toBe(7.8);
  });

  it('quantity > 1: effectivePrice is per-unit', () => {
    const items = [item('Milk', 9.98, 2, 4.99)];
    const result = computeEffectivePrices(items, 10.88); // $0.90 tax
    // effectivePrice = (10.88 * 1.0) / 2 = 5.44
    expect(result[0].effectivePrice).toBeCloseTo(5.44, 2);
  });

  it('zero subtotal returns effectivePrice 0 for all items', () => {
    const items = [item('Free', 0), item('AlsoFree', 0)];
    const result = computeEffectivePrices(items, 0);
    expect(result[0].effectivePrice).toBe(0);
    expect(result[1].effectivePrice).toBe(0);
  });

  it('remainder correction: 3 equal items with odd-cent total', () => {
    // $1.00 × 3 items, total = $3.01 — each gets $1.00 but last absorbs the $0.01 remainder
    const items = [item('A', 1), item('B', 1), item('C', 1)];
    const result = computeEffectivePrices(items, 3.01);
    expect(result[0].effectivePrice).toBe(1.0);
    expect(result[1].effectivePrice).toBe(1.0);
    expect(result[2].effectivePrice).toBe(1.01);
    expect(sumPaid(result)).toBe(3.01);
  });

  it('remainder correction: sum always equals totalAmount exactly', () => {
    // 7 items at $1.00 each, total = $7.03 — proportional gives $1.004..., rounds to $1.00 per item
    const items = Array.from({ length: 7 }, (_, i) => item(`Item${i}`, 1));
    const result = computeEffectivePrices(items, 7.03);
    expect(sumPaid(result)).toBe(7.03);
  });

  it('undefined quantity: effectivePrice equals line-level share (treated as qty 1)', () => {
    // Amazon-style: only totalPrice known, no quantity
    const items: ScrapedItem[] = [
      { name: 'Echo Dot', totalPrice: 49.99 },
      { name: 'USB Cable', totalPrice: 12.99 },
    ];
    const result = computeEffectivePrices(items, 68.84); // includes tax/shipping
    // Each item's effectivePrice = totalAmount × (totalPrice / subtotal)
    const subtotal = 49.99 + 12.99;
    expect(result[0].effectivePrice).toBeCloseTo(68.84 * (49.99 / subtotal), 2);
    expect(result[1].effectivePrice).toBeCloseTo(68.84 * (12.99 / subtotal), 2);
    expect(sumPaid(result)).toBe(68.84);
  });

  it('mixed: some items have quantity, some undefined', () => {
    // Costco-style: most items have qty, but some (like discounts) might not
    const items: ScrapedItem[] = [
      { name: 'Milk', quantity: 2, totalPrice: 9.98 },
      { name: 'Promo Item', totalPrice: 5.0 },
    ];
    const result = computeEffectivePrices(items, 16.0);
    // Milk: (16 × 9.98/14.98) / 2 = 5.33
    expect(result[0].effectivePrice).toBeCloseTo((16 * (9.98 / 14.98)) / 2, 2);
    // Promo: (16 × 5.0/14.98) / 1 = 5.34
    expect(result[1].effectivePrice).toBeCloseTo(16 * (5.0 / 14.98), 2);
    expect(sumPaid(result)).toBe(16.0);
  });
});

// ─── Taxable[] provided (Costco-style) ───────────────────────────────────────

describe('computeEffectivePrices (with taxable[] array)', () => {
  it('tax allocated only to taxable items', () => {
    // 2 items: $10 (not taxable), $20 (taxable). Tax = $1.20, total = $31.20
    const items = [item('Food', 10), item('Tissue', 20)];
    const result = computeEffectivePrices(items, 31.2, {
      taxable: [false, true],
      tax: 1.2,
    });
    // nonTaxAmount = 31.20 - 1.20 = 30
    // Food: (30 × 10/30 + 1.20 × 0) / 1 = 10.00
    expect(result[0].effectivePrice).toBeCloseTo(10.0, 2);
    // Tissue: (30 × 20/30 + 1.20 × 1.0) / 1 = 20.00 + 1.20 = 21.20
    expect(result[1].effectivePrice).toBeCloseTo(21.2, 2);
    expect(sumPaid(result)).toBe(31.2);
  });

  it('all items taxable: behaves like proportional distribution', () => {
    const items = [item('A', 15), item('B', 35)];
    const result = computeEffectivePrices(items, 55, {
      taxable: [true, true],
      tax: 5,
    });
    // nonTaxAmount = 50, distributed 15/50 and 35/50
    // tax distributed 15/50 and 35/50 — same weights, so total = proportional
    expect(result[0].effectivePrice).toBeCloseTo(55 * (15 / 50), 2);
    expect(result[1].effectivePrice).toBeCloseTo(55 * (35 / 50), 2);
    expect(sumPaid(result)).toBe(55);
  });

  it('no items taxable: remainder correction absorbs unallocated tax', () => {
    const items = [item('A', 10), item('B', 40)];
    const result = computeEffectivePrices(items, 52, {
      taxable: [false, false],
      tax: 2,
    });
    // taxableSubtotal = 0, so tax is unallocated; nonTaxAmount = 50
    // A: 50 × (10/50) = 10; B: 50 × (40/50) = 40; remainder $2 goes to last item
    expect(result[0].effectivePrice).toBe(10);
    expect(result[1].effectivePrice).toBe(42);
    expect(sumPaid(result)).toBe(52);
  });

  it('multi-qty item: effectivePrice is per-unit including tax share', () => {
    // Tissue pack qty=2, $15.99 total; Soap qty=1, $5.00; only tissue is taxable
    const items = [item('Tissue', 15.99, 2, 7.995), item('Soap', 5.0, 1)];
    const result = computeEffectivePrices(items, 22.51, {
      taxable: [true, false],
      tax: 1.52,
    });
    // nonTaxAmount = 20.99, Tissue: (15.99 + 1.52) / 2 = 8.755 → rounds to 8.76
    // Soap: 5.00; sum = 8.76×2 + 5.00 = 22.52; remainder = -0.01 → Soap = 4.99
    expect(result[0].effectivePrice).toBe(8.76);
    expect(result[1].effectivePrice).toBe(4.99);
    expect(sumPaid(result)).toBe(22.51);
  });

  it('sum of effectivePrice × quantity equals totalAmount exactly', () => {
    const items = [item('Food', 30), item('NonFood', 20), item('Taxed', 50)];
    const tax = 3.0;
    const total = 103;
    const result = computeEffectivePrices(items, total, {
      taxable: [false, false, true],
      tax,
    });
    expect(sumPaid(result)).toBe(total);
  });
});
