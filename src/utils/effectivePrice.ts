import type { ScrapedItem } from '../types/scraper';

/**
 * Compute effectivePrice for each item — the per-unit cost including this
 * item's proportional share of receipt-level tax and shipping.
 *
 * Algorithm:
 *   subtotal = sum of item.totalPrice across all items
 *   share_i  = item.totalPrice / subtotal   (proportional weight)
 *
 *   When taxable[] is NOT provided (tax unknown per item):
 *     effectivePrice_i = (totalAmount × share_i) / quantity
 *
 *   When taxable[] IS provided (e.g. Costco taxFlag):
 *     taxableSubtotal = sum of totalPrice for taxable items
 *     taxShare_i      = totalPrice / taxableSubtotal  (for taxable items only)
 *     nonTaxAmount    = totalAmount - tax
 *     effectivePrice_i = (nonTaxAmount × share_i + tax × taxShare_i) / quantity
 *       where taxShare_i = 0 for non-taxable items
 *
 * Notes:
 *   - totalAmount is what was actually paid (after rewards/coupons at receipt level)
 *   - Item-level discounts are already reflected in totalPrice before this is called
 *   - If subtotal is 0 (all items are $0), effectivePrice is set to 0
 *   - Results are rounded to 2 decimal places (cents); any remainder is assigned
 *     to the last item so sum(effectivePrice × quantity) === totalAmount exactly
 */
export function computeEffectivePrices(
  items: ScrapedItem[],
  totalAmount: number,
  options?: {
    /** Per-item taxability flags (parallel array to items) */
    taxable?: boolean[];
    /** Receipt-level tax amount (required when taxable[] is provided) */
    tax?: number;
  }
): ScrapedItem[] {
  const subtotal = items.reduce((s, i) => s + i.totalPrice, 0);
  if (subtotal === 0) {
    return items.map((i) => ({ ...i, effectivePrice: 0 }));
  }

  const { taxable, tax } = options ?? {};

  let result: ScrapedItem[];

  if (taxable && tax != null) {
    // Split: non-tax portion distributed proportionally, tax portion only to taxable items
    const taxableSubtotal = items.reduce(
      (s, i, idx) => s + (taxable[idx] ? i.totalPrice : 0),
      0
    );
    const nonTaxAmount = totalAmount - tax;

    result = items.map((item, idx) => {
      const baseShare = item.totalPrice / subtotal;
      const taxShare =
        taxable[idx] && taxableSubtotal > 0
          ? item.totalPrice / taxableSubtotal
          : 0;
      const effective =
        (nonTaxAmount * baseShare + tax * taxShare) / (item.quantity || 1);
      return { ...item, effectivePrice: round2(effective) };
    });
  } else {
    // No per-item taxability — distribute totalAmount proportionally
    result = items.map((item) => {
      const share = item.totalPrice / subtotal;
      const effective = (totalAmount * share) / (item.quantity || 1);
      return { ...item, effectivePrice: round2(effective) };
    });
  }

  // Assign any rounding remainder to the last item so totals reconcile exactly
  const paid = result.reduce(
    (s, i) => round2(s + round2(i.effectivePrice! * i.quantity)),
    0
  );
  const remainder = round2(round2(totalAmount) - paid);
  if (remainder !== 0) {
    const last = result[result.length - 1];
    last.effectivePrice = round2(
      last.effectivePrice! + remainder / last.quantity
    );
  }

  return result;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
