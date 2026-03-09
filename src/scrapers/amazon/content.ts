import { AmazonScraper } from '.';
import { MessageBridge } from '../../content/message-bridge';
import { showToast } from '../../content/toast';

/**
 * Amazon content script: collects invoice URLs from the order list page,
 * traversing all pagination pages via the service worker.
 */

const ORDER_CARD_SELECTOR =
  '.js-order-card, [id="orderCard"], .order-card, .a-box-group.order';
const NEXT_PAGE_SELECTOR = 'ul.a-pagination li.a-last a';

/** Poll until order cards appear in the DOM (Amazon is JS-heavy) */
async function waitForOrderCards(
  maxMs = 10_000,
  pollMs = 500
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (document.querySelector(ORDER_CARD_SELECTOR)) return true;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return false;
}

/** Find the "Next" pagination link on the current page */
function getNextPageUrl(): string | null {
  const nextLink = document.querySelector(
    NEXT_PAGE_SELECTOR
  ) as HTMLAnchorElement | null;
  return nextLink?.href ?? null;
}

async function run(): Promise<void> {
  const scraper = new AmazonScraper();
  const bridge = new MessageBridge();

  try {
    // Wait for order cards to render
    const found = await waitForOrderCards();
    if (!found) {
      console.log(
        '[matcha] Amazon: no order cards found after waiting. URL:',
        location.href
      );
      bridge.sendScrapeError(
        scraper.retailerId,
        'No order cards found on page'
      );
      return;
    }

    const cursor = await bridge.getCursor(scraper.retailerId);
    const allInvoices = scraper.collectInvoiceUrls(
      document,
      cursor?.lastSyncedAt
    );

    console.log(
      `[matcha] Amazon: page 1 — found ${allInvoices.length} invoices`
    );

    // Check for more pages — fetch them in the service worker to avoid navigation
    const nextUrl = getNextPageUrl();
    if (nextUrl) {
      console.log(
        `[matcha] Amazon: pagination detected, fetching remaining pages...`
      );
      showToast('Scanning Amazon orders (page 1)...', 'info');

      // Ask service worker to fetch remaining pages
      const moreInvoices = await bridge.fetchPaginatedInvoices(
        scraper.retailerId,
        nextUrl,
        cursor?.lastSyncedAt
      );
      allInvoices.push(...moreInvoices);
    }

    console.log(
      `[matcha] Amazon: collected ${allInvoices.length} total invoice URLs`
    );

    if (allInvoices.length > 0) {
      bridge.sendInvoiceUrls(scraper.retailerId, allInvoices);
      showToast(
        `Found ${allInvoices.length} order(s) from Amazon. Fetching invoices...`,
        'success'
      );
    } else {
      console.log(
        `[matcha] Amazon: no new orders found. URL: ${location.href}`
      );
      showToast('No new Amazon orders found', 'info');
    }
  } catch (err) {
    console.error('[matcha] Amazon content script error:', err);
    bridge.sendScrapeError(scraper.retailerId, String(err));
    showToast(`Error scanning Amazon orders: ${err}`, 'error');
  }
}

run();
