import { MessageBridge } from '../../content/message-bridge';
import { showToast } from '../../content/toast';
import { formatShortDate } from '../../utils/date';
import { log, warn } from '../../utils/log';

/**
 * Walmart ISOLATED world content script.
 * Waits for the MAIN world script to signal ready, then asks it to
 * fetch orders via Walmart's GraphQL API and forwards results to
 * the service worker.
 */
const bridge = new MessageBridge();
const RETAILER_ID = 'walmart';

/** Wait for the MAIN world script to post MATCHA_WALMART_READY */
function waitForMainReady(): Promise<void> {
  return new Promise((resolve) => {
    // It may already be ready — post a ping and also listen for the ready signal
    function handler(event: MessageEvent) {
      if (event.data?.type === 'MATCHA_WALMART_READY') {
        window.removeEventListener('message', handler);
        clearTimeout(timeout);
        resolve();
      }
    }
    const timeout = setTimeout(() => {
      // If we never hear READY after 5s, try anyway — maybe the message was sent before we listened
      window.removeEventListener('message', handler);
      warn(
        '[matcha] Walmart: MAIN world READY not received, proceeding anyway'
      );
      resolve();
    }, 5_000);

    window.addEventListener('message', handler);
  });
}

async function run(): Promise<void> {
  const { syncProgress = {} } = await chrome.storage.local.get('syncProgress');
  if (syncProgress[RETAILER_ID]) {
    log('[matcha] Walmart: sync already in progress, skipping');
    return;
  }
  await waitForMainReady();
  showToast('Scanning Walmart orders...', 'info');

  const startDate = await bridge.getSyncFromDate(RETAILER_ID);

  const requestId = crypto.randomUUID();

  const result = await new Promise<{ receipts?: unknown[]; error?: string }>(
    (resolve) => {
      const timeout = setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve({ error: 'Timeout waiting for Walmart API response' });
      }, 60_000);

      function handler(event: MessageEvent) {
        if (
          event.data?.type === 'MATCHA_WALMART_RESULT' &&
          event.data.requestId === requestId
        ) {
          window.removeEventListener('message', handler);
          clearTimeout(timeout);
          resolve(event.data);
        }
      }
      window.addEventListener('message', handler);

      window.postMessage(
        {
          type: 'MATCHA_WALMART_FETCH',
          requestId,
          startDate,
        },
        '*'
      );
    }
  );

  if (result.error) {
    console.error('[matcha] Walmart scrape error:', result.error);
    bridge.sendScrapeError(RETAILER_ID, result.error);
    showToast(`Error scanning Walmart: ${result.error}`, 'error');
    return;
  }

  const receipts = (result.receipts ?? []) as Array<{
    orderId: string;
    orderDate: string;
    total: number;
    tax?: number;
    items: Array<{
      name: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }>;
    rawData?: Record<string, unknown>;
  }>;

  log(
    `[matcha] Walmart: received ${receipts.length} receipts from MAIN world`
  );

  const mapped = receipts.map((r) => ({
    retailer: RETAILER_ID,
    orderId: r.orderId,
    orderDate: new Date(r.orderDate),
    totalAmount: r.total,
    tax: r.tax,
    orderUrl: `https://www.walmart.com/orders/${r.orderId.replace(/-/g, '')}`,
    items: r.items,
    rawData: r.rawData,
  }));

  bridge.sendScrapedReceipts(RETAILER_ID, mapped);

  if (mapped.length > 0) {
    showToast(`Found ${mapped.length} order(s) from Walmart`, 'success');
  } else {
    const since = startDate ? ` since ${formatShortDate(startDate)}` : '';
    showToast(`No new Walmart orders${since}`, 'info');
  }
}

run();
