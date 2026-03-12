import { computeEffectivePrices } from '../../utils/effectivePrice';
import type { ScrapedItem } from '../../types/scraper';

export interface CostcoRawItem {
  itemDescription01: string;
  unit: number;
  amount: number;
  itemUnitPriceAmount: number;
  taxFlag?: string | null; // "Y" = taxable, "N" = not taxable, null = unknown
}

export interface CostcoOnlineLineItem {
  itemDescription: string;
  quantity: number;
  price: number; // unit price
  merchandiseTotalAmount: number;
  isFeeItem?: boolean;
}

export interface CostcoMappedItem {
  name: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice: number;
}

export interface CostcoStoreTotals {
  total: number;
  taxes: number;
  subTotal: number;
}

export interface CostcoOnlineTotals {
  orderTotal: number;
  tax: number;
  shipping: number;
}

export function mapCostcoItems(
  rawItems: CostcoRawItem[],
  totals: CostcoStoreTotals
): ScrapedItem[] {
  const mapped: CostcoMappedItem[] = [];
  const taxFlags: (string | null | undefined)[] = [];

  for (const item of rawItems) {
    if (item.amount < 0 && mapped.length > 0) {
      // Negative line = discount on previous item
      const prev = mapped[mapped.length - 1];
      prev.totalPrice += item.amount; // amount is negative
      if (prev.quantity) {
        prev.unitPrice = prev.totalPrice / prev.quantity;
      }
      // taxFlag for the previous item is unchanged (discount inherits it)
    } else {
      mapped.push({
        name: item.itemDescription01,
        quantity: item.unit || undefined,
        unitPrice: item.itemUnitPriceAmount || undefined,
        totalPrice: item.amount,
      });
      taxFlags.push(item.taxFlag);
    }
  }

  const taxable = taxFlags.map((f) => f === 'Y');
  const hasTaxInfo = taxFlags.some((f) => f === 'Y' || f === 'N');

  const baseItems: ScrapedItem[] = mapped.map((i) => ({ ...i }));

  if (hasTaxInfo) {
    return computeEffectivePrices(baseItems, totals.total, {
      taxable,
      tax: totals.taxes,
    });
  }
  return computeEffectivePrices(baseItems, totals.total);
}

export function mapCostcoOnlineItems(
  lineItems: CostcoOnlineLineItem[],
  totals: CostcoOnlineTotals
): ScrapedItem[] {
  const items: ScrapedItem[] = lineItems
    .filter((i) => !i.isFeeItem)
    .map((i) => ({
      name: i.itemDescription,
      quantity: i.quantity || undefined,
      unitPrice: i.price || undefined,
      totalPrice: i.merchandiseTotalAmount,
    }));

  return computeEffectivePrices(items, totals.orderTotal, {
    tax: totals.tax,
  });
}
