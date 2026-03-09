export interface CostcoRawItem {
  itemDescription01: string;
  unit: number;
  amount: number;
  itemUnitPriceAmount: number;
}

export interface CostcoOnlineLineItem {
  itemDescription: string;
  quantity: number;
  price: number;            // unit price
  merchandiseTotalAmount: number;
  isFeeItem?: boolean;
}

export interface CostcoMappedItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export function mapCostcoItems(rawItems: CostcoRawItem[]): CostcoMappedItem[] {
  const mapped: CostcoMappedItem[] = [];

  for (const item of rawItems) {
    if (item.amount < 0 && mapped.length > 0) {
      // Negative line = discount on previous item
      const prev = mapped[mapped.length - 1];
      prev.totalPrice += item.amount; // amount is negative
      prev.unitPrice = prev.totalPrice / prev.quantity;
    } else {
      mapped.push({
        name: item.itemDescription01,
        quantity: item.unit || 1,
        unitPrice: item.itemUnitPriceAmount || item.amount,
        totalPrice: item.amount,
      });
    }
  }

  return mapped;
}

export function mapCostcoOnlineItems(lineItems: CostcoOnlineLineItem[]): CostcoMappedItem[] {
  return lineItems
    .filter((i) => !i.isFeeItem)
    .map((i) => ({
      name: i.itemDescription,
      quantity: i.quantity || 1,
      unitPrice: i.price,
      totalPrice: i.merchandiseTotalAmount,
    }));
}
