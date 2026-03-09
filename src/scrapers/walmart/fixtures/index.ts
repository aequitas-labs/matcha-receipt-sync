/**
 * Walmart scraper fixture manifest.
 *
 * Maps each page/API call in the scraper flow to its fixture file, expected
 * parsed output, and relevant metadata. Used by parser tests to:
 *   1. Test each parser function against real response data
 *   2. Verify the correct scraping path is used for each order type
 *   3. Serve as documentation for the scraper's API contract
 *
 * Page flow:
 *   1. GET /purchase-history  (order history page with __NEXT_DATA__)
 *      → fixture: 20260309-next_data.html
 *        → parse __NEXT_DATA__ JSON for first page of orders (no item prices)
 *        → parseOrders(orders, cutoff)
 *
 *   2. GET https://www.walmart.com/orchestra/cph/graphql/PurchaseHistoryV3/...
 *      → paginated GraphQL for additional pages (same order shape as __NEXT_DATA__)
 *
 *   3. GET /orders/{orderId}  (order detail page for item prices)
 *      → fixture: 20260309.html
 *        → parse data-testid="productName" + data-testid="line-price" pairs
 */

// ─── Order history __NEXT_DATA__ fixture ────────────────────────────────────

export const FIXTURE_NEXT_DATA_20260309 = {
  /** Source page */
  page: {
    method: 'GET' as const,
    url: 'https://www.walmart.com/purchase-history',
  },
  /** File path relative to this directory */
  file: '20260309-next_data.html' as const,
  /** Expected orders extracted from __NEXT_DATA__ purchaseHistory.orders */
  expected: {
    orderCount: 5,
    firstOrder: {
      id: '200014653079776',
      displayId: '2000146-53079776',
      orderDate: '2026-03-04T22:39:05-05:00',
      total: 114.46,
      subTotal: 107.98,
    },
  },
};

// ─── Order detail page fixture ───────────────────────────────────────────────

export const FIXTURE_ORDER_DETAIL_20260309 = {
  /** Source page */
  page: {
    method: 'GET' as const,
    url: 'https://www.walmart.com/orders/200013985291945',
  },
  /** File path relative to this directory */
  file: '20260309.html' as const,
  /** Expected items parsed from data-testid="productName" + data-testid="line-price" */
  expected: {
    orderId: '2000139-85291945',
    orderDate: 'Oct 12, 2025',
    total: 46.29,
    tax: 2.61,
    items: [
      { name: 'FolkArt Glow-in-the-Dark Acrylic Craft Paint, Matte Finish, Blue, 2 fl oz', quantity: 1, totalPrice: 2.27 },
      { name: 'The Original Duck Tape Brand Duct Tape, 1.88 in. x 55 yd., Silver', quantity: 1, totalPrice: 3.97 },
      { name: "Elmer's Liquid School Glue, White, Washable, Great for Making Slime, 1-Quart (32 oz.), Dry time 5 min.", quantity: 1, totalPrice: 8.87 },
      { name: '100 Sheets Gold Foil Paper Art Gold Foil Sheets Gilding Brush Thin Gold Leaf Sheets Gold Foil Paper Craft for Arts Painting Gilding Crafting Decoration, 5.5 x 5.5 Inches', quantity: 1, totalPrice: 9.99 },
      { name: 'Yalumo 500 Pieces Pipe Cleaners Craft Supplies, Green Pipe Cleaners Bulk for DIY Crafts, 12 Inch Fuzzy Chenille Stems Sticks Set', quantity: 1, totalPrice: 12.99 },
      { name: 'BORISCA 6 Pieces Party Curtain Metallic Fringe Curtain, Gold Glitter Birthday Fringe Curtain, Sparkly Fringe Curtains for Photography, Christmas Party, Wedding Party (Gold)', quantity: 1, totalPrice: 5.59 },
    ],
  },
};

/** All Walmart fixtures */
export const ALL_WALMART_FIXTURES = [
  FIXTURE_NEXT_DATA_20260309,
  FIXTURE_ORDER_DETAIL_20260309,
] as const;
