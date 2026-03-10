export interface ReceiptScraper {
  readonly retailerId: string;
  readonly retailerName: string;
  readonly matchUrls: string[];
  /** true = uses fetch (e.g. Costco GraphQL), false = scrapes DOM */
  readonly requiresApiAccess: boolean;
  scrape(context: ScrapeContext): Promise<ScrapedReceipt[]>;
}

export interface ScrapeContext {
  /** Available for DOM-based scrapers (content script context) */
  document?: Document;
  /** Available for API-based scrapers (service worker context) */
  fetch?: typeof globalThis.fetch;
  /** Delta sync watermark - only scrape orders after this point */
  cursor?: SyncCursor;
}

export interface PaymentMethod {
  /** Human-readable card/wallet type (e.g. "Visa", "Mastercard", "PayPal") */
  type: string;
  /** Last 4 digits of the card, if available */
  last4?: string;
}

export interface ScrapedReceipt {
  retailer: string;
  orderId: string;
  orderDate: Date;
  /** Positive float in dollars (e.g. 42.99) */
  totalAmount: number;
  /** Tax amount in dollars */
  tax?: number;
  /** URL to view the order on the retailer's site */
  orderUrl?: string;
  /** Payment method(s) used for this order */
  paymentMethods?: PaymentMethod[];
  items: ScrapedItem[];
  rawData?: unknown;
}

export interface ScrapedItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  /** Effective per-unit cost including this item's share of tax and shipping */
  effectivePrice?: number;
}

export interface SyncCursor {
  lastSyncedAt?: string;
  lastOrderId?: string;
}

export interface SyncResult {
  retailerId: string;
  receiptsFound: number;
  transactionsPushed: number;
  newCursor: SyncCursor;
  errors: string[];
}
