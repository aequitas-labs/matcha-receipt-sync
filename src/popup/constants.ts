export interface RetailerConfig {
  id: string;
  name: string;
  icon: string;
  url: string;
}

export const RETAILERS: RetailerConfig[] = [
  {
    id: 'amazon',
    name: 'Amazon',
    icon: '📦',
    url: 'https://www.amazon.com/gp/your-account/order-history',
  },
  {
    id: 'costco',
    name: 'Costco',
    icon: '🏪',
    url: 'https://www.costco.com/OrderStatusCmd',
  },
  {
    id: 'walmart',
    name: 'Walmart',
    icon: '🛒',
    url: 'https://www.walmart.com/orders',
  },
  {
    id: 'target',
    name: 'Target',
    icon: '🎯',
    url: 'https://www.target.com/orders',
  },
];
