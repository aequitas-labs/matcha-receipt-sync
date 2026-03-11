// Amazon order history page (2025-2026 consumer layout).
// The order list page is used only to collect invoice URLs.
// The invoice/print page has full itemized detail.

export const ORDER_LIST_SELECTORS = {
  ORDER_GROUP:
    '.js-order-card, [id="orderCard"], .order-card, .a-box-group.order',
  ORDER_ID:
    '.yohtmlc-order-id span[dir="ltr"], ' +
    '.yohtmlc-order-id span:last-child, ' +
    'a[href*="orderID="]',
  ORDER_HEADER_ITEM: '.order-header__header-list-item',
  INVOICE_LINK: 'a[href*="summary/print.html"]',
} as const;

// Invoice page selectors (print.html).
// Amazon's print/invoice page uses simple HTML tables, much more stable than
// the order list page. These will need real-world validation but the print
// page has been table-based for years.
export const INVOICE_SELECTORS = {
  // Each item row in the items table
  ITEM_ROW: 'table tr',
  // We'll parse the invoice page by text patterns rather than specific selectors
  // since the print page structure varies. The service worker will use a
  // text-based parsing approach on the fetched HTML.
} as const;
