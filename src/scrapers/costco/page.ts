/**
 * Costco MAIN world script — runs in the page's JS context so fetch()
 * uses costco.com's origin and cookies. Communicates with the ISOLATED
 * world content script via window.postMessage.
 */

import { mapCostcoItems } from './parser';

const GRAPHQL_URL =
  'https://ecom-api.costco.com/ebusiness/order/v1/orders/graphql';
const CLIENT_IDENTIFIER = '481b1aec-aa3b-454b-b81b-48187e28f205';

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
          itemUnitPriceAmount
        }
        tenderArray { tenderTypeCode tenderDescription amountTender }
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
        if (payload.exp > bestExp) { bestExp = payload.exp; bestToken = entry.secret; }
      }
    } catch { /* skip */ }
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
    console.log(
      `[matcha] Costco MAIN: using idToken (exp in ${ttl}s, policy: ${payload.acr})`
    );
    if (ttl < 0) {
      console.warn('[matcha] Costco MAIN: token is expired!');
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
    // Step 1: List receipts
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
        `[matcha] Costco MAIN: API ${listResp.status}:`,
        errBody.slice(0, 1000)
      );
      throw new Error(`API error: ${listResp.status}`);
    }
    const listData = await listResp.json();
    const summaries = listData.data?.receiptsWithCounts?.receipts ?? [];

    console.log(`[matcha] Costco MAIN: found ${summaries.length} receipts`);

    if (summaries.length === 0) {
      window.postMessage(
        {
          type: 'MATCHA_COSTCO_RESULT',
          requestId: req.requestId,
          receipts: [],
        },
        '*'
      );
      return;
    }

    // Step 2: Fetch details
    const receipts = [];
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
            transactionBarcode: detail.transactionBarcode,
            transactionDateTime: detail.transactionDateTime,
            total: detail.total,
            subTotal: detail.subTotal,
            taxes: detail.taxes,
            warehouseName: detail.warehouseName,
            items: mapCostcoItems(detail.itemArray ?? []),
          });
        }
      } catch (err) {
        console.warn(`[matcha] Costco MAIN detail error:`, err);
      }
    }

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

// Signal ready after page load + a brief delay to allow MSAL to write tokens to localStorage
function signalReady() {
  setTimeout(() => {
    window.postMessage({ type: 'MATCHA_COSTCO_READY' }, '*');
    console.log('[matcha] Costco MAIN world script ready');
  }, 2_000);
}

if (document.readyState === 'complete') {
  signalReady();
} else {
  window.addEventListener('load', signalReady);
}
console.log('[matcha] Costco MAIN world script loaded');
