export interface WalmartItem {
  name?: string;
  quantity?: number;
  linePrice?: number;
  unitPrice?: number;
  // Alternate field names from different GraphQL response shapes
  itemPrice?: number;
  totalPrice?: number;
  price?: number;
}

export interface WalmartGroup {
  items?: WalmartItem[];
}

export interface WalmartOrder {
  id?: string;
  displayId?: string;
  orderDate?: string;
  priceDetails?: {
    orderTotal?: { value?: number };
    subTotal?: { value?: number };
  };
  groups?: WalmartGroup[];
}

export interface WalmartReceipt {
  orderId: string;
  orderDate: string;
  total: number;
  tax?: number;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  rawData?: Record<string, unknown>;
}

export function parseOrders(
  orders: WalmartOrder[],
  cutoff: Date
): {
  receipts: WalmartReceipt[];
  reachedCutoff: boolean;
} {
  const receipts: WalmartReceipt[] = [];
  let reachedCutoff = false;

  for (const order of orders) {
    const orderId = order.displayId || order.id;
    if (!orderId) continue;

    const orderDate = order.orderDate ? new Date(order.orderDate) : null;
    if (!orderDate || isNaN(orderDate.getTime())) continue;

    if (orderDate < cutoff) {
      reachedCutoff = true;
      break;
    }

    const total = order.priceDetails?.orderTotal?.value ?? 0;
    const items: WalmartReceipt['items'] = [];

    for (const group of order.groups ?? []) {
      for (const item of group.items ?? []) {
        if (!item.name) continue;
        const qty = item.quantity ?? 1;
        const lineTotal = item.linePrice ?? item.totalPrice ?? item.itemPrice ?? 0;
        const unit = item.unitPrice ?? item.price ?? (qty > 0 ? lineTotal / qty : 0);
        items.push({
          name: item.name,
          quantity: qty,
          unitPrice: unit,
          totalPrice: lineTotal,
        });
      }
    }

    const subTotal = order.priceDetails?.subTotal?.value;
    receipts.push({
      orderId,
      orderDate: orderDate.toISOString(),
      total,
      tax:
        subTotal != null && total > subTotal
          ? Math.round((total - subTotal) * 100) / 100
          : undefined,
      items,
      rawData: {
        subTotal,
      },
    });
  }

  return { receipts, reachedCutoff };
}
