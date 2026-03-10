/**
 * Target scraper fixture manifest.
 *
 * Maps each API call in the scraper flow to its fixture file, expected
 * parsed output, and any relevant metadata. Used by parser tests to:
 *   1. Test each parser function against real response data
 *   2. Verify the correct API path is chosen for each order type
 *   3. Serve as documentation for the scraper's API contract
 *
 * API call flow:
 *   ONLINE orders:
 *     GET  /guest_order_aggregations/v1/order_history?order_purchase_type=ONLINE
 *       → GET  /post_order_invoices/v1/orders/{orderId}/invoices
 *         → GET  /post_order_invoices/v1/orders/{orderId}/invoices/{invoiceId}
 *               → fixture: 20260309-online.json  (mapTargetInvoiceLines)
 *
 *   STORE orders (structured):
 *     GET  /guest_order_aggregations/v1/order_history?order_purchase_type=STORE
 *       → GET  /guest_order_aggregations/v1/{storeReceiptId}/store_order_details
 *             → fixture: 20260309-store.json  (mapTargetStoreLines)
 *
 *   STORE orders (HTML receipt):
 *     POST /receipts/v1/invoice
 *          body: { receipt_name, receipt_id, printer_type: "html" }
 *       → fixture: 20260309-store.html  (parseTargetReceiptHtml)
 */

// ─── Online invoice detail fixture ─────────────────────────────────────────

export const FIXTURE_ONLINE_20260309 = {
  /** Source API call */
  api: {
    method: 'GET' as const,
    url: 'https://api.target.com/post_order_invoices/v1/orders/26263991019234597/invoices/50263991019234597',
  },
  /** File path relative to this directory */
  file: '20260309-online.json' as const,
  /** Expected parsed result from mapTargetInvoiceLines(data.lines) */
  expected: {
    items: [
      {
        name: 'HealthyBaby Certified Safe Organic Cotton Enhanced Diapers - Size 3 - 56ct',
        quantity: 1,
        unitPrice: 28.39,
        totalPrice: 28.39,
      },
    ],
    tax: 0,
    total: 28.39,
  },
};

// ─── Store order detail fixture (JSON API) ──────────────────────────────────

export const FIXTURE_STORE_JSON_20260309 = {
  /** Source API call */
  api: {
    method: 'GET' as const,
    url: 'https://api.target.com/guest_order_aggregations/v1/5093-1415-0161-0798/store_order_details',
  },
  /** File path relative to this directory */
  file: '20260309-store.json' as const,
  /** Expected parsed result from mapTargetStoreLines(data.order_lines) */
  expected: {
    items: [
      {
        // Carter's 18M — HTML entities decoded, quantity 1
        name: "Carter's Just One You\u00AE\uFE0F Baby Plaid Suspender Top & Bottom Set - Green 18M: Cotton Bodysuit & Chino Pant",
        quantity: 1,
        unitPrice: 20.0,
        totalPrice: 20.0,
      },
      {
        // Carter's Newborn
        name: "Carter's Just One You\u00AE\uFE0F Baby Plaid Suspender Top & Bottom Set - Green Newborn: Cotton Bodysuit & Chino Pant",
        quantity: 1,
        unitPrice: 20.0,
        totalPrice: 20.0,
      },
      {
        // Carter's 3M
        name: "Carter's Just One You\u00AE\uFE0F Baby Plaid Suspender Top & Bottom Set - Green 3M: Cotton Bodysuit & Chino Pant",
        quantity: 1,
        unitPrice: 20.0,
        totalPrice: 20.0,
      },
      {
        // Fairlife milk — qty 2
        name: 'Fairlife Lactose-Free 2% Milk - 52 fl oz',
        quantity: 2,
        unitPrice: 4.99,
        totalPrice: 9.98,
      },
      {
        // Salmon — Good & Gather with trademark
        name: 'Atlantic Salmon - Frozen - 16oz - Good & Gather\u2122',
        quantity: 1,
        unitPrice: 12.39,
        totalPrice: 12.39,
      },
    ],
    tax: 2.95,
    total: 70.32,
    storeName: 'Springfield Target',
  },
};

// ─── Store HTML receipt fixture (POST /receipts/v1/invoice) ─────────────────

export const FIXTURE_STORE_HTML_20260309 = {
  /** Source API call */
  api: {
    method: 'POST' as const,
    url: 'https://api.target.com/receipts/v1/invoice',
    body: {
      receipt_name: 'Guest Sale Receipt',
      receipt_id: '5093141501610798',
      printer_type: 'html',
    },
  },
  /** File path relative to this directory */
  file: '20260309-store.html' as const,
  /** Expected parsed result from parseTargetReceiptHtml(html) */
  expected: {
    items: [
      {
        name: "Carter's JOY",
        dpci: '206067033',
        quantity: 1,
        totalPrice: 20.0,
      },
      {
        name: "Carter's JOY",
        dpci: '206067028',
        quantity: 1,
        totalPrice: 20.0,
      },
      {
        name: "Carter's JOY",
        dpci: '206067029',
        quantity: 1,
        totalPrice: 20.0,
      },
      { name: 'FAIRLIFE', dpci: '284061241', quantity: 2, totalPrice: 9.98 },
      { name: 'GG SEAFOOD', dpci: '210070009', quantity: 1, totalPrice: 12.39 },
    ],
    subtotal: 82.37,
    discount: 15.0,
    tax: 2.95,
    total: 70.32,
  },
};

// ─── Online order history fixture ───────────────────────────────────────────

export const FIXTURE_ONLINE_ORDER_HISTORY_20260309 = {
  /** Source API call */
  api: {
    method: 'GET' as const,
    url: 'https://api.target.com/guest_order_aggregations/v1/order_history?order_purchase_type=ONLINE',
  },
  /** File path relative to this directory */
  file: '20260309-online-order-history.json' as const,
  /** Expected top-level fields */
  expected: {
    totalOrders: 5,
    totalPages: 1,
    firstOrder: {
      placed_date: '2025-01-26T06:49:22-06:00',
      order_purchase_type: 'ONLINE',
      grand_total: '28.39',
      order_number: '102002330130026',
    },
  },
};

// ─── Store order history fixture ─────────────────────────────────────────────

export const FIXTURE_STORE_ORDER_HISTORY_20260309 = {
  /** Source API call */
  api: {
    method: 'GET' as const,
    url: 'https://api.target.com/guest_order_aggregations/v1/order_history?order_purchase_type=STORE',
  },
  /** File path relative to this directory */
  file: '20260309-store-order-history.json' as const,
  /** Expected top-level fields */
  expected: {
    totalOrders: 3,
    totalPages: 1,
    firstOrder: {
      placed_date: '2025-04-03T11:16:25-05:00',
      order_purchase_type: 'STORE',
      grand_total: '70.32',
      store_receipt_id: '5093-1415-0161-0798',
    },
  },
};

// ─── Online invoices list fixture ────────────────────────────────────────────

export const FIXTURE_ONLINE_INVOICES_20260309 = {
  /** Source API call */
  api: {
    method: 'GET' as const,
    url: 'https://api.target.com/post_order_invoices/v1/orders/102002330130026/invoices',
  },
  /** File path relative to this directory */
  file: '20260309-online-invoices.json' as const,
  /** Expected invoices list */
  expected: {
    invoiceCount: 1,
    firstInvoice: {
      id: '50263991019234597',
      type: 'SHIPMENT',
      amount: 28.39,
    },
  },
};

/** All Target fixtures in one array for table-driven tests */
export const ALL_TARGET_FIXTURES = [
  FIXTURE_ONLINE_ORDER_HISTORY_20260309,
  FIXTURE_STORE_ORDER_HISTORY_20260309,
  FIXTURE_ONLINE_INVOICES_20260309,
  FIXTURE_ONLINE_20260309,
  FIXTURE_STORE_JSON_20260309,
  FIXTURE_STORE_HTML_20260309,
] as const;
