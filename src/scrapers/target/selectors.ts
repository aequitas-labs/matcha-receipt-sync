export const SELECTORS = {
  ORDER_CARD:
    '[data-test="@web/OrderHistory/OrderCard"], ' +
    '[data-test="orderCard"], ' +
    '[class*="OrderCard"]',
  ORDER_ID: '[data-test="orderNumber"], [data-test="order-number"]',
  ORDER_DATE: '[data-test="orderDate"], [data-test="order-date"]',
  ORDER_TOTAL: '[data-test="orderTotal"], [data-test="order-total"]',
  ITEM_ROW:
    '[data-test="@web/OrderHistory/LineItem"], ' +
    '[data-test="lineItem"], ' +
    '[class*="LineItem"]',
  ITEM_NAME: '[data-test="itemName"], [data-test="product-name"]',
  ITEM_PRICE: '[data-test="itemPrice"], [data-test="product-price"]',
} as const;
