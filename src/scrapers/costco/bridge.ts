import { extractCostcoTokens } from './auth';
import { MessageBridge } from '../../content/message-bridge';
import { showToast } from '../../content/toast';
import { formatShortDate } from '../../utils/date';

/**
 * Costco ISOLATED world content script.
 * Waits for auth tokens, then asks the MAIN world script to fetch receipts,
 * and forwards the results to the service worker.
 */
const bridge = new MessageBridge();
const MAX_WAIT_MS = 30_000;
const POLL_MS = 500;
const RETAILER_ID = 'costco';

/** Wait for MAIN world script to signal ready (page fully loaded + MSAL populated) */
async function waitForMainReady(): Promise<boolean> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve(false);
    }, MAX_WAIT_MS);

    function handler(event: MessageEvent) {
      if (event.data?.type === 'MATCHA_COSTCO_READY') {
        window.removeEventListener('message', handler);
        clearTimeout(timeout);
        resolve(true);
      }
    }
    window.addEventListener('message', handler);
  });
}

async function waitForTokens(): Promise<{
  clientId: string;
  idToken: string;
} | null> {
  const start = Date.now();
  while (Date.now() - start < MAX_WAIT_MS) {
    const tokens = extractCostcoTokens();
    if (tokens) return tokens;
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  return null;
}

function toMDY(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
}

async function run(): Promise<void> {
  const { syncProgress = {} } = await chrome.storage.local.get('syncProgress');
  if (syncProgress[RETAILER_ID]) {
    console.log('[matcha] Costco: sync already in progress, skipping');
    return;
  }
  showToast('Scanning Costco orders...', 'info');

  // Wait for MAIN world script to be ready (page loaded, MSAL tokens available)
  const mainReady = await waitForMainReady();
  if (!mainReady) {
    console.log('[matcha] Costco: MAIN world script did not signal ready in time');
  }

  const tokens = await waitForTokens();
  if (!tokens) {
    console.log('[matcha] Costco: no auth tokens found after polling');
    bridge.sendScrapeError(
      RETAILER_ID,
      'No Costco auth tokens found. Please log in to costco.com first.'
    );
    showToast('Please log in to Costco first', 'error');
    return;
  }

  console.log(
    '[matcha] Costco: tokens confirmed, requesting receipts via MAIN world'
  );

  const syncFrom = await bridge.getSyncFromDate(RETAILER_ID);
  const startDate = syncFrom ? toMDY(syncFrom) : '1/01/2024';
  const endDate = toMDY(new Date().toISOString());

  const requestId = crypto.randomUUID();

  // Listen for result from MAIN world script
  const result = await new Promise<{ receipts?: unknown[]; error?: string }>(
    (resolve) => {
      const timeout = setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve({ error: 'Timeout waiting for Costco API response' });
      }, 60_000);

      function handler(event: MessageEvent) {
        if (
          event.data?.type === 'MATCHA_COSTCO_RESULT' &&
          event.data.requestId === requestId
        ) {
          window.removeEventListener('message', handler);
          clearTimeout(timeout);
          resolve(event.data);
        }
      }
      window.addEventListener('message', handler);

      // Send request to MAIN world (tokens are read fresh there, not passed)
      window.postMessage(
        {
          type: 'MATCHA_COSTCO_FETCH',
          requestId,
          startDate,
          endDate,
        },
        '*'
      );
    }
  );

  if (result.error) {
    console.error('[matcha] Costco scrape error:', result.error);
    bridge.sendScrapeError(RETAILER_ID, result.error);
    showToast(`Error scanning Costco: ${result.error}`, 'error');
    return;
  }

  const receipts = (result.receipts ?? []) as Array<{
    transactionBarcode: string;
    transactionDateTime: string;
    total: number;
    subTotal: number;
    taxes: number;
    warehouseName: string;
    items: Array<{
      name: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }>;
  }>;

  console.log(
    `[matcha] Costco: received ${receipts.length} receipts from MAIN world`
  );

  const mapped = receipts.map((r) => ({
    retailer: RETAILER_ID,
    orderId: r.transactionBarcode,
    orderDate: new Date(r.transactionDateTime),
    totalAmount: r.total,
    tax: r.taxes || undefined,
    orderUrl: 'https://www.costco.com/OrderStatusCmd',
    items: r.items,
    rawData: {
      subTotal: r.subTotal,
      taxes: r.taxes,
      total: r.total,
      warehouseName: r.warehouseName,
    },
  }));

  bridge.sendScrapedReceipts(RETAILER_ID, mapped);

  if (mapped.length > 0) {
    showToast(`Found ${mapped.length} order(s) from Costco`, 'success');
  } else {
    const since = syncFrom ? ` since ${formatShortDate(syncFrom)}` : '';
    showToast(`No new Costco orders${since}`, 'info');
  }
}

run();
