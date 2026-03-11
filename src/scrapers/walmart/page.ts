/**
 * Walmart MAIN world script — runs in the page's JS context so fetch()
 * uses walmart.com's origin and cookies. Communicates with the ISOLATED
 * world content script via window.postMessage.
 *
 * Phase 1: Read __NEXT_DATA__ for the first page of orders (free).
 * Phase 2: Paginate via Walmart's PurchaseHistoryV3 GraphQL endpoint.
 *
 * The persisted query hash is a SHA-256 of the query text — it only
 * changes if Walmart modifies the GraphQL query itself, which is rare.
 */

const WALMART_GRAPHQL_BASE =
  'https://www.walmart.com/orchestra/cph/graphql/PurchaseHistoryV3/1c1a8ff73cf03b3b5d23ae41db2d8f296f1baee3e92608116a70514f72ce3570';

import { type WalmartOrder, parseOrders } from './parser';
import { log, warn } from '../../utils/log';

interface WalmartFetchRequest {
  type: 'MATCHA_WALMART_FETCH';
  requestId: string;
  startDate: string;
}

interface WalmartGqlResponse {
  data?: {
    purchaseHistory?: {
      orders?: WalmartOrder[];
      pageInfo?: {
        nextPageCursor?: string | null;
      };
    };
  };
}

function randomCorrelationId(): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 38; i++)
    result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

function getAppVersion(): string {
  // Extract from userAppVersion cookie
  const match = document.cookie.match(/userAppVersion=([^;]+)/);
  return match?.[1] ?? 'usweb-1.248.0';
}

function getWalmartHeaders(): Record<string, string> {
  const correlationId = randomCorrelationId();
  return {
    accept: 'application/json',
    'content-type': 'application/json',
    'x-apollo-operation-name': 'PurchaseHistoryV3',
    'x-o-bu': 'WALMART-US',
    'x-o-ccm': 'server',
    'x-o-correlation-id': correlationId,
    'x-o-gql-query': 'query PurchaseHistoryV3',
    'x-o-mart': 'B2C',
    'x-o-platform': 'rweb',
    'x-o-platform-version': getAppVersion(),
    'x-o-segment': 'oaoh',
    wm_mp: 'true',
    wm_page_url: window.location.href,
    'wm_qos.correlation_id': correlationId,
  };
}

/**
 * Fetch the Walmart order detail page and parse item prices from HTML.
 * Uses data-testid attributes: productName, line-price, and bill-item-quantity class.
 * Falls back to text-based parsing (split on "Qty") if HTML parsing finds nothing.
 */
async function fetchOrderDetailItems(
  orderId: string
): Promise<Map<string, { quantity: number; unitPrice: number; totalPrice: number }>> {
  const result = new Map<string, { quantity: number; unitPrice: number; totalPrice: number }>();
  try {
    const cleanId = orderId.replace(/-/g, '');
    const resp = await fetch(`https://www.walmart.com/orders/${cleanId}`, {
      credentials: 'include',
    });
    if (!resp.ok) return result;
    const html = await resp.text();

    // HTML parsing: find productName + line-price pairs
    // Each item block has data-testid="productName" and data-testid="line-price"
    const namePattern = /data-testid="productName"[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/gi;
    const pricePattern = /data-testid="line-price"[^>]*>[\s\S]*?<span[^>]*>\s*\$([\d,]+\.\d{2})\s*<\/span>/gi;
    const qtyPattern = /bill-item-quantity[^>]*>[^<]*?Qty\s*(\d+)/gi;

    const names: string[] = [];
    const prices: number[] = [];
    const quantities: number[] = [];

    let m;
    while ((m = namePattern.exec(html)) !== null) {
      const name = m[1].replace(/<[^>]+>/g, '').trim();
      if (name.length >= 3) names.push(name);
    }
    while ((m = pricePattern.exec(html)) !== null) {
      prices.push(parseFloat(m[1].replace(/,/g, '')));
    }
    while ((m = qtyPattern.exec(html)) !== null) {
      quantities.push(parseInt(m[1], 10));
    }

    // Match names with prices (they appear in order)
    const count = Math.min(names.length, prices.length);
    for (let i = 0; i < count; i++) {
      const qty = quantities[i] ?? 1;
      const totalPrice = prices[i];
      const unitPrice = qty > 0 ? totalPrice / qty : totalPrice;
      result.set(names[i].toLowerCase(), { quantity: qty, unitPrice, totalPrice });
    }

    // Fallback: text-based parsing if HTML parsing found nothing
    if (result.size === 0) {
      const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      const chunks = text.split(/Qty\s+(\d+)/i);
      for (let i = 1; i < chunks.length; i += 2) {
        const qty = parseInt(chunks[i], 10) || 1;
        const after = chunks[i + 1] || '';
        const priceMatch = after.match(/\$([\d,]+\.\d{2})/);
        if (!priceMatch) continue;
        const totalPrice = parseFloat(priceMatch[1].replace(/,/g, ''));

        // Name is at the end of the preceding chunk
        const before = chunks[i - 1];
        const nameMatch = before.match(/([A-Z][^$]{5,}?)\s*$/);
        if (!nameMatch) continue;
        const name = nameMatch[1].trim();
        if (name.length < 3) continue;

        result.set(name.toLowerCase(), { quantity: qty, unitPrice: totalPrice / qty, totalPrice });
      }
    }

    log(`[matcha] Walmart MAIN: order detail enrichment found ${result.size} items`);
  } catch (err) {
    warn('[matcha] Walmart MAIN: order detail fetch failed:', err);
  }
  return result;
}

window.addEventListener('message', async (event) => {
  if (event.source !== window) return;
  if (event.data?.type !== 'MATCHA_WALMART_FETCH') return;

  const req = event.data as WalmartFetchRequest;

  try {
    const allReceipts: Array<{
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
    }> = [];

    const cutoff = new Date(req.startDate);

    // Phase 1: Parse __NEXT_DATA__ for the initial page (already loaded, no extra request)
    let nextCursor: string | null = null;
    const scriptEl = document.getElementById('__NEXT_DATA__');
    if (scriptEl?.textContent) {
      try {
        const nextData = JSON.parse(scriptEl.textContent);
        const ph =
          nextData?.props?.pageProps?.phRedesignInitialData?.data
            ?.purchaseHistory;
        if (ph?.orders) {
          const { receipts, reachedCutoff } = parseOrders(ph.orders, cutoff);
          allReceipts.push(...receipts);
          if (!reachedCutoff) {
            nextCursor = ph.pageInfo?.nextPageCursor ?? null;
          }
          log(
            `[matcha] Walmart MAIN: ${receipts.length} orders from __NEXT_DATA__, nextCursor=${nextCursor}`
          );
        }
      } catch (e) {
        warn('[matcha] Walmart MAIN: failed to parse __NEXT_DATA__', e);
      }
    }

    // Phase 2: Paginate via GraphQL API for remaining pages
    let pageCount = 0;
    const MAX_PAGES = 20;

    while (nextCursor && pageCount < MAX_PAGES) {
      pageCount++;
      log(
        `[matcha] Walmart MAIN: fetching page ${pageCount + 1}, cursor=${nextCursor}`
      );

      const variables = {
        input: {
          cursor: nextCursor,
          search: '',
          filterIds: [] as string[],
          limit: 10,
          type: null,
          minTimestamp: null,
          maxTimestamp: null,
        },
        platform: 'WEB',
      };

      const url = `${WALMART_GRAPHQL_BASE}?variables=${encodeURIComponent(JSON.stringify(variables))}`;
      const resp = await fetch(url, {
        credentials: 'include',
        headers: getWalmartHeaders(),
      });

      if (!resp.ok) {
        warn(`[matcha] Walmart MAIN: API ${resp.status}`);
        break;
      }

      const data: WalmartGqlResponse = await resp.json();
      const orders = data.data?.purchaseHistory?.orders ?? [];
      const { receipts, reachedCutoff } = parseOrders(orders, cutoff);
      allReceipts.push(...receipts);

      if (
        reachedCutoff ||
        !data.data?.purchaseHistory?.pageInfo?.nextPageCursor
      )
        break;
      nextCursor = data.data.purchaseHistory.pageInfo.nextPageCursor;
    }

    // Enrich items that have zero prices from print bill
    for (const receipt of allReceipts) {
      const hasZeroPriceItems = receipt.items.some((i) => i.totalPrice === 0 && i.unitPrice === 0);
      if (!hasZeroPriceItems) continue;

      const billItems = await fetchOrderDetailItems(receipt.orderId);
      if (billItems.size === 0) continue;

      for (const item of receipt.items) {
        if (item.totalPrice !== 0 || item.unitPrice !== 0) continue;
        const billItem = billItems.get(item.name.toLowerCase());
        if (billItem) {
          item.quantity = billItem.quantity;
          item.unitPrice = billItem.unitPrice;
          item.totalPrice = billItem.totalPrice;
        }
      }
    }

    log(
      `[matcha] Walmart MAIN: found ${allReceipts.length} total receipts`
    );
    window.postMessage(
      {
        type: 'MATCHA_WALMART_RESULT',
        requestId: req.requestId,
        receipts: allReceipts,
      },
      '*'
    );
  } catch (err) {
    console.error('[matcha] Walmart MAIN error:', err);
    window.postMessage(
      {
        type: 'MATCHA_WALMART_RESULT',
        requestId: req.requestId,
        error: String(err),
      },
      '*'
    );
  }
});

// Signal ready
window.postMessage({ type: 'MATCHA_WALMART_READY' }, '*');
log('[matcha] Walmart MAIN world script loaded');
