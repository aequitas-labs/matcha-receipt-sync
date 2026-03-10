/**
 * Amazon scraper fixture manifest.
 *
 * Maps each page in the scraper flow to its fixture file, expected
 * parsed output, and relevant metadata. Used by parser tests to:
 *   1. Test each parser function against real response data
 *   2. Verify the correct scraping path for each order type
 *   3. Serve as documentation for the scraper's page contract
 *
 * Page flow:
 *   1. GET /your-orders/orders?startIndex=0&...  (order list HTML)
 *      → fixture: 20260309-list.html  (collectInvoiceUrlsFromDoc)
 *        → for each order, extract invoice URL from INVOICE_LINK selector
 *
 *   2. GET /gp/css/summary/print.html?orderID={id}  (invoice detail HTML)
 *      → fixture: 20260309.html  (parseInvoicePage)
 */

// ─── Order list page fixture ────────────────────────────────────────────────

export const FIXTURE_LIST_20260309 = {
  /** Source page */
  page: {
    method: 'GET' as const,
    url: 'https://www.amazon.com/your-orders/orders',
  },
  /** File path relative to this directory */
  file: '20260309-list.html' as const,
  /** Expected invoice refs extracted by collectInvoiceUrlsFromDoc */
  expected: {
    // First order on the page (matching 20260309.html invoice)
    firstOrderId: '114-1259648-4037869',
    firstOrderDate: 'March 6, 2026',
    // Total invoice links found on the page
    invoiceCount: 10,
  },
};

// ─── Invoice detail page fixture ────────────────────────────────────────────

export const FIXTURE_INVOICE_20260309 = {
  /** Source page (the invoice URL extracted from the order list) */
  page: {
    method: 'GET' as const,
    url: 'https://www.amazon.com/gp/css/summary/print.html?orderID=114-1259648-4037869&ref=ppx_yo2ov_dt_b_fed_invoice_pos',
  },
  /** InvoiceRef used when parsing — orderId and orderDate come from the list page */
  ref: {
    orderId: '114-1259648-4037869',
    orderDate: '2026-03-06T00:00:00.000Z',
    invoiceUrl:
      'https://www.amazon.com/gp/css/summary/print.html?orderID=114-1259648-4037869',
  },
  /** File path relative to this directory */
  file: '20260309.html' as const,
  /** Expected parsed result from parseInvoicePage(html, ref) */
  expected: {
    orderId: '114-1259648-4037869',
    totalAmount: 7.8,
    tax: 0.72,
    items: [
      {
        name: 'ArtCreativity Stacking Egg Cup Bath Toy - Set of 9 - Baby Easter Nesting Bath Toys for Toddlers in Colorful Bunny &amp; Chick Designs - Easter Egg Toys, Gifts, and Basket Stuffers for Kids',
        quantity: 1,
        unitPrice: 11.99,
        totalPrice: 11.99,
      },
      {
        name: 'Rayon Unscent Diaper Liners- Fragance Free and Chlorine Free(4PK) 400 Count by BlueSnail\uff08White\uff09',
        quantity: 1,
        unitPrice: 24.39,
        totalPrice: 24.39,
      },
    ],
  },
};

/** All Amazon fixtures */
export const ALL_AMAZON_FIXTURES = [
  FIXTURE_LIST_20260309,
  FIXTURE_INVOICE_20260309,
] as const;
