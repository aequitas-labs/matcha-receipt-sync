import { MessageBridge } from '../../content/message-bridge';
import { showToast } from '../../content/toast';
import { formatShortDate } from '../../utils/date';
import type { ScrapedReceipt } from '../../types/scraper';
import type { SyncProgress } from '../../types/messages';

/**
 * Amazon bridge script — ISOLATED world.
 * Delegates all scraping to page.ts (MAIN world) via postMessage,
 * then forwards receipts to the service worker via chrome.runtime.
 */

const RETAILER_ID = 'amazon';
const bridge = new MessageBridge();

function waitForMainReady(): Promise<void> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      window.removeEventListener('message', handler);
      console.warn('[matcha] Amazon: MAIN world ready signal timed out');
      resolve();
    }, 8_000);
    function handler(event: MessageEvent) {
      if (event.source === window && event.data?.type === 'MATCHA_AMAZON_READY') {
        window.removeEventListener('message', handler);
        clearTimeout(timeout);
        resolve();
      }
    }
    window.addEventListener('message', handler);
  });
}

async function run(): Promise<void> {
  // Prevent duplicate syncs if already in progress
  const { syncProgress = {} } = await chrome.storage.local.get('syncProgress');
  if (syncProgress[RETAILER_ID]) {
    console.log('[matcha] Amazon: sync already in progress, skipping');
    return;
  }

  await waitForMainReady();

  const startDate = await bridge.getSyncFromDate(RETAILER_ID);
  const currentYear = new Date().getFullYear();
  const syncFromYear = startDate ? new Date(startDate).getFullYear() : currentYear;
  const years: number[] = [];
  for (let y = currentYear; y >= syncFromYear; y--) years.push(y);

  console.log(`[matcha] Amazon: scanning years ${currentYear}–${syncFromYear}`);
  showToast('Scanning Amazon orders...', 'info');

  const requestId = crypto.randomUUID();

  const result = await new Promise<{ receipts?: unknown[]; error?: string }>((resolve) => {
    const TIMEOUT_MS = 180_000; // 3 min — fetching many invoice pages
    const timeout = setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve({ error: 'Timeout waiting for Amazon scrape' });
    }, TIMEOUT_MS);

    function handler(event: MessageEvent) {
      const d = event.data;
      if (event.source !== window) return;

      if (d?.type === 'MATCHA_AMAZON_PROGRESS' && d.requestId === requestId) {
        const progress: SyncProgress = {
          phase: d.phase,
          current: d.current,
          total: d.total,
          message: d.message,
        };
        bridge.sendSyncProgress(RETAILER_ID, progress);
        return;
      }

      if (d?.type === 'MATCHA_AMAZON_RESULT' && d.requestId === requestId) {
        window.removeEventListener('message', handler);
        clearTimeout(timeout);
        resolve(d);
      }
    }
    window.addEventListener('message', handler);
    window.postMessage({ type: 'MATCHA_AMAZON_FETCH', requestId, startDate, years }, '*');
  });

  if (result.error) {
    console.error('[matcha] Amazon scrape error:', result.error);
    bridge.sendScrapeError(RETAILER_ID, result.error);
    showToast(`Amazon sync failed: ${result.error}`, 'error');
    return;
  }

  const receipts = (result.receipts ?? []) as ScrapedReceipt[];
  bridge.sendScrapedReceipts(RETAILER_ID, receipts);

  if (receipts.length > 0) {
    showToast(`Found ${receipts.length} Amazon order(s)`, 'success');
  } else {
    const since = startDate ? ` since ${formatShortDate(startDate)}` : '';
    showToast(`No new Amazon orders${since}`, 'info');
  }
}

run().catch((err) => {
  console.error('[matcha] Amazon bridge error:', err);
  bridge.sendScrapeError(RETAILER_ID, String(err));
});
