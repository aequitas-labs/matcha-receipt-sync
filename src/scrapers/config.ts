export interface RetailerTabConfig {
  orderPageUrl: string;
}

export const RETAILER_TAB_CONFIG: Record<string, RetailerTabConfig> = {
  amazon: {
    orderPageUrl: 'https://www.amazon.com/gp/your-account/order-history',
  },
  costco: {
    orderPageUrl: 'https://www.costco.com/OrderStatusCmd',
  },
  walmart: {
    orderPageUrl: 'https://www.walmart.com/orders',
  },
  target: {
    orderPageUrl: 'https://www.target.com/orders',
  },
};
