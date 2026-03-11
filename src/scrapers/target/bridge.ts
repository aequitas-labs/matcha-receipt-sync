import { MessageBridge } from '../../content/message-bridge';
import { showToast } from '../../content/toast';
import { formatShortDate } from '../../utils/date';
import { log } from '../../utils/log';

/**
 * Target ISOLATED world content script.
 * Asks the MAIN world script to fetch orders via Target's API,
 * then forwards the results to the service worker.
 */
const bridge = new MessageBridge();
const RETAILER_ID = 'target';

async function run(): Promise<void> {
  const { syncProgress = {} } = await chrome.storage.local.get('syncProgress');
  if (syncProgress[RETAILER_ID]) {
    log('[matcha] Target: sync already in progress, skipping');
    return;
  }
  showToast('Scanning Target orders...', 'info');

  const startDate = await bridge.getSyncFromDate(RETAILER_ID);

  const requestId = crypto.randomUUID();

  const result = await new Promise<{ receipts?: unknown[]; error?: string }>(
    (resolve) => {
      const timeout = setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve({ error: 'Timeout waiting for Target API response' });
      }, 60_000);

      function handler(event: MessageEvent) {
        if (
          event.data?.type === 'MATCHA_TARGET_RESULT' &&
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
          type: 'MATCHA_TARGET_FETCH',
          requestId,
          startDate,
        },
        '*'
      );
    }
  );

  if (result.error) {
    console.error('[matcha] Target scrape error:', result.error);
    bridge.sendScrapeError(RETAILER_ID, result.error);
    showToast(`Error scanning Target: ${result.error}`, 'error');
    return;
  }

  const receipts = (result.receipts ?? []) as Array<{
    orderId: string;
    orderUrlId?: string;
    invoiceId?: string;
    storeReceiptId?: string;
    purchaseType?: string;
    orderDate: string;
    total: number;
    tax?: number;
    storeName?: string;
    items: Array<{
      name: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }>;
  }>;

  log(
    `[matcha] Target: received ${receipts.length} receipts from MAIN world`
  );

  const mapped = receipts.map((r) => {
    let orderUrl: string;
    if (r.purchaseType === 'STORE' && r.storeReceiptId) {
      orderUrl = `https://www.target.com/orders/stores/${r.storeReceiptId}`;
    } else if (r.invoiceId) {
      const baseOrderId = (r.orderUrlId || r.orderId).replace(/-/g, '');
      orderUrl = `https://www.target.com/orders/${baseOrderId}/invoices/${r.invoiceId}`;
    } else {
      const baseOrderId = (r.orderUrlId || r.orderId).replace(/-/g, '');
      orderUrl = `https://www.target.com/orders/${baseOrderId}`;
    }
    return {
      retailer: RETAILER_ID,
      orderId: r.orderId,
      orderDate: new Date(r.orderDate),
      totalAmount: r.total,
      tax: r.tax,
      orderUrl,
      items: r.items,
      rawData: {
        storeName: r.storeName,
        total: r.total,
      },
    };
  });

  bridge.sendScrapedReceipts(RETAILER_ID, mapped);

  if (mapped.length > 0) {
    showToast(`Found ${mapped.length} order(s) from Target`, 'success');
  } else {
    const since = startDate ? ` since ${formatShortDate(startDate)}` : '';
    showToast(`No new Target orders${since}`, 'info');
  }
}

run();
