import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { mapCostcoItems, mapCostcoOnlineItems, type CostcoRawItem, type CostcoOnlineLineItem } from './parser';
import {
  FIXTURE_STORE_LIST_20260309,
  FIXTURE_STORE_DETAIL_20260309,
  FIXTURE_ONLINE_LIST_20260309,
  FIXTURE_ONLINE_DETAIL_20260309,
} from './fixtures/index';

function stripComments(str: string): string {
  return str.replace(/^\/\/.*\n/gm, '').trim();
}

// ─── mapCostcoItems ───────────────────────────────────────────────────────────

describe('mapCostcoItems', () => {
  it('maps basic items correctly', () => {
    const items = mapCostcoItems([
      {
        itemDescription01: 'KIRKLAND CHICKEN',
        unit: 2,
        amount: 24.99,
        itemUnitPriceAmount: 12.5,
      },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('KIRKLAND CHICKEN');
    expect(items[0].quantity).toBe(2);
    expect(items[0].totalPrice).toBe(24.99);
    expect(items[0].unitPrice).toBe(12.5);
  });

  it('applies negative line item as discount on previous item', () => {
    const items = mapCostcoItems([
      {
        itemDescription01: 'KIRKLAND CHICKEN',
        unit: 2,
        amount: 24.99,
        itemUnitPriceAmount: 12.5,
      },
      {
        itemDescription01: 'MEMBER DISCOUNT',
        unit: 1,
        amount: -5.0,
        itemUnitPriceAmount: 0,
      },
    ]);
    expect(items).toHaveLength(1); // discount not added as own item
    expect(items[0].totalPrice).toBeCloseTo(19.99, 2);
    expect(items[0].unitPrice).toBeCloseTo(19.99 / 2, 2);
  });

  it('pushes negative first item as-is when there is no previous item to discount', () => {
    // Discount logic only applies when mapped.length > 0.
    // A negative item with no preceding item falls through to the normal push path.
    const items = mapCostcoItems([
      {
        itemDescription01: 'MYSTERY DISCOUNT',
        unit: 1,
        amount: -5.0,
        itemUnitPriceAmount: 0,
      },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].totalPrice).toBe(-5.0);
  });

  it('uses amount as unitPrice when itemUnitPriceAmount is 0', () => {
    const items = mapCostcoItems([
      {
        itemDescription01: 'PAPER TOWELS',
        unit: 1,
        amount: 18.99,
        itemUnitPriceAmount: 0,
      },
    ]);
    expect(items[0].unitPrice).toBe(18.99);
  });

  it('defaults quantity to 1 when unit is 0', () => {
    const items = mapCostcoItems([
      { itemDescription01: 'ITEM', unit: 0, amount: 5.99, itemUnitPriceAmount: 5.99 },
    ]);
    expect(items[0].quantity).toBe(1);
  });

  it('handles empty item array', () => {
    expect(mapCostcoItems([])).toHaveLength(0);
  });

  it('handles multiple discounts applied to separate items', () => {
    const items = mapCostcoItems([
      { itemDescription01: 'ITEM A', unit: 1, amount: 10.0, itemUnitPriceAmount: 10.0 },
      { itemDescription01: 'DISCOUNT A', unit: 1, amount: -2.0, itemUnitPriceAmount: 0 },
      { itemDescription01: 'ITEM B', unit: 1, amount: 20.0, itemUnitPriceAmount: 20.0 },
      { itemDescription01: 'DISCOUNT B', unit: 1, amount: -4.0, itemUnitPriceAmount: 0 },
    ]);
    expect(items).toHaveLength(2);
    expect(items[0].totalPrice).toBeCloseTo(8.0, 2);
    expect(items[1].totalPrice).toBeCloseTo(16.0, 2);
  });

  it('maps name from itemDescription01', () => {
    const items = mapCostcoItems([
      { itemDescription01: 'KIRKLAND SIGNATURE COFFEE', unit: 1, amount: 19.99, itemUnitPriceAmount: 19.99 },
    ]);
    expect(items[0].name).toBe('KIRKLAND SIGNATURE COFFEE');
  });

  it('preserves quantity > 1', () => {
    const items = mapCostcoItems([
      { itemDescription01: 'SODA PACK', unit: 3, amount: 14.97, itemUnitPriceAmount: 4.99 },
    ]);
    expect(items[0].quantity).toBe(3);
    expect(items[0].unitPrice).toBe(4.99);
    expect(items[0].totalPrice).toBe(14.97);
  });
});

// ─── Fixture: store receipt list (20260309-store-list.json) ─────────────────
// API: POST /graphql  query: receiptsWithCounts(startDate, endDate, ...)

describe(`store receipt list — fixture ${FIXTURE_STORE_LIST_20260309.file}`, () => {
  const raw = stripComments(readFileSync(join(__dirname, 'fixtures', FIXTURE_STORE_LIST_20260309.file), 'utf-8'));
  const data = JSON.parse(raw);
  const receipts = data.data?.receiptsWithCounts?.receipts ?? [];
  const expected = FIXTURE_STORE_LIST_20260309.expected;

  it('returns the correct number of receipts', () => {
    expect(receipts).toHaveLength(expected.receiptCount);
  });

  it('first receipt has correct warehouse, barcode, and total', () => {
    expect(receipts[0].warehouseName).toBe(expected.firstReceipt.warehouseName);
    expect(receipts[0].transactionBarcode).toBe(expected.firstReceipt.transactionBarcode);
    expect(receipts[0].total).toBeCloseTo(expected.firstReceipt.total, 2);
  });

  it('API call is POST', () => {
    expect(FIXTURE_STORE_LIST_20260309.api.method).toBe('POST');
  });
});

// ─── Fixture: store receipt detail (20260309-store.json) ─────────────────────
// API: POST /graphql  query: receiptsWithCounts(barcode, documentType: "warehouse")
// Parser: mapCostcoItems(receipt.itemArray)

describe(`mapCostcoItems — fixture ${FIXTURE_STORE_DETAIL_20260309.file}`, () => {
  const raw = stripComments(readFileSync(join(__dirname, 'fixtures', FIXTURE_STORE_DETAIL_20260309.file), 'utf-8'));
  const data = JSON.parse(raw);
  const receipt = data.data?.receiptsWithCounts?.receipts?.[0];
  const items = mapCostcoItems(receipt.itemArray as CostcoRawItem[]);
  const expected = FIXTURE_STORE_DETAIL_20260309.expected;

  it('maps to correct number of items (discount lines collapsed)', () => {
    expect(items).toHaveLength(expected.itemCount);
  });

  it('first item matches expected', () => {
    expect(items[0].name).toBe(expected.firstItem.name);
    expect(items[0].quantity).toBe(expected.firstItem.quantity);
    expect(items[0].totalPrice).toBeCloseTo(expected.firstItem.totalPrice, 2);
  });

  it('discounted item has correct final price (discount rolled up)', () => {
    const item = items.find((i) => i.name === expected.discountedItem.name);
    expect(item).toBeDefined();
    expect(item!.totalPrice).toBeCloseTo(expected.discountedItem.totalPrice, 2);
  });

  it('last item matches expected', () => {
    expect(items[items.length - 1].name).toBe(expected.lastItem.name);
    expect(items[items.length - 1].totalPrice).toBeCloseTo(expected.lastItem.totalPrice, 2);
  });

  it('receipt metadata is accessible', () => {
    expect(receipt.warehouseName).toBe(expected.warehouseName);
    expect(receipt.total).toBeCloseTo(expected.total, 2);
    expect(receipt.subTotal).toBeCloseTo(expected.subTotal, 2);
    expect(receipt.taxes).toBeCloseTo(expected.taxes, 2);
  });

  it('API call is POST', () => {
    expect(FIXTURE_STORE_DETAIL_20260309.api.method).toBe('POST');
  });
});

// ─── Fixture: online order list (20260309-online-list.json) ──────────────────
// API: POST /graphql  query: getOnlineOrders(startDate, endDate, pageNumber, ...)

describe(`online order list — fixture ${FIXTURE_ONLINE_LIST_20260309.file}`, () => {
  const raw = stripComments(readFileSync(join(__dirname, 'fixtures', FIXTURE_ONLINE_LIST_20260309.file), 'utf-8'));
  const data = JSON.parse(raw);
  const page = data.data?.getOnlineOrders?.[0];
  const expected = FIXTURE_ONLINE_LIST_20260309.expected;

  it('total number of records matches expected', () => {
    expect(page.totalNumberOfRecords).toBe(expected.totalNumberOfRecords);
  });

  it('returns correct number of orders', () => {
    expect(page.bcOrders).toHaveLength(expected.orderCount);
  });

  it('first order fields match expected', () => {
    const o = page.bcOrders[0];
    expect(o.orderNumber).toBe(expected.firstOrder.orderNumber);
    expect(o.orderTotal).toBeCloseTo(expected.firstOrder.orderTotal, 2);
    expect(o.status).toBe(expected.firstOrder.status);
  });

  it('API call is POST', () => {
    expect(FIXTURE_ONLINE_LIST_20260309.api.method).toBe('POST');
  });
});

// ─── Fixture: online order detail (20260309-online.json) ─────────────────────
// API: POST /graphql  query: getOrderDetails(orderNumbers)
// Parser: mapCostcoOnlineItems(order.shipToAddress.flatMap(s => s.orderLineItems))

describe(`mapCostcoOnlineItems — fixture ${FIXTURE_ONLINE_DETAIL_20260309.file}`, () => {
  const raw = stripComments(readFileSync(join(__dirname, 'fixtures', FIXTURE_ONLINE_DETAIL_20260309.file), 'utf-8'));
  const data = JSON.parse(raw);
  const order = data.data?.getOrderDetails;
  const lineItems: CostcoOnlineLineItem[] = (order?.shipToAddress ?? []).flatMap(
    (s: { orderLineItems?: CostcoOnlineLineItem[] }) => s.orderLineItems ?? []
  );
  const items = mapCostcoOnlineItems(lineItems);
  const expected = FIXTURE_ONLINE_DETAIL_20260309.expected;

  it('maps correct number of items (fee items excluded)', () => {
    expect(items).toHaveLength(expected.itemCount);
  });

  it('first item matches expected', () => {
    expect(items[0].name).toBe(expected.firstItem.name);
    expect(items[0].quantity).toBe(expected.firstItem.quantity);
    expect(items[0].unitPrice).toBeCloseTo(expected.firstItem.unitPrice, 2);
    expect(items[0].totalPrice).toBeCloseTo(expected.firstItem.totalPrice, 2);
  });

  it('order metadata is accessible', () => {
    expect(order.orderNumber).toBe(String(expected.orderNumber));
    expect(order.orderTotal).toBeCloseTo(expected.orderTotal, 2);
    expect(order.uSTaxTotal1).toBeCloseTo(expected.tax, 2);
    expect(order.shippingAndHandling).toBeCloseTo(expected.shipping, 2);
  });

  it('barcode from list links to order number', () => {
    const listRaw = stripComments(readFileSync(join(__dirname, 'fixtures', FIXTURE_ONLINE_LIST_20260309.file), 'utf-8'));
    const listData = JSON.parse(listRaw);
    const firstOrderNumber = listData.data?.getOnlineOrders?.[0]?.bcOrders?.[0]?.orderNumber;
    expect(firstOrderNumber).toBe(String(expected.orderNumber));
  });

  it('API call is POST', () => {
    expect(FIXTURE_ONLINE_DETAIL_20260309.api.method).toBe('POST');
  });
});
