/**
 * Target MAIN world script — runs in the page's JS context so fetch()
 * uses target.com's origin and cookies. Communicates with the ISOLATED
 * world content script via window.postMessage.
 */

import {
  decodeHtmlEntities,
  mapTargetInvoiceLines,
  mapTargetStoreLines,
  normalizeDpci,
  parseTargetReceiptHtml,
  type TargetOrderLine,
} from './parser';

const TARGET_API_KEY = 'ff457966e64d5e877fdbad070f276d18ecec4a01';
const ORDER_HISTORY_URL =
  'https://api.target.com/guest_order_aggregations/v1/order_history';
const INVOICES_URL = 'https://api.target.com/post_order_invoices/v1/orders';
const STORE_ORDER_DETAILS_URL =
  'https://api.target.com/guest_order_aggregations/v1';
const RECEIPT_INVOICE_URL = 'https://api.target.com/receipts/v1/invoice';

interface TargetOrder {
  placed_date: string;
  order_type: string;
  summary: { grand_total: string };
  order_lines: Array<{
    line_number: number;
    original_quantity: number;
    item: { tcin: string; description: string };
  }>;
  order_number?: string;
  order_purchase_type: string;
  store_receipt_id?: string;
}

interface TargetFetchRequest {
  type: 'MATCHA_TARGET_FETCH';
  requestId: string;
  startDate: string;
}

window.addEventListener('message', async (event) => {
  if (event.source !== window) return;
  if (event.data?.type !== 'MATCHA_TARGET_FETCH') return;

  const req = event.data as TargetFetchRequest;

  // No need to read cookies directly — browser attaches them automatically
  // with credentials: 'include'. We just need the API key header.
  const headers: Record<string, string> = {
    accept: 'application/json',
    'x-api-key': TARGET_API_KEY,
  };

  try {
    const receipts: Array<{
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
    }> = [];

    // Fetch online orders (page by page)
    await fetchOrders(headers, 'ONLINE', req.startDate, receipts);
    // Fetch in-store orders (page by page)
    await fetchOrders(headers, 'STORE', req.startDate, receipts);

    console.log(
      `[matcha] Target MAIN: found ${receipts.length} total receipts`
    );
    window.postMessage(
      { type: 'MATCHA_TARGET_RESULT', requestId: req.requestId, receipts },
      '*'
    );
  } catch (err) {
    console.error('[matcha] Target MAIN error:', err);
    window.postMessage(
      {
        type: 'MATCHA_TARGET_RESULT',
        requestId: req.requestId,
        error: String(err),
      },
      '*'
    );
  }
});

async function fetchOrders(
  headers: Record<string, string>,
  purchaseType: 'ONLINE' | 'STORE',
  startDate: string,
  receipts: Array<{
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
  }>
): Promise<void> {
  let page = 1;
  const pageSize = 10;
  let totalPages = 1;

  while (page <= totalPages) {
    const url = `${ORDER_HISTORY_URL}?page_number=${page}&page_size=${pageSize}&order_purchase_type=${purchaseType}&pending_order=true&shipt_status=true`;
    console.log(
      `[matcha] Target MAIN: fetching ${purchaseType} orders page ${page}`
    );

    const resp = await fetch(url, { headers, credentials: 'include' });
    if (!resp.ok) {
      console.warn(`[matcha] Target MAIN: order history API ${resp.status}`);
      break;
    }

    const data = await resp.json();
    totalPages = data.total_pages || 1;
    const orders: TargetOrder[] = data.orders || [];
    const cutoff = new Date(startDate);

    for (const order of orders) {
      const orderDate = new Date(order.placed_date);
      if (orderDate < cutoff) continue;

      const rawOrderId = order.order_number;
      const orderId =
        rawOrderId ||
        order.store_receipt_id ||
        order.order_lines?.[0]?.item?.tcin ||
        `target-${orderDate.getTime()}`;
      const total = parseFloat(order.summary.grand_total) || 0;

      // Try store order details API for STORE orders (has item prices)
      if (order.order_purchase_type === 'STORE' && order.store_receipt_id) {
        const storeReceipt = await fetchStoreOrderDetails(
          headers,
          order.store_receipt_id,
          orderDate.toISOString()
        );
        if (storeReceipt) {
          receipts.push(storeReceipt);
          continue;
        }
      }

      // Try invoice API for online orders
      if (rawOrderId) {
        const invoiceReceipts = await fetchInvoiceDetails(
          headers,
          rawOrderId,
          orderDate.toISOString()
        );
        if (invoiceReceipts.length > 0) {
          receipts.push(...invoiceReceipts);
          continue;
        }
      }

      // Fall back to order_lines (no prices available from list API)
      const items = (order.order_lines || []).map((line) => ({
        name: decodeHtmlEntities(line.item.description),
        quantity: line.original_quantity || 1,
        unitPrice: 0,
        totalPrice: 0,
      }));

      receipts.push({
        orderId,
        orderUrlId: rawOrderId || orderId,
        storeReceiptId: order.store_receipt_id,
        purchaseType: order.order_purchase_type,
        orderDate: orderDate.toISOString(),
        total,
        storeName:
          order.order_purchase_type === 'STORE'
            ? (order as unknown as { address: Array<{ first_name: string }> })
                .address?.[0]?.first_name
            : undefined,
        items,
      });
    }

    page++;
  }
}

async function fetchStoreOrderDetails(
  headers: Record<string, string>,
  storeReceiptId: string,
  orderDate: string
): Promise<{
  orderId: string;
  storeReceiptId: string;
  purchaseType: string;
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
} | null> {
  try {
    const resp = await fetch(
      `${STORE_ORDER_DETAILS_URL}/${storeReceiptId}/store_order_details?subscription=false`,
      { headers, credentials: 'include' }
    );
    if (!resp.ok) {
      console.warn(
        `[matcha] Target MAIN: store detail for ${storeReceiptId} returned ${resp.status}`
      );
      return null;
    }
    const data = await resp.json();
    const orderLines: Array<{
      quantity: number;
      item: { description: string; unit_price: string; list_price: string };
    }> = data.order_lines || [];

    const totalTax = parseFloat(data.summary?.total_taxes) || 0;
    const grandTotal = parseFloat(data.summary?.grand_total) || 0;

    // Fetch HTML receipt to get per-item taxability flags
    let taxable: boolean[] | undefined;
    const htmlReceiptText = await fetchStoreReceiptHtml(
      headers,
      storeReceiptId
    );
    if (htmlReceiptText) {
      const htmlReceipt = parseTargetReceiptHtml(htmlReceiptText);
      const taxFlagMap = new Map<string, boolean>();
      for (const htmlItem of htmlReceipt.items) {
        taxFlagMap.set(htmlItem.dpci, htmlItem.taxFlag.includes('T'));
      }
      taxable = orderLines.map((line) => {
        const dpci = (line as { item: { dpci?: string } }).item?.dpci;
        if (!dpci) return true; // unknown → assume taxable (conservative)
        return taxFlagMap.get(normalizeDpci(dpci)) ?? true;
      });
    }

    const items = mapTargetStoreLines(
      orderLines,
      { total: grandTotal, tax: totalTax },
      taxable ? { taxable } : undefined
    );
    const storeName = data.address?.[0]?.first_name;

    return {
      orderId: storeReceiptId,
      storeReceiptId,
      purchaseType: 'STORE',
      orderDate,
      total: grandTotal,
      tax: totalTax > 0 ? Math.round(totalTax * 100) / 100 : undefined,
      storeName,
      items,
    };
  } catch (err) {
    console.warn(
      `[matcha] Target MAIN: store order details error for ${storeReceiptId}:`,
      err
    );
    return null;
  }
}

async function fetchStoreReceiptHtml(
  headers: Record<string, string>,
  storeReceiptId: string
): Promise<string | null> {
  try {
    const receiptId = storeReceiptId.replace(/-/g, '');
    const resp = await fetch(RECEIPT_INVOICE_URL, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        receipt_name: 'Guest Sale Receipt',
        receipt_id: receiptId,
        printer_type: 'html',
      }),
    });
    if (!resp.ok) {
      console.warn(
        `[matcha] Target MAIN: HTML receipt for ${storeReceiptId} returned ${resp.status}`
      );
      return null;
    }
    return await resp.text();
  } catch (err) {
    console.warn(
      `[matcha] Target MAIN: HTML receipt error for ${storeReceiptId}:`,
      err
    );
    return null;
  }
}

async function fetchInvoiceDetails(
  headers: Record<string, string>,
  orderId: string,
  orderDate: string
): Promise<
  Array<{
    orderId: string;
    orderUrlId: string;
    invoiceId?: string;
    orderDate: string;
    total: number;
    tax?: number;
    items: Array<{
      name: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }>;
  }>
> {
  try {
    // Get invoice list for this order
    const listResp = await fetch(`${INVOICES_URL}/${orderId}/invoices`, {
      headers,
      credentials: 'include',
    });
    if (!listResp.ok) {
      console.warn(
        `[matcha] Target MAIN: invoice list for ${orderId} returned ${listResp.status}`
      );
      return [];
    }
    const listData = await listResp.json();
    const invoiceList: Array<{ id: string; amount: number; date: string }> =
      listData.invoices || [];

    const results: Array<{
      orderId: string;
      orderUrlId: string;
      invoiceId?: string;
      orderDate: string;
      total: number;
      tax?: number;
      items: Array<{
        name: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
      }>;
    }> = [];

    for (const inv of invoiceList) {
      try {
        const detailResp = await fetch(
          `${INVOICES_URL}/${orderId}/invoices/${inv.id}`,
          {
            headers,
            credentials: 'include',
          }
        );
        if (!detailResp.ok) {
          console.warn(
            `[matcha] Target MAIN: invoice detail ${inv.id} returned ${detailResp.status}`
          );
          continue;
        }
        const detail = await detailResp.json();
        const lines: TargetOrderLine[] =
          detail.lines || detail.order_lines || [];
        const { items, tax: totalTax } = mapTargetInvoiceLines(lines);

        results.push({
          orderId: `${orderId}-${inv.id}`,
          orderUrlId: orderId,
          invoiceId: inv.id,
          orderDate: inv.date || orderDate,
          total:
            parseFloat(String(detail.total_amount)) ||
            parseFloat(String(inv.amount)) ||
            0,
          tax: totalTax > 0 ? totalTax : undefined,
          items,
        });
      } catch (err) {
        console.warn(
          `[matcha] Target MAIN: invoice detail error for ${inv.id}:`,
          err
        );
      }
    }

    return results;
  } catch (err) {
    console.warn(
      `[matcha] Target MAIN: invoice list error for ${orderId}:`,
      err
    );
    return [];
  }
}

// Signal ready
window.postMessage({ type: 'MATCHA_TARGET_READY' }, '*');
console.log('[matcha] Target MAIN world script loaded');
