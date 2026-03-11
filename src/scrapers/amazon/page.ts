import { parseDate } from '../../utils/date';
import type { ScrapedReceipt } from '../../types/scraper';
import { type InvoiceRef, parseInvoicePage } from './parser';
import { log, warn } from '../../utils/log';

/**
 * Amazon MAIN world script — runs in page context with full DOM + fetch access.
 * Handles all order discovery and invoice parsing for Amazon.
 *
 * Protocol:
 *   bridge.ts posts MATCHA_AMAZON_FETCH → this script fetches + parses → posts MATCHA_AMAZON_RESULT
 *   Progress is reported via MATCHA_AMAZON_PROGRESS messages.
 */

interface AmazonFetchMessage {
  type: 'MATCHA_AMAZON_FETCH';
  requestId: string;
  startDate?: string;
  years: number[];
}

interface AmazonProgressMessage {
  type: 'MATCHA_AMAZON_PROGRESS';
  requestId: string;
  phase: 'scanning' | 'fetching';
  current: number;
  total: number;
  message?: string;
}

// ─── Selectors (from selectors.ts) ────────────────────────────────────────────

const ORDER_GROUP = '.js-order-card, [id="orderCard"], .order-card, .a-box-group.order';
const ORDER_ID_SEL = '.yohtmlc-order-id span[dir="ltr"], .yohtmlc-order-id span:last-child, a[href*="orderID="]';
const ORDER_HEADER_ITEM = '.order-header__header-list-item';
const INVOICE_LINK = 'a[href*="summary/print.html"]';

// ─── Invoice ref collection from DOM ──────────────────────────────────────────

function collectInvoiceUrlsFromDoc(doc: Document, cursorDate?: string): InvoiceRef[] {
  const orderGroups = doc.querySelectorAll(ORDER_GROUP);
  const invoices: InvoiceRef[] = [];
  log(`[matcha] Amazon: found ${orderGroups.length} order groups in DOM`);

  for (const group of orderGroups) {
    try {
      const orderId = group.querySelector(ORDER_ID_SEL)?.textContent?.trim();
      if (!orderId) continue;

      let dateText: string | null = null;
      for (const item of group.querySelectorAll(ORDER_HEADER_ITEM)) {
        const label = item.querySelector('.a-text-caps')?.textContent?.trim()?.toLowerCase();
        if (label === 'order placed') {
          dateText =
            item.querySelector('.a-size-base.a-color-secondary:not(.a-text-caps)')?.textContent?.trim() ??
            item.querySelector('.aok-break-word')?.textContent?.trim() ??
            null;
          break;
        }
      }

      if (!dateText) continue;
      const orderDate = parseDate(dateText);
      if (!orderDate) continue;
      if (cursorDate && orderDate < new Date(cursorDate)) continue;

      const invoiceLink = group.querySelector(INVOICE_LINK) as HTMLAnchorElement | null;
      if (!invoiceLink?.href) continue;

      const cleanOrderId = orderId.replace(/[^a-zA-Z0-9-]/g, '');
      invoices.push({ orderId: cleanOrderId, orderDate: orderDate.toISOString(), invoiceUrl: invoiceLink.href });
    } catch {
      // skip malformed order cards
    }
  }

  return invoices;
}

// ─── Paginated order list fetching ────────────────────────────────────────────

async function fetchPaginatedInvoiceUrls(
  yearUrl: string,
  cursorDate: string | undefined,
  onProgress: (found: number) => void
): Promise<InvoiceRef[]> {
  const PAGE_SIZE = 10;
  const MAX_PAGES = 20;
  const allInvoices: InvoiceRef[] = [];
  const seenIds = new Set<string>();
  const cutoff = cursorDate ? new Date(cursorDate) : null;

  const baseUrl = new URL(yearUrl);
  baseUrl.searchParams.set('disableCsd', 'missing-library');

  let emptyPages = 0;
  for (let page = 1; page <= MAX_PAGES; page++) {
    baseUrl.searchParams.set('startIndex', String((page - 1) * PAGE_SIZE));

    let html: string;
    try {
      const resp = await fetch(baseUrl.toString());
      if (!resp.ok) { warn(`[matcha] Amazon page ${page} failed: ${resp.status}`); break; }
      html = await resp.text();
    } catch (err) {
      warn(`[matcha] Amazon page ${page} error:`, err);
      break;
    }

    // Parse with DOMParser — available in MAIN world
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const invoices = collectInvoiceUrlsFromDoc(doc, cursorDate);

    let newCount = 0;
    let allTooOld = invoices.length > 0;
    for (const inv of invoices) {
      if (cutoff) {
        if (new Date(inv.orderDate) < cutoff) continue;
        allTooOld = false;
      } else {
        allTooOld = false;
      }
      if (!seenIds.has(inv.orderId)) {
        allInvoices.push(inv);
        seenIds.add(inv.orderId);
        newCount++;
      }
    }

    log(`[matcha] Amazon: page ${page} — ${invoices.length} found, ${newCount} new`);
    onProgress(allInvoices.length);

    if (allTooOld && invoices.length > 0) break; // past date range
    if (newCount === 0) { if (++emptyPages >= 2) break; } else { emptyPages = 0; }
  }

  return allInvoices;
}

// ─── Parallel invoice fetch + parse ───────────────────────────────────────────

async function fetchAndParseInvoices(
  invoices: InvoiceRef[],
  onProgress: (current: number, total: number) => void
): Promise<ScrapedReceipt[]> {
  const CONCURRENCY = 5;
  const receipts: ScrapedReceipt[] = [];
  let done = 0;

  async function fetchOne(ref: InvoiceRef): Promise<ScrapedReceipt | null> {
    try {
      const resp = await fetch(ref.invoiceUrl);
      if (!resp.ok) { warn(`[matcha] Invoice fetch failed ${ref.orderId}: ${resp.status}`); return null; }
      return parseInvoicePage(await resp.text(), ref);
    } catch (err) {
      warn(`[matcha] Invoice error ${ref.orderId}:`, err);
      return null;
    }
  }

  for (let i = 0; i < invoices.length; i += CONCURRENCY) {
    const batch = invoices.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(fetchOne));
    for (const r of results) { if (r) receipts.push(r); }
    done += batch.length;
    onProgress(done, invoices.length);
  }

  return receipts;
}

// ─── Main message handler ──────────────────────────────────────────────────────

window.addEventListener('message', async (event) => {
  if (event.source !== window || event.data?.type !== 'MATCHA_AMAZON_FETCH') return;
  const req = event.data as AmazonFetchMessage;
  const { requestId, startDate, years } = req;

  const postProgress = (msg: Omit<AmazonProgressMessage, 'type' | 'requestId'>) =>
    window.postMessage({ type: 'MATCHA_AMAZON_PROGRESS', requestId, ...msg } satisfies AmazonProgressMessage, '*');

  try {
    postProgress({ phase: 'scanning', current: 0, total: years.length, message: 'Scanning orders...' });

    // Collect from current page DOM
    const allInvoices = collectInvoiceUrlsFromDoc(document, startDate);
    const seenIds = new Set(allInvoices.map((i) => i.orderId));

    // Fetch all years in parallel
    const yearResults = await Promise.all(
      years.map((year, idx) => {
        const yearUrl = `https://www.amazon.com/your-orders/orders?timeFilter=year-${year}&startIndex=0`;
        postProgress({ phase: 'scanning', current: idx, total: years.length, message: `Scanning ${year}...` });
        return fetchPaginatedInvoiceUrls(yearUrl, startDate, () => {});
      })
    );

    for (const yearInvoices of yearResults) {
      for (const inv of yearInvoices) {
        if (!seenIds.has(inv.orderId)) { allInvoices.push(inv); seenIds.add(inv.orderId); }
      }
    }

    postProgress({ phase: 'scanning', current: years.length, total: years.length, message: `Found ${allInvoices.length} orders` });
    log(`[matcha] Amazon: ${allInvoices.length} total orders to fetch`);

    // Fetch invoice detail pages
    const receipts = await fetchAndParseInvoices(allInvoices, (current, total) => {
      postProgress({ phase: 'fetching', current, total, message: `${current}/${total} invoices` });
    });

    window.postMessage({ type: 'MATCHA_AMAZON_RESULT', requestId, receipts }, '*');
  } catch (err) {
    console.error('[matcha] Amazon page script error:', err);
    window.postMessage({ type: 'MATCHA_AMAZON_RESULT', requestId, error: String(err) }, '*');
  }
});

window.postMessage({ type: 'MATCHA_AMAZON_READY' }, '*');
log('[matcha] Amazon page script loaded');
