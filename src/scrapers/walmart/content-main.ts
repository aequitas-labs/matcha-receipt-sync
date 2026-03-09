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

interface WalmartFetchRequest {
  type: 'MATCHA_WALMART_FETCH';
  requestId: string;
  startDate: string;
}

interface WalmartItem {
  name?: string;
  quantity?: number;
  linePrice?: number;
  unitPrice?: number;
}

interface WalmartGroup {
  items?: WalmartItem[];
}

interface WalmartOrder {
  id?: string;
  displayId?: string;
  orderDate?: string;
  priceDetails?: {
    orderTotal?: { value?: number };
    subTotal?: { value?: number };
  };
  groups?: WalmartGroup[];
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

function parseOrders(
  orders: WalmartOrder[],
  cutoff: Date
): {
  receipts: Array<{
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
  reachedCutoff: boolean;
} {
  const receipts: Array<{
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

  let reachedCutoff = false;

  for (const order of orders) {
    const orderId = order.displayId || order.id;
    if (!orderId) continue;

    const orderDate = order.orderDate ? new Date(order.orderDate) : null;
    if (!orderDate || isNaN(orderDate.getTime())) continue;

    if (orderDate < cutoff) {
      reachedCutoff = true;
      break;
    }

    const total = order.priceDetails?.orderTotal?.value ?? 0;
    const items: Array<{
      name: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }> = [];

    for (const group of order.groups ?? []) {
      for (const item of group.items ?? []) {
        if (!item.name) continue;
        const qty = item.quantity ?? 1;
        const lineTotal = item.linePrice ?? 0;
        const unit = item.unitPrice ?? (qty > 0 ? lineTotal / qty : 0);
        items.push({
          name: item.name,
          quantity: qty,
          unitPrice: unit,
          totalPrice: lineTotal,
        });
      }
    }

    const subTotal = order.priceDetails?.subTotal?.value;
    receipts.push({
      orderId,
      orderDate: orderDate.toISOString(),
      total,
      tax:
        subTotal != null && total > subTotal
          ? Math.round((total - subTotal) * 100) / 100
          : undefined,
      items,
      rawData: {
        subTotal,
      },
    });
  }

  return { receipts, reachedCutoff };
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
          console.log(
            `[matcha] Walmart MAIN: ${receipts.length} orders from __NEXT_DATA__, nextCursor=${nextCursor}`
          );
        }
      } catch (e) {
        console.warn('[matcha] Walmart MAIN: failed to parse __NEXT_DATA__', e);
      }
    }

    // Phase 2: Paginate via GraphQL API for remaining pages
    let pageCount = 0;
    const MAX_PAGES = 20;

    while (nextCursor && pageCount < MAX_PAGES) {
      pageCount++;
      console.log(
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
        console.warn(`[matcha] Walmart MAIN: API ${resp.status}`);
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

    console.log(
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
console.log('[matcha] Walmart MAIN world script loaded');
