/**
 * Costco MAIN world script — runs in the page's JS context so fetch()
 * uses costco.com's origin and cookies. Communicates with the ISOLATED
 * world content script via window.postMessage.
 */

import { mapCostcoItems, mapCostcoOnlineItems } from './parser';
import type { CostcoOnlineLineItem } from './parser';
import { log, warn } from '../../utils/log';

const GRAPHQL_URL =
  'https://ecom-api.costco.com/ebusiness/order/v1/orders/graphql';
const CLIENT_IDENTIFIER = '481b1aec-aa3b-454b-b81b-48187e28f205';
// Costco uses warehouse 847 as the virtual "online store" for all ecommerce orders.
const ONLINE_WAREHOUSE_NUMBER = '847';

const RECEIPTS_LIST_QUERY = `
  query receiptsWithCounts($startDate: String!, $endDate: String!, $documentType: String!, $documentSubType: String!) {
    receiptsWithCounts(startDate: $startDate, endDate: $endDate, documentType: $documentType, documentSubType: $documentSubType) {
      inWarehouse
      receipts {
        warehouseName
        receiptType
        documentType
        transactionDateTime
        transactionBarcode
        transactionType
        total
        totalItemCount
        itemArray { itemNumber }
        tenderArray { tenderTypeCode tenderDescription amountTender }
      }
    }
  }
`;

const RECEIPT_DETAIL_QUERY = `
  query receiptsWithCounts($barcode: String!, $documentType: String!) {
    receiptsWithCounts(barcode: $barcode, documentType: $documentType) {
      receipts {
        warehouseName
        transactionDateTime
        transactionDate
        transactionBarcode
        total
        subTotal
        taxes
        totalItemCount
        itemArray {
          itemNumber
          itemDescription01
          itemDescription02
          unit
          amount
          taxFlag
          itemUnitPriceAmount
        }
        tenderArray { tenderTypeCode tenderDescription amountTender displayAccountNumber }
      }
    }
  }
`;

const ONLINE_LIST_QUERY = `
  query getOnlineOrders($startDate: String!, $endDate: String!, $pageNumber: Int, $pageSize: Int, $warehouseNumber: String!) {
    getOnlineOrders(startDate: $startDate, endDate: $endDate, pageNumber: $pageNumber, pageSize: $pageSize, warehouseNumber: $warehouseNumber) {
      pageNumber
      pageSize
      totalNumberOfRecords
      bcOrders {
        orderNumber: sourceOrderNumber
        orderPlacedDate: orderedDate
        orderTotal
        warehouseNumber
        status
      }
    }
  }
`;

const ONLINE_DETAIL_QUERY = `
  query getOrderDetails($orderNumbers: [String!]!) {
    getOrderDetails(orderNumbers: $orderNumbers) {
      orderNumber
      orderPlacedDate: orderedDate
      orderTotal
      uSTaxTotal1
      shippingAndHandling
      orderPayment {
        paymentType
        cardNumber
      }
      shipToAddress {
        orderLineItems {
          itemDescription
          quantity
          price
          merchandiseTotalAmount
          isFeeItem
        }
      }
    }
  }
`;

interface FetchRequest {
  type: 'MATCHA_COSTCO_FETCH';
  requestId: string;
  startDate: string;
  endDate: string;
}

/** Find the freshest MSAL id token from localStorage */
function findMsalIdToken(): string | null {
  let bestToken: string | null = null;
  let bestExp = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.includes('-idtoken-')) continue;
    try {
      const entry = JSON.parse(localStorage.getItem(key) ?? '');
      if (entry.credentialType === 'IdToken' && entry.secret) {
        const payload = JSON.parse(atob(entry.secret.split('.')[1]));
        if (payload.exp > bestExp) {
          bestExp = payload.exp;
          bestToken = entry.secret;
        }
      }
    } catch {
      /* skip */
    }
  }
  return bestToken;
}

/** Read auth info directly from localStorage (MAIN world has access) */
function getFreshTokens(): { clientId: string; idToken: string } | null {
  const clientId = localStorage.getItem('clientID');
  if (!clientId) return null;

  const idToken = findMsalIdToken() ?? localStorage.getItem('idToken');
  if (!idToken) return null;

  try {
    const payload = JSON.parse(atob(idToken.split('.')[1]));
    const ttl = Math.round(payload.exp - Date.now() / 1000);
    log(
      `[matcha] Costco MAIN: using idToken (exp in ${ttl}s, policy: ${payload.acr})`
    );
    if (ttl < 0) {
      warn('[matcha] Costco MAIN: token is expired!');
      return null;
    }
  } catch {
    /* skip check */
  }

  return { clientId, idToken };
}

window.addEventListener('message', async (event) => {
  if (event.source !== window) return;
  if (event.data?.type !== 'MATCHA_COSTCO_FETCH') return;

  const req = event.data as FetchRequest;

  const tokens = getFreshTokens();
  if (!tokens) {
    window.postMessage(
      {
        type: 'MATCHA_COSTCO_RESULT',
        requestId: req.requestId,
        error:
          'Costco session expired — please log in to costco.com and try again',
      },
      '*'
    );
    return;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json-patch+json',
    'costco-x-wcs-clientId': tokens.clientId,
    'costco-x-authorization': `Bearer ${tokens.idToken}`,
    'client-identifier': CLIENT_IDENTIFIER,
    'costco.env': 'ecom',
    'costco.service': 'restOrders',
  };

  try {
    const receipts = [];

    // ── In-store receipts ──────────────────────────────────────────────────
    const listResp = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: RECEIPTS_LIST_QUERY,
        variables: {
          startDate: req.startDate,
          endDate: req.endDate,
          documentType: 'all',
          documentSubType: 'all',
        },
      }),
    });

    if (!listResp.ok) {
      const errBody = await listResp.text().catch(() => '');
      console.error(
        `[matcha] Costco MAIN: store list API ${listResp.status}:`,
        errBody.slice(0, 1000)
      );
      throw new Error(`API error: ${listResp.status}`);
    }
    const listData = await listResp.json();
    const summaries = listData.data?.receiptsWithCounts?.receipts ?? [];

    log(`[matcha] Costco MAIN: found ${summaries.length} store receipts`);

    for (const summary of summaries) {
      try {
        const detailResp = await fetch(GRAPHQL_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            query: RECEIPT_DETAIL_QUERY,
            variables: {
              barcode: summary.transactionBarcode,
              documentType: 'warehouse',
            },
          }),
        });

        if (!detailResp.ok) continue;
        const detailData = await detailResp.json();
        const detail = detailData.data?.receiptsWithCounts?.receipts?.[0];
        if (detail) {
          receipts.push({
            type: 'store' as const,
            transactionBarcode: detail.transactionBarcode,
            transactionDateTime: detail.transactionDateTime,
            total: detail.total,
            subTotal: detail.subTotal,
            taxes: detail.taxes,
            warehouseName: detail.warehouseName,
            tenderArray: detail.tenderArray ?? [],
            items: mapCostcoItems(detail.itemArray ?? [], {
              total: detail.total,
              taxes: detail.taxes ?? 0,
              subTotal: detail.subTotal ?? 0,
            }),
          });
        }
      } catch (err) {
        warn(`[matcha] Costco MAIN store detail error:`, err);
      }
    }

    // ── Online orders ──────────────────────────────────────────────────────
    await fetchOnlineOrders(
      headers,
      ONLINE_WAREHOUSE_NUMBER,
      req.startDate,
      req.endDate,
      receipts
    );

    window.postMessage(
      { type: 'MATCHA_COSTCO_RESULT', requestId: req.requestId, receipts },
      '*'
    );
  } catch (err) {
    window.postMessage(
      {
        type: 'MATCHA_COSTCO_RESULT',
        requestId: req.requestId,
        error: String(err),
      },
      '*'
    );
  }
});

async function fetchOnlineOrders(
  headers: Record<string, string>,
  warehouseNumber: string,
  startDate: string,
  endDate: string,
  receipts: unknown[]
): Promise<void> {
  let page = 1;
  const pageSize = 10;
  let totalRecords = Infinity;

  while ((page - 1) * pageSize < totalRecords) {
    const listResp = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: ONLINE_LIST_QUERY,
        variables: {
          startDate,
          endDate,
          pageNumber: page,
          pageSize,
          warehouseNumber,
        },
      }),
    });
    if (!listResp.ok) {
      warn(
        `[matcha] Costco MAIN: online list page ${page} returned ${listResp.status}`
      );
      break;
    }
    const listData = await listResp.json();
    const pageData = listData.data?.getOnlineOrders?.[0];
    if (!pageData) break;

    totalRecords = pageData.totalNumberOfRecords ?? 0;
    const orders: Array<{
      orderNumber: string;
      orderPlacedDate: string;
      orderTotal: number;
    }> = pageData.bcOrders ?? [];

    log(
      `[matcha] Costco MAIN: online orders page ${page}, ${orders.length} orders`
    );

    if (orders.length === 0) break;

    // Fetch details in batches of up to 10 order numbers
    const orderNumbers = orders.map((o) => String(o.orderNumber));
    try {
      const detailResp = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: ONLINE_DETAIL_QUERY,
          variables: { orderNumbers },
        }),
      });
      if (!detailResp.ok) {
        warn(
          `[matcha] Costco MAIN: online detail batch returned ${detailResp.status}`
        );
      } else {
        const detailData = await detailResp.json();
        const orderDetails: Array<{
          orderNumber: string;
          orderPlacedDate: string;
          orderTotal: number;
          uSTaxTotal1?: number;
          shippingAndHandling?: number;
          orderPayment?: Array<{ paymentType: string; cardNumber?: string }>;
          shipToAddress?: Array<{ orderLineItems?: CostcoOnlineLineItem[] }>;
        }> = detailData.data?.getOrderDetails ?? [];

        for (const order of orderDetails) {
          const lineItems = (order.shipToAddress ?? []).flatMap(
            (s) => s.orderLineItems ?? []
          );
          receipts.push({
            type: 'online' as const,
            orderNumber: String(order.orderNumber),
            orderDate: order.orderPlacedDate,
            total: order.orderTotal,
            taxes: order.uSTaxTotal1 ?? 0,
            shipping: order.shippingAndHandling ?? 0,
            orderPayment: order.orderPayment ?? [],
            items: mapCostcoOnlineItems(lineItems, {
              orderTotal: order.orderTotal,
              tax: order.uSTaxTotal1 ?? 0,
              shipping: order.shippingAndHandling ?? 0,
            }),
          });
        }
      }
    } catch (err) {
      warn('[matcha] Costco MAIN: online detail error:', err);
    }

    page++;
  }
}

// Poll until getFreshTokens() succeeds, then signal ready with hasToken=true.
// This handles MSAL's silent SSO refresh which may write tokens well after document.load.
async function signalReady() {
  const MAX_MS = 30_000;
  const start = Date.now();
  let hasToken = false;
  while (Date.now() - start < MAX_MS) {
    if (getFreshTokens()) {
      hasToken = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  window.postMessage({ type: 'MATCHA_COSTCO_READY', hasToken }, '*');
  log(`[matcha] Costco MAIN world script ready (hasToken=${hasToken})`);
}

if (document.readyState === 'complete') {
  signalReady();
} else {
  window.addEventListener('load', signalReady);
}
log('[matcha] Costco MAIN world script loaded');
