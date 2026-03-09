import type { SyncCursor } from './scraper';
import type { RetailerSyncStatus, DebugLogEntry } from './messages';

export interface ExtensionStorage {
  /** matcha money base URL */
  apiBaseUrl: string;
  /** Use fake API (development mode) */
  useFakeApi: boolean;
  /** Sync interval in hours */
  syncIntervalHours: number;
  /** Per-retailer sync cursors */
  cursors: Record<string, SyncCursor>;
  /** Per-retailer sync status */
  syncStatus: Record<string, RetailerSyncStatus>;
  /** Costco auth tokens (extracted from localStorage) */
  costcoTokens: { clientId: string; idToken: string } | null;
  /** Debug log entries */
  debugLog: DebugLogEntry[];
}

export const DEFAULT_STORAGE: ExtensionStorage = {
  apiBaseUrl: 'https://matcha.money',
  useFakeApi: true,
  syncIntervalHours: 24,
  cursors: {},
  syncStatus: {},
  costcoTokens: null,
  debugLog: [],
};
