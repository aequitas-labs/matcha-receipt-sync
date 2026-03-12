import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseOrders, type WalmartOrder } from './parser';
import { FIXTURE_NEXT_DATA_20260309 } from './fixtures/index';

const CUTOFF = new Date('2024-01-01T00:00:00.000Z');

// ─── parseOrders ─────────────────────────────────────────────────────────────

describe('parseOrders', () => {
  it('maps a WalmartOrder to receipt shape', () => {
    const orders: WalmartOrder[] = [
      {
        displayId: 'WM-12345',
        orderDate: '2024-06-15T10:00:00.000Z',
        priceDetails: {
          orderTotal: { value: 54.23 },
          subTotal: { value: 50.0 },
        },
        groups: [
          {
            items: [
              {
                name: 'Tide Pods Laundry Detergent',
                quantity: 2,
                linePrice: 24.97,
                unitPrice: 12.49,
              },
            ],
          },
        ],
      },
    ];
    const { receipts, reachedCutoff } = parseOrders(orders, CUTOFF);
    expect(receipts).toHaveLength(1);
    expect(receipts[0].orderId).toBe('WM-12345');
    expect(receipts[0].total).toBe(54.23);
    expect(receipts[0].items).toHaveLength(1);
    expect(receipts[0].items[0].name).toBe('Tide Pods Laundry Detergent');
    expect(receipts[0].items[0].quantity).toBe(2);
    expect(receipts[0].items[0].unitPrice).toBe(12.49);
    expect(receipts[0].items[0].totalPrice).toBe(24.97);
    expect(reachedCutoff).toBe(false);
  });

  it('prefers displayId over id', () => {
    const orders: WalmartOrder[] = [
      {
        id: 'raw-id',
        displayId: 'WM-DISPLAY',
        orderDate: '2024-06-15T00:00:00.000Z',
        groups: [],
      },
    ];
    const { receipts } = parseOrders(orders, CUTOFF);
    expect(receipts[0].orderId).toBe('WM-DISPLAY');
  });

  it('falls back to id when displayId is absent', () => {
    const orders: WalmartOrder[] = [
      {
        id: 'raw-id-only',
        orderDate: '2024-06-15T00:00:00.000Z',
        groups: [],
      },
    ];
    const { receipts } = parseOrders(orders, CUTOFF);
    expect(receipts[0].orderId).toBe('raw-id-only');
  });

  it('sets reachedCutoff=true and stops when an order is before cutoff', () => {
    const orders: WalmartOrder[] = [
      {
        displayId: 'WM-NEW',
        orderDate: '2024-06-15T00:00:00.000Z',
        groups: [],
      },
      {
        displayId: 'WM-OLD',
        orderDate: '2023-12-01T00:00:00.000Z',
        groups: [],
      },
      {
        displayId: 'WM-NEVER-REACHED',
        orderDate: '2024-03-01T00:00:00.000Z',
        groups: [],
      },
    ];
    const { receipts, reachedCutoff } = parseOrders(orders, CUTOFF);
    expect(receipts).toHaveLength(1); // only WM-NEW
    expect(reachedCutoff).toBe(true);
  });

  it('skips orders with no id', () => {
    const orders: WalmartOrder[] = [
      { orderDate: '2024-06-15T00:00:00.000Z', groups: [] },
    ];
    const { receipts } = parseOrders(orders, CUTOFF);
    expect(receipts).toHaveLength(0);
  });

  it('skips orders with invalid orderDate', () => {
    const orders: WalmartOrder[] = [
      { displayId: 'WM-1', orderDate: 'not-a-date', groups: [] },
    ];
    const { receipts } = parseOrders(orders, CUTOFF);
    expect(receipts).toHaveLength(0);
  });

  it('skips orders with missing orderDate', () => {
    const orders: WalmartOrder[] = [{ displayId: 'WM-1', groups: [] }];
    const { receipts } = parseOrders(orders, CUTOFF);
    expect(receipts).toHaveLength(0);
  });

  it('calculates tax as total - subTotal when subTotal present and total > subTotal', () => {
    const orders: WalmartOrder[] = [
      {
        displayId: 'WM-TAX',
        orderDate: '2024-06-15T00:00:00.000Z',
        priceDetails: {
          orderTotal: { value: 54.23 },
          subTotal: { value: 50.0 },
        },
        groups: [],
      },
    ];
    const { receipts } = parseOrders(orders, CUTOFF);
    expect(receipts[0].tax).toBeCloseTo(4.23, 2);
  });

  it('does not set tax when total equals subTotal', () => {
    const orders: WalmartOrder[] = [
      {
        displayId: 'WM-NOTAX',
        orderDate: '2024-06-15T00:00:00.000Z',
        priceDetails: {
          orderTotal: { value: 50.0 },
          subTotal: { value: 50.0 },
        },
        groups: [],
      },
    ];
    const { receipts } = parseOrders(orders, CUTOFF);
    expect(receipts[0].tax).toBeUndefined();
  });

  it('does not set tax when subTotal is missing', () => {
    const orders: WalmartOrder[] = [
      {
        displayId: 'WM-NOSUBTOTAL',
        orderDate: '2024-06-15T00:00:00.000Z',
        priceDetails: { orderTotal: { value: 50.0 } },
        groups: [],
      },
    ];
    const { receipts } = parseOrders(orders, CUTOFF);
    expect(receipts[0].tax).toBeUndefined();
  });

  it('handles missing priceDetails gracefully', () => {
    const orders: WalmartOrder[] = [
      {
        displayId: 'WM-NOPRICE',
        orderDate: '2024-06-15T00:00:00.000Z',
        groups: [],
      },
    ];
    const { receipts } = parseOrders(orders, CUTOFF);
    expect(receipts[0].total).toBe(0);
  });

  it('item price fallback: linePrice -> totalPrice -> itemPrice', () => {
    const orders: WalmartOrder[] = [
      {
        displayId: 'WM-PRICE',
        orderDate: '2024-06-15T00:00:00.000Z',
        groups: [
          {
            items: [
              { name: 'A', linePrice: 10 },
              { name: 'B', totalPrice: 20 }, // no linePrice
              { name: 'C', itemPrice: 30 }, // no linePrice or totalPrice
            ],
          },
        ],
      },
    ];
    const { receipts } = parseOrders(orders, CUTOFF);
    expect(receipts[0].items[0].totalPrice).toBe(10);
    expect(receipts[0].items[1].totalPrice).toBe(20);
    expect(receipts[0].items[2].totalPrice).toBe(30);
  });

  it('unit price fallback: unitPrice -> price -> linePrice/qty', () => {
    const orders: WalmartOrder[] = [
      {
        displayId: 'WM-UNIT',
        orderDate: '2024-06-15T00:00:00.000Z',
        groups: [
          {
            items: [
              { name: 'A', linePrice: 10, unitPrice: 5, quantity: 2 }, // explicit unitPrice
              { name: 'B', linePrice: 10, price: 4, quantity: 2 }, // price field
              { name: 'C', linePrice: 10, quantity: 2 }, // derived from linePrice/qty
            ],
          },
        ],
      },
    ];
    const { receipts } = parseOrders(orders, CUTOFF);
    expect(receipts[0].items[0].unitPrice).toBe(5);
    expect(receipts[0].items[1].unitPrice).toBe(4);
    expect(receipts[0].items[2].unitPrice).toBe(5); // 10/2
  });

  it('skips items with no name', () => {
    const orders: WalmartOrder[] = [
      {
        displayId: 'WM-NONAME',
        orderDate: '2024-06-15T00:00:00.000Z',
        groups: [{ items: [{ quantity: 1, linePrice: 5 }] }],
      },
    ];
    const { receipts } = parseOrders(orders, CUTOFF);
    expect(receipts[0].items).toHaveLength(0);
  });

  it('handles empty orders array', () => {
    const { receipts, reachedCutoff } = parseOrders([], CUTOFF);
    expect(receipts).toHaveLength(0);
    expect(reachedCutoff).toBe(false);
  });

  it('leaves quantity undefined when missing', () => {
    const orders: WalmartOrder[] = [
      {
        displayId: 'WM-QTY',
        orderDate: '2024-06-15T00:00:00.000Z',
        groups: [{ items: [{ name: 'Item', linePrice: 9.99 }] }],
      },
    ];
    const { receipts } = parseOrders(orders, CUTOFF);
    expect(receipts[0].items[0].quantity).toBeUndefined();
  });
});

// ─── Fixture: __NEXT_DATA__ order history (20260309-next_data.html) ──────────
// Page: GET /purchase-history
// Parser: parseOrders(orders, cutoff) where orders come from __NEXT_DATA__

describe(`parseOrders — fixture ${FIXTURE_NEXT_DATA_20260309.file}`, () => {
  const html = readFileSync(
    join(__dirname, 'fixtures', FIXTURE_NEXT_DATA_20260309.file),
    'utf-8'
  );
  const scriptMatch = html.match(
    /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
  );
  const data = JSON.parse(scriptMatch![1]);
  const orders: WalmartOrder[] =
    data.props?.pageProps?.phRedesignInitialData?.data?.purchaseHistory
      ?.orders ?? [];
  const expected = FIXTURE_NEXT_DATA_20260309.expected;

  it('extracts the correct number of orders from __NEXT_DATA__', () => {
    expect(orders).toHaveLength(expected.orderCount);
  });

  it('first order has correct id and displayId', () => {
    expect(orders[0].id).toBe(expected.firstOrder.id);
    expect(orders[0].displayId).toBe(expected.firstOrder.displayId);
  });

  it('first order total and subTotal match expected', () => {
    expect(orders[0].priceDetails?.orderTotal?.value).toBeCloseTo(
      expected.firstOrder.total,
      2
    );
    expect(orders[0].priceDetails?.subTotal?.value).toBeCloseTo(
      expected.firstOrder.subTotal,
      2
    );
  });

  it('parseOrders produces receipts for all orders (no cutoff)', () => {
    const { receipts } = parseOrders(orders, new Date('2020-01-01'));
    expect(receipts).toHaveLength(expected.orderCount);
  });

  it('all receipts have non-negative totals', () => {
    const { receipts } = parseOrders(orders, new Date('2020-01-01'));
    for (const r of receipts) {
      expect(r.total).toBeGreaterThanOrEqual(0);
    }
  });

  it('page method is GET', () => {
    expect(FIXTURE_NEXT_DATA_20260309.page.method).toBe('GET');
  });
});
