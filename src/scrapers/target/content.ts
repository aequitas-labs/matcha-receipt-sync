import { MessageBridge } from '../../content/message-bridge';
import { showToast } from '../../content/toast';

/**
 * Target ISOLATED world content script.
 * Asks the MAIN world script to fetch orders via Target's API,
 * then forwards the results to the service worker.
 */
const bridge = new MessageBridge();
const RETAILER_ID = 'target';

async function run(): Promise<void> {
  showToast('Scanning Target orders...', 'info');
  const cursor = await bridge.getCursor(RETAILER_ID);
  const startDate = cursor?.lastSyncedAt || '2024-01-01T00:00:00Z';

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

  console.log(
    `[matcha] Target: received ${receipts.length} receipts from MAIN world`
  );

  const mapped = receipts.map((r) => ({
    retailer: RETAILER_ID,
    orderId: r.orderId,
    orderDate: new Date(r.orderDate),
    totalAmount: r.total,
    tax: r.tax,
    orderUrl: `https://www.target.com/orders/${r.orderId.split('-')[0]}`,
    items: r.items,
    rawData: {
      storeName: r.storeName,
      total: r.total,
    },
  }));

  bridge.sendScrapedReceipts(RETAILER_ID, mapped);

  if (mapped.length > 0) {
    showToast(`Found ${mapped.length} order(s) from Target`, 'success');
  } else {
    showToast('No new Target orders found', 'info');
  }
}

run();
