import type { ExtensionMessage, SyncProgress } from '../types/messages';
import type { ScrapedReceipt, SyncCursor } from '../types/scraper';

export class MessageBridge {
  sendScrapedReceipts(retailerId: string, receipts: ScrapedReceipt[]): void {
    chrome.runtime.sendMessage({
      type: 'SCRAPE_COMPLETE',
      retailerId,
      receipts,
    } satisfies ExtensionMessage);
  }

  sendScrapeError(retailerId: string, error: string): void {
    chrome.runtime.sendMessage({
      type: 'SCRAPE_ERROR',
      retailerId,
      error,
    } satisfies ExtensionMessage);
  }

  sendSyncProgress(retailerId: string, progress: SyncProgress): void {
    chrome.runtime.sendMessage({
      type: 'SYNC_PROGRESS',
      retailerId,
      progress,
    } satisfies ExtensionMessage);
  }

  async getCursor(retailerId: string): Promise<SyncCursor | undefined> {
    const { cursors = {} } = await chrome.storage.local.get(['cursors']);
    return cursors[retailerId];
  }

  /** Returns the effective start date for a scrape: max(syncFromDate, cursor.lastSyncedAt) */
  async getSyncFromDate(retailerId: string): Promise<string | undefined> {
    const { syncFromDate, cursors = {} } = await chrome.storage.local.get(['syncFromDate', 'cursors']);
    const cursor: string | undefined = (cursors[retailerId] as SyncCursor | undefined)?.lastSyncedAt;
    if (syncFromDate && cursor) return cursor > syncFromDate ? cursor : syncFromDate;
    return cursor ?? syncFromDate ?? undefined;
  }
}
