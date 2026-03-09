import type { ScraperRegistry } from '../scrapers/registry';
import type { ScrapedReceipt, SyncResult } from '../types/scraper';
import type { RetailerSyncStatus } from '../types/messages';
import { CursorStore } from './cursor-store';
import { createApiClient } from '../api/client';
import { formatDate } from '../utils/date';
import { saveReceipts, getReceiptsByRetailer } from '../storage/receipts';

export class SyncOrchestrator {
  private cursorStore = new CursorStore();

  constructor(private registry: ScraperRegistry) {}

  /** Mark a retailer as currently syncing (visible in popup) */
  private async setSyncing(retailerId: string, syncing: boolean): Promise<void> {
    const { syncingRetailers = [] } = await chrome.storage.local.get('syncingRetailers');
    const set = new Set<string>(syncingRetailers);
    if (syncing) set.add(retailerId);
    else set.delete(retailerId);
    await chrome.storage.local.set({ syncingRetailers: [...set] });
  }

  /** Handle receipts scraped by a content script (DOM-based scrapers) */
  async handleScrapedReceipts(
    retailerId: string,
    receipts: ScrapedReceipt[]
  ): Promise<void> {
    await this.setSyncing(retailerId, true);

    // Ensure orderDate is a Date (may arrive as string from message passing)
    for (const r of receipts) {
      if (!(r.orderDate instanceof Date)) {
        r.orderDate = new Date(r.orderDate as unknown as string);
      }
    }

    if (receipts.length === 0) {
      // Still advance cursor to now so "Last sync" reflects this run
      await this.cursorStore.set(retailerId, {
        lastSyncedAt: new Date().toISOString(),
      });
      await this.updateStatus(retailerId, 0, []);
      await this.setSyncing(retailerId, false);
      return;
    }

    // Persist locally before pushing to API
    await saveReceipts(receipts);

    const api = await createApiClient();
    let pushed = 0;
    const errors: string[] = [];

    try {
      const result = await api.batchUpsertReceipts({
        receipts: receipts.map((r) => ({
          retailer: r.retailer,
          orderId: r.orderId,
          orderDate: formatDate(r.orderDate),
          totalAmount: r.totalAmount,
          tax: r.tax,
          orderUrl: r.orderUrl,
          items: r.items,
        })),
      });
      pushed = result.created + result.updated;
    } catch (err) {
      errors.push(`Batch upsert failed: ${err}`);
    }

    // Advance cursor to most recent order
    const mostRecent = receipts.reduce((a, b) =>
      a.orderDate > b.orderDate ? a : b
    );
    await this.cursorStore.set(retailerId, {
      lastSyncedAt: mostRecent.orderDate.toISOString(),
      lastOrderId: mostRecent.orderId,
    });

    if (pushed > 0) {
      await this.recordMatchaSync();
    }
    await this.updateStatus(retailerId, pushed, errors);
    await this.setSyncing(retailerId, false);
  }

  /** Get the effective sync-from date (user setting) */
  private async getSyncFromDate(): Promise<string | null> {
    const { syncFromDate } = await chrome.storage.local.get('syncFromDate');
    return syncFromDate ?? null;
  }

  /** Update last successful Matcha sync timestamp */
  private async recordMatchaSync(): Promise<void> {
    await chrome.storage.local.set({
      lastSuccessfulMatchaSync: new Date().toISOString(),
    });
  }

  /** Sync API-based scrapers (Costco) from the service worker */
  async syncApiScrapers(): Promise<SyncResult[]> {
    const results: SyncResult[] = [];

    for (const scraper of this.registry.getAll()) {
      if (!scraper.requiresApiAccess) continue;

      console.log(`[matcha] syncApiScrapers: running ${scraper.retailerId}`);
      let cursor = await this.cursorStore.get(scraper.retailerId);

      // If no cursor exists, use syncFromDate as initial watermark
      if (!cursor?.lastSyncedAt) {
        const syncFrom = await this.getSyncFromDate();
        if (syncFrom) {
          cursor = { lastSyncedAt: new Date(syncFrom).toISOString() };
        }
      }
      try {
        const receipts = await scraper.scrape({ fetch, cursor });
        console.log(
          `[matcha] ${scraper.retailerId}: scraped ${receipts.length} receipts`
        );
        await this.handleScrapedReceipts(scraper.retailerId, receipts);
        results.push({
          retailerId: scraper.retailerId,
          receiptsFound: receipts.length,
          transactionsPushed: receipts.length,
          newCursor: cursor ?? {},
          errors: [],
        });
      } catch (err) {
        console.error(`[matcha] ${scraper.retailerId} scrape error:`, err);
        await this.recordError(scraper.retailerId, String(err));
        results.push({
          retailerId: scraper.retailerId,
          receiptsFound: 0,
          transactionsPushed: 0,
          newCursor: cursor ?? {},
          errors: [String(err)],
        });
      }
    }

    return results;
  }

  async recordError(retailerId: string, error: string): Promise<void> {
    const { syncStatus = {} } = await chrome.storage.local.get(['syncStatus']);
    const existing = syncStatus[retailerId] ?? this.defaultStatus(retailerId);
    existing.lastError = error;
    syncStatus[retailerId] = existing;
    await chrome.storage.local.set({ syncStatus });
  }

  async storeCostcoTokens(clientId: string, idToken: string): Promise<void> {
    await chrome.storage.local.set({
      costcoTokens: { clientId, idToken },
    });
    console.log('[matcha] Stored Costco auth tokens');
  }

  async getStatus(): Promise<Record<string, RetailerSyncStatus>> {
    const { syncStatus = {} } = await chrome.storage.local.get(['syncStatus']);

    // Ensure all retailers are represented
    for (const scraper of this.registry.getAll()) {
      if (!syncStatus[scraper.retailerId]) {
        syncStatus[scraper.retailerId] = this.defaultStatus(scraper.retailerId);
      }
    }

    return syncStatus;
  }

  private async updateStatus(
    retailerId: string,
    _pushed: number,
    errors: string[]
  ): Promise<void> {
    const { syncStatus = {} } = await chrome.storage.local.get(['syncStatus']);
    const existing = syncStatus[retailerId] ?? this.defaultStatus(retailerId);

    // Count actual stored receipts (not cumulative API pushes)
    const storedReceipts = await getReceiptsByRetailer(retailerId);
    existing.lastSyncedAt = new Date().toISOString();
    existing.transactionCount = storedReceipts.length;
    existing.lastError = errors.length > 0 ? errors.join('; ') : null;

    syncStatus[retailerId] = existing;
    await chrome.storage.local.set({ syncStatus });
  }

  private defaultStatus(retailerId: string): RetailerSyncStatus {
    const scraper = this.registry.getById(retailerId);
    return {
      retailerId,
      retailerName: scraper?.retailerName ?? retailerId,
      lastSyncedAt: null,
      transactionCount: 0,
      lastError: null,
    };
  }
}
