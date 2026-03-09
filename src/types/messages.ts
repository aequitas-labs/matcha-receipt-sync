import type { ScrapedReceipt } from './scraper';

export interface SyncProgress {
  phase: 'scanning' | 'fetching' | 'pushing';
  current: number;
  total: number;
  message?: string;
}

export type ExtensionMessage =
  | { type: 'SCRAPE_COMPLETE'; retailerId: string; receipts: ScrapedReceipt[] }
  | { type: 'SCRAPE_ERROR'; retailerId: string; error: string }
  | { type: 'SYNC_PROGRESS'; retailerId: string; progress: SyncProgress }
  | { type: 'MANUAL_SYNC_REQUEST' }
  | { type: 'SYNC_RETAILER_REQUEST'; retailerId: string }
  | { type: 'GET_STATUS_REQUEST' }
  | { type: 'GET_STATUS_RESPONSE'; status: SyncStatusMap }
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
