import { extractCostcoTokens } from './auth';
import { MessageBridge } from '../../content/message-bridge';
import { showToast } from '../../content/toast';
import { formatShortDate } from '../../utils/date';
import { log, warn } from '../../utils/log';

/**
 * Costco ISOLATED world content script.
 * Waits for auth tokens, then asks the MAIN world script to fetch receipts,
 * and forwards the results to the service worker.
 */
const bridge = new MessageBridge();
// page.ts polls up to 30s before emitting READY, so give it a bit more headroom.
// Token fallback poll is only needed if page.ts timed out without a valid token.
const READY_WAIT_MS = 35_000;
const TOKEN_WAIT_MS = 10_000;
const POLL_MS = 500;
const RETAILER_ID = 'costco';

/** Wait for MAIN world script to signal ready. Returns whether it confirmed a valid token. */
async function waitForMainReady(): Promise<{
  ready: boolean;
  hasToken: boolean;
}> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve({ ready: false, hasToken: false });
    }, READY_WAIT_MS);

    function handler(event: MessageEvent) {
      if (event.data?.type === 'MATCHA_COSTCO_READY') {
        window.removeEventListener('message', handler);
        clearTimeout(timeout);
        resolve({ ready: true, hasToken: !!event.data.hasToken });
      }
    }
    window.addEventListener('message', handler);
  });
}

/** Short fallback poll — only used when page.ts couldn't confirm a valid token */
async function waitForTokens(maxMs: number): Promise<{
  clientId: string;
  idToken: string;
} | null> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
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
    log('[matcha] Costco: sync already in progress, skipping');
    return;
  }
  showToast('Scanning Costco orders...', 'info');

  // page.ts polls until it has a valid token before emitting READY (up to 30s).
  // If it reports hasToken=true we can skip the fallback poll entirely.
  const { ready, hasToken } = await waitForMainReady();
  if (!ready) {
    log('[matcha] Costco: MAIN world script did not signal ready in time');
  }

  if (!hasToken) {
    // page.ts timed out without a valid token — do a short fallback poll
    log('[matcha] Costco: hasToken=false, polling for tokens as fallback');
    const tokens = await waitForTokens(TOKEN_WAIT_MS);
    if (!tokens) {
      log('[matcha] Costco: no auth tokens found after polling');
      bridge.sendScrapeError(
        RETAILER_ID,
        'No Costco auth tokens found. Please log in to costco.com first.'
      );
      showToast('Please log in to Costco first', 'error');
      return;
    }
  }

  log('[matcha] Costco: tokens confirmed, requesting receipts via MAIN world');

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
    // If the token was stale/expired, retry once after a short delay
    if (/session expired|token/i.test(result.error)) {
      warn('[matcha] Costco: token error, retrying once in 3s...');
      await new Promise((r) => setTimeout(r, 3_000));
      const retryId = crypto.randomUUID();
      const retry = await new Promise<{ receipts?: unknown[]; error?: string }>(
        (resolve) => {
          const timeout = setTimeout(() => {
            window.removeEventListener('message', retryHandler);
            resolve({ error: 'Timeout on retry' });
          }, 60_000);
          function retryHandler(event: MessageEvent) {
            if (
              event.data?.type === 'MATCHA_COSTCO_RESULT' &&
              event.data.requestId === retryId
            ) {
              window.removeEventListener('message', retryHandler);
              clearTimeout(timeout);
              resolve(event.data);
            }
          }
          window.addEventListener('message', retryHandler);
          window.postMessage(
            {
              type: 'MATCHA_COSTCO_FETCH',
              requestId: retryId,
              startDate,
              endDate,
            },
            '*'
          );
        }
      );
      if (!retry.error) {
        // use retry result going forward
        Object.assign(result, retry);
      }
    }
    if (result.error) {
      console.error('[matcha] Costco scrape error:', result.error);
      bridge.sendScrapeError(RETAILER_ID, result.error);
      showToast(`Error scanning Costco: ${result.error}`, 'error');
      return;
    }
  }

  const receipts = (result.receipts ?? []) as Array<{
    type: 'store' | 'online';
    // store fields
    transactionBarcode?: string;
    transactionDateTime?: string;
    subTotal?: number;
    taxes?: number;
    warehouseName?: string;
    tenderArray?: Array<{
      tenderDescription: string;
      displayAccountNumber?: string;
    }>;
    // online fields
    orderNumber?: string;
    orderDate?: string;
    shipping?: number;
    orderPayment?: Array<{ paymentType: string; cardNumber?: string }>;
    // common
    total: number;
    items: Array<{
      name: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      effectivePrice?: number;
    }>;
  }>;

  log(`[matcha] Costco: received ${receipts.length} receipts from MAIN world`);

  const mapped = receipts.map((r) => ({
    retailer: RETAILER_ID,
    orderId:
      r.type === 'online'
        ? (r.orderNumber ?? '')
        : (r.transactionBarcode ?? ''),
    orderDate: new Date(
      r.type === 'online' ? (r.orderDate ?? '') : (r.transactionDateTime ?? '')
    ),
    totalAmount: r.total,
    tax: r.taxes || undefined,
    orderUrl: 'https://www.costco.com/OrderStatusCmd',
    paymentMethods: extractPaymentMethods(r),
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

function extractPaymentMethods(r: {
  tenderArray?: Array<{
    tenderDescription: string;
    displayAccountNumber?: string;
  }>;
  orderPayment?: Array<{ paymentType: string; cardNumber?: string }>;
}): Array<{ type: string; last4?: string }> {
  if (r.tenderArray && r.tenderArray.length > 0) {
    return r.tenderArray.map((t) => ({
      type: t.tenderDescription,
      last4:
        t.displayAccountNumber && t.displayAccountNumber !== 'XXXX'
          ? t.displayAccountNumber
          : undefined,
    }));
  }
  if (r.orderPayment && r.orderPayment.length > 0) {
    return r.orderPayment.map((p) => ({
      type: p.paymentType,
      last4: p.cardNumber && p.cardNumber !== 'XXXX' ? p.cardNumber : undefined,
    }));
  }
  return [];
}

run();
