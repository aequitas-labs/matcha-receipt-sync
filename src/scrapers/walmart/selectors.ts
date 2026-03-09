export const SELECTORS = {
  ORDER_CARD: '[data-testid^="order-"], [data-automation-id="order-card"]',
  ORDER_NUMBER:
    '[data-testid="order-number"], [data-automation-id="order-number"]',
  ORDER_DATE: '[data-testid="order-date"], [data-automation-id="order-date"]',
  ORDER_TOTAL:
    '[data-testid="order-total"], [data-automation-id="order-total"]',
  // Walmart has a hidden print-optimized DOM that is more reliable
  PRINT_CONTAINER: '[data-testid="order-print-container"], .print-only',
  ITEM_ROW:
    '[data-testid="line-item"], [data-automation-id="line-item"], .line-item',
  ITEM_NAME: '[data-testid="item-name"], [data-automation-id="product-name"]',
  ITEM_PRICE:
    '[data-testid="item-price"], [data-automation-id="product-price"]',
  ITEM_QTY:
    '[data-testid="item-quantity"], [data-automation-id="product-quantity"]',
} as const;
