import type { ScrapedReceipt } from './scraper';

export interface InvoiceRef {
  orderId: string;
  orderDate: string; // ISO string for cursor filtering
  invoiceUrl: string;
}

export type ExtensionMessage =
  | { type: 'SCRAPE_COMPLETE'; retailerId: string; receipts: ScrapedReceipt[] }
  | { type: 'SCRAPE_ERROR'; retailerId: string; error: string }
  | { type: 'INVOICE_URLS'; retailerId: string; invoices: InvoiceRef[] }
  | { type: 'MANUAL_SYNC_REQUEST' }
  | { type: 'SYNC_RETAILER_REQUEST'; retailerId: string }
  | { type: 'GET_STATUS_REQUEST' }
  | { type: 'GET_STATUS_RESPONSE'; status: SyncStatusMap }
  | {
      type: 'FETCH_PAGINATED_INVOICES';
      retailerId: string;
      nextUrl: string;
      cursorDate?: string;
    }
  | { type: 'COSTCO_AUTH_TOKENS'; clientId: string; idToken: string }
  | { type: 'GET_DEBUG_LOG_REQUEST' }
  | { type: 'GET_DEBUG_LOG_RESPONSE'; entries: DebugLogEntry[] }
  | { type: 'CLEAR_DEBUG_LOG' };

export type SyncStatusMap = Record<string, RetailerSyncStatus>;

export interface RetailerSyncStatus {
  retailerId: string;
  retailerName: string;
  lastSyncedAt: string | null;
  transactionCount: number;
  lastError: string | null;
}

export interface DebugLogEntry {
  timestamp: string;
  endpoint: string;
  method: string;
  payload: unknown;
  response?: unknown;
  error?: string;
}
