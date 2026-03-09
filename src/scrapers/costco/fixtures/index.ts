/**
 * Costco scraper fixture manifest.
 *
 * Maps each GraphQL call in the scraper flow to its fixture file, expected
 * parsed output, and relevant metadata. Used by parser tests to:
 *   1. Test each parser function against real response data
 *   2. Document the full API call chain (list → detail)
 *   3. Verify handling of discount lines and multi-unit items
 *
 * API call flow:
 *   IN-STORE (warehouse) receipts:
 *     POST /graphql  query: receiptsWithCounts(startDate, endDate, documentType, documentSubType)
 *       → fixture: 20260309-store-list.json  (receipt summaries, itemArray has itemNumber only)
 *         → for each receipt.transactionBarcode:
 *           POST /graphql  query: receiptsWithCounts(barcode, documentType: "warehouse")
 *             → fixture: 20260309-store.json  (mapCostcoItems)
 *
 *   ONLINE orders:
 *     POST /graphql  query: getOnlineOrders(startDate, endDate, pageNumber, pageSize, warehouseNumber)
 *       → fixture: 20260309-online-list.json  (order summaries)
 *         → for each order.orderNumber:
 *           POST /graphql  query: getOrderDetails(orderNumbers)
 *             → fixture: 20260309-online.json  (mapCostcoOnlineItems)
 */

const GRAPHQL_URL = 'https://ecom-api.costco.com/ebusiness/order/v1/orders/graphql';

// ─── In-store receipt list fixture ──────────────────────────────────────────

export const FIXTURE_STORE_LIST_20260309 = {
  api: {
    method: 'POST' as const,
    url: GRAPHQL_URL,
    query: 'receiptsWithCounts',
    variables: { startDate: '1/01/2026', endDate: '3/31/2026', documentType: 'all', documentSubType: 'all' },
  },
  file: '20260309-store-list.json' as const,
  expected: {
    receiptCount: 1,
    firstReceipt: {
      warehouseName: 'WHEATON',
      transactionBarcode: '21112400701222602041152',
      total: 252.74,
      transactionDateTime: '2026-02-04T11:52:00',
    },
  },
};

// ─── In-store receipt detail fixture ────────────────────────────────────────

export const FIXTURE_STORE_DETAIL_20260309 = {
  api: {
    method: 'POST' as const,
    url: GRAPHQL_URL,
    query: 'receiptsWithCounts',
    variables: { barcode: '21112400701222602041152', documentType: 'warehouse' },
  },
  file: '20260309-store.json' as const,
  /** Expected result from mapCostcoItems(receipt.itemArray) */
  expected: {
    warehouseName: 'WHEATON',
    total: 252.74,
    subTotal: 250.52,
    taxes: 2.22,
    // After discount rollup: 23 raw items → 22 mapped (item 14 is a -$3.50 discount on item 13)
    itemCount: 22,
    // Spot-check a few items
    firstItem: { name: 'VEG BASE', quantity: 1, unitPrice: 9.49, totalPrice: 9.49 },
    // Item 13 (HVR HOMESTYL) had a -$3.50 discount applied from item 14 (/   5354)
    discountedItem: { name: 'HVR HOMESTYL', quantity: 1, totalPrice: 8.99 }, // 12.49 - 3.50
    lastItem: { name: 'WILD SALMON', quantity: 1, unitPrice: 21.99, totalPrice: 21.99 },
  },
};

// ─── Online order list fixture ───────────────────────────────────────────────

export const FIXTURE_ONLINE_LIST_20260309 = {
  api: {
    method: 'POST' as const,
    url: GRAPHQL_URL,
    query: 'getOnlineOrders',
    variables: { pageNumber: 1, pageSize: 10, startDate: '2025-10-01', endDate: '2025-12-31', warehouseNumber: '847' },
  },
  file: '20260309-online-list.json' as const,
  expected: {
    totalNumberOfRecords: 1,
    orderCount: 1,
    firstOrder: {
      orderNumber: '1109813695',
      orderTotal: 381.59,
      orderPlacedDate: '2024-05-03T08:39:32.78',
      status: 'Delivered',
    },
  },
};

// ─── Online order detail fixture ─────────────────────────────────────────────

export const FIXTURE_ONLINE_DETAIL_20260309 = {
  api: {
    method: 'POST' as const,
    url: GRAPHQL_URL,
    query: 'getOrderDetails',
    variables: { orderNumbers: ['1109813695'] },
  },
  file: '20260309-online.json' as const,
  /** Expected result from mapCostcoOnlineItems(order.shipToAddress.flatMap(s => s.orderLineItems)) */
  expected: {
    orderNumber: '1109813695',
    orderTotal: 381.59,
    tax: 21.6,
    shipping: 0,
    itemCount: 1,
    firstItem: {
      name: 'Keter Cortina Alto Premium Modern Vertical Outdoor Storage Shed',
      quantity: 1,
      unitPrice: 359.99,
      totalPrice: 359.99,
    },
  },
};

/** All Costco fixtures */
export const ALL_COSTCO_FIXTURES = [
  FIXTURE_STORE_LIST_20260309,
  FIXTURE_STORE_DETAIL_20260309,
  FIXTURE_ONLINE_LIST_20260309,
  FIXTURE_ONLINE_DETAIL_20260309,
] as const;
