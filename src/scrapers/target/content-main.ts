/**
 * Target MAIN world script — runs in the page's JS context so fetch()
 * uses target.com's origin and cookies. Communicates with the ISOLATED
 * world content script via window.postMessage.
 */

const TARGET_API_KEY = 'ff457966e64d5e877fdbad070f276d18ecec4a01';
const ORDER_HISTORY_URL =
  'https://api.target.com/guest_order_aggregations/v1/order_history';
const INVOICES_URL = 'https://api.target.com/post_order_invoices/v1/orders';

interface TargetOrderLine {
  description: string;
  quantity: number;
  unit_price: number;
  effective_amount: number;
  sub_total: number;
  total_tax: number;
  item: { tcin: string; description: string };
  charges?: Array<{ type: string; name: string; value: number }>;
}

interface TargetInvoice {
  id: string;
  type: string;
  date: string;
  total_amount: number;
  lines: TargetOrderLine[];
}

interface TargetOrder {
  placed_date: string;
  order_type: string;
  summary: { grand_total: string };
  order_lines: Array<{
    line_number: number;
    original_quantity: number;
    item: { tcin: string; description: string };
  }>;
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

      const orderId =
        order.store_receipt_id ||
        order.order_lines?.[0]?.item?.tcin ||
        `target-${orderDate.getTime()}`;
      const total = parseFloat(order.summary.grand_total) || 0;
      const _storeName =
        order.order_purchase_type === 'STORE'
          ? order.order_lines?.[0]?.item?.description
          : undefined;

      // For online orders, try to get invoice details
      if (purchaseType === 'ONLINE') {
        // Extract order ID from the order - it's the numeric ID in the order link
        // Online orders have order_id at the top level
        const onlineOrderId = (order as unknown as { order_id: string })
          .order_id;
        if (onlineOrderId) {
          const invoiceReceipts = await fetchInvoiceDetails(
            headers,
            onlineOrderId,
            orderDate.toISOString()
          );
          receipts.push(...invoiceReceipts);
          continue;
        }
      }

      // For store orders or when invoice API isn't available, use order_lines from list
      const items = (order.order_lines || []).map((line) => ({
        name: decodeHtmlEntities(line.item.description),
        quantity: line.original_quantity || 1,
        unitPrice: 0, // Store receipt API doesn't include prices in the list
        totalPrice: 0,
      }));

      receipts.push({
        orderId,
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

async function fetchInvoiceDetails(
  headers: Record<string, string>,
  orderId: string,
  orderDate: string
): Promise<
  Array<{
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
  }>
> {
  try {
    // Get invoice list for this order
    const listResp = await fetch(`${INVOICES_URL}/${orderId}/invoices`, {
      headers,
      credentials: 'include',
    });
    if (!listResp.ok) return [];
    const listData = await listResp.json();
    const invoiceList: Array<{ id: string; amount: number; date: string }> =
      listData.invoices || [];

    const results: Array<{
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
        if (!detailResp.ok) continue;
        const detail: TargetInvoice = await detailResp.json();

        const lines = detail.lines || [];
        const items = lines.map((line) => ({
          name: decodeHtmlEntities(line.item.description),
          quantity: line.quantity || 1,
          unitPrice: line.unit_price || 0,
          totalPrice: line.effective_amount || line.sub_total || 0,
        }));

        const totalTax = lines.reduce(
          (sum, line) => sum + (line.total_tax || 0),
          0
        );

        results.push({
          orderId: `${orderId}-${inv.id}`,
          orderDate: inv.date || orderDate,
          total: detail.total_amount || inv.amount || 0,
          tax: totalTax > 0 ? Math.round(totalTax * 100) / 100 : undefined,
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

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCharCode(parseInt(code, 16))
    )
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&trade;/g, '\u2122')
    .replace(/&reg;/g, '\u00AE');
}

// Signal ready
window.postMessage({ type: 'MATCHA_TARGET_READY' }, '*');
console.log('[matcha] Target MAIN world script loaded');
