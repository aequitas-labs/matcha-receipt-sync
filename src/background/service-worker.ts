import { ScraperRegistry } from '../scrapers/registry';
import { AmazonScraper } from '../scrapers/amazon';
import { SyncOrchestrator } from './sync-orchestrator';
import { AlarmManager } from './alarm-manager';
import { getDebugLog, clearDebugLog } from '../debug/logger';
import type { ExtensionMessage, InvoiceRef } from '../types/messages';
import type { ScrapedReceipt } from '../types/scraper';

const registry = new ScraperRegistry();
const orchestrator = new SyncOrchestrator(registry);

console.log('[matcha] Service worker started');

// Retailer config: URL patterns for matching open tabs, the page to open if
// no tab exists, and the content script to inject.
const RETAILER_TAB_CONFIG: Record<
  string,
  { urlPatterns: string[]; orderPageUrl: string; scriptFile: string }
> = {
  amazon: {
    urlPatterns: [
      'https://www.amazon.com/your-orders*',
      'https://www.amazon.com/gp/your-account/order-history*',
      'https://www.amazon.com/gp/css/order-history*',
    ],
    orderPageUrl: 'https://www.amazon.com/gp/your-account/order-history',
    scriptFile: 'content-amazon.js',
  },
  costco: {
    urlPatterns: [
      'https://www.costco.com/OrderStatusCmd*',
      'https://www.costco.com/myaccount/*',
    ],
    orderPageUrl: 'https://www.costco.com/OrderStatusCmd',
    scriptFile: 'content-costco.js',
  },
  walmart: {
    urlPatterns: [
      'https://www.walmart.com/orders*',
      'https://www.walmart.com/account/orders*',
    ],
    orderPageUrl: 'https://www.walmart.com/orders',
    scriptFile: 'content-walmart.js',
  },
  target: {
    urlPatterns: [
      'https://www.target.com/orders*',
      'https://www.target.com/account/orders*',
    ],
    orderPageUrl: 'https://www.target.com/orders',
    scriptFile: 'content-target.js',
  },
};

// Track tabs we opened so we can close them after scraping
const autoOpenedTabs = new Set<number>();

/**
 * For each retailer: open a fresh background tab to the order page.
 * Always opens a new tab (even if one is already open) to ensure a fresh
 * page load with current auth sessions. The manifest's content_scripts
 * will auto-inject when the page loads. Tabs are closed after scraping
 * completes via closeIfAutoOpened().
 */
async function getEnabledRetailers(): Promise<Set<string>> {
  const { enabledRetailers } = await chrome.storage.local.get('enabledRetailers');
  if (enabledRetailers) return new Set(enabledRetailers);
  return new Set(Object.keys(RETAILER_TAB_CONFIG)); // all enabled by default
}

async function triggerDomScrapers(): Promise<void> {
  const enabled = await getEnabledRetailers();
  for (const [retailerId, config] of Object.entries(RETAILER_TAB_CONFIG)) {
    if (!enabled.has(retailerId)) {
      console.log(`[matcha] Skipping disabled retailer: ${retailerId}`);
      continue;
    }
    try {
      console.log(
        `[matcha] Opening ${retailerId} order page in background tab`
      );
      const tab = await chrome.tabs.create({
        url: config.orderPageUrl,
        active: false,
      });
      if (tab.id) {
        autoOpenedTabs.add(tab.id);
      }
    } catch (err) {
      console.warn(`[matcha] Failed to trigger ${retailerId}:`, err);
    }
  }
}

// Initialize alarms — fires triggerDomScrapers on schedule
const alarmManager = new AlarmManager(() => triggerDomScrapers());
alarmManager.initialize().catch(console.error);

/** Open a fresh tab for a single retailer */
async function triggerSingleRetailer(retailerId: string): Promise<void> {
  const config = RETAILER_TAB_CONFIG[retailerId];
  if (!config) {
    console.warn(`[matcha] Unknown retailer: ${retailerId}`);
    return;
  }
  console.log(`[matcha] Opening ${retailerId} order page in background tab`);
  const tab = await chrome.tabs.create({
    url: config.orderPageUrl,
    active: false,
  });
  if (tab.id) {
    autoOpenedTabs.add(tab.id);
  }
}

// Debug: log when auto-opened tabs finish loading (to catch redirects)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (autoOpenedTabs.has(tabId) && changeInfo.status === 'complete') {
    console.log(`[matcha] Auto-opened tab ${tabId} loaded: ${tab.url}`);
  }
});

const amazonScraper = new AmazonScraper();

/** Fetch each Amazon invoice page and parse into receipts */
async function fetchAndParseInvoices(
  invoices: InvoiceRef[]
): Promise<ScrapedReceipt[]> {
  const receipts: ScrapedReceipt[] = [];

  for (const ref of invoices) {
    try {
      console.log(
        `[matcha] Fetching invoice for order ${ref.orderId}: ${ref.invoiceUrl}`
      );
      const response = await fetch(ref.invoiceUrl, { credentials: 'include' });

      if (!response.ok) {
        console.warn(
          `[matcha] Invoice fetch failed for ${ref.orderId}: ${response.status}`
        );
        continue;
      }

      const html = await response.text();
      const receipt = amazonScraper.parseInvoicePage(html, ref);
      if (receipt) {
        receipts.push(receipt);
      }
    } catch (err) {
      console.warn(`[matcha] Error fetching invoice for ${ref.orderId}:`, err);
    }
  }

  return receipts;
}

/** Fetch Amazon order list pages starting from nextUrl, collecting invoice URLs across all pages */
async function fetchPaginatedInvoiceUrls(
  nextUrl: string,
  cursorDate?: string
): Promise<InvoiceRef[]> {
  const allInvoices: InvoiceRef[] = [];
  let url: string | null = nextUrl;
  let page = 2;
  const MAX_PAGES = 50; // safety limit

  while (url && page <= MAX_PAGES) {
    console.log(`[matcha] Amazon: fetching page ${page}: ${url}`);
    try {
      const resp = await fetch(url, { credentials: 'include' });
      if (!resp.ok) {
        console.warn(
          `[matcha] Amazon page ${page} fetch failed: ${resp.status}`
        );
        break;
      }
      const html = await resp.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');

      const invoices = amazonScraper.collectInvoiceUrls(doc, cursorDate);
      console.log(
        `[matcha] Amazon: page ${page} — found ${invoices.length} invoices`
      );
      allInvoices.push(...invoices);

      // Find next page link
      const nextLink = doc.querySelector(
        'ul.a-pagination li.a-last a'
      ) as HTMLAnchorElement | null;
      if (nextLink?.getAttribute('href')) {
        const href = nextLink.getAttribute('href')!;
        url = href.startsWith('http') ? href : `https://www.amazon.com${href}`;
      } else {
        url = null;
      }
      page++;
    } catch (err) {
      console.warn(`[matcha] Amazon page ${page} error:`, err);
      break;
    }
  }

  return allInvoices;
}

/** Close a tab if we auto-opened it for scraping */
function closeIfAutoOpened(sender: chrome.runtime.MessageSender): void {
  const tabId = sender.tab?.id;
  if (tabId && autoOpenedTabs.has(tabId)) {
    autoOpenedTabs.delete(tabId);
    console.log(`[matcha] Closing auto-opened tab ${tabId}`);
    chrome.tabs.remove(tabId).catch(() => {});
  }
}

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender, sendResponse) => {
    console.log(
      `[matcha] SW received: ${message.type}`,
      'from tab:',
      sender.tab?.id,
      sender.tab?.url
    );
    switch (message.type) {
      case 'SCRAPE_COMPLETE':
        closeIfAutoOpened(sender);
        orchestrator
          .handleScrapedReceipts(message.retailerId, message.receipts)
          .then(() => sendResponse({ success: true }))
          .catch(console.error);
        return true;

      case 'INVOICE_URLS':
        closeIfAutoOpened(sender);
        fetchAndParseInvoices(message.invoices)
          .then((receipts) => {
            console.log(
              `[matcha] Parsed ${receipts.length} invoices for ${message.retailerId}`
            );
            if (receipts.length > 0) {
              return orchestrator.handleScrapedReceipts(
                message.retailerId,
                receipts
              );
            }
          })
          .then(() => sendResponse({ success: true }))
          .catch((err) => {
            console.error(`[matcha] Invoice processing error:`, err);
            sendResponse({ success: false, error: String(err) });
          });
        return true;

      case 'FETCH_PAGINATED_INVOICES':
        fetchPaginatedInvoiceUrls(message.nextUrl, message.cursorDate)
          .then((invoices) => sendResponse(invoices))
          .catch((err) => {
            console.error('[matcha] Pagination fetch error:', err);
            sendResponse([]);
          });
        return true;

      case 'SCRAPE_ERROR':
        closeIfAutoOpened(sender);
        orchestrator
          .recordError(message.retailerId, message.error)
          .catch(console.error);
        break;

      case 'COSTCO_AUTH_TOKENS':
        // Legacy: content script now handles API calls directly
        closeIfAutoOpened(sender);
        break;

      case 'MANUAL_SYNC_REQUEST':
        // Open fresh tabs for all retailers (content scripts handle scraping)
        triggerDomScrapers()
          .then(() => sendResponse({ success: true }))
          .catch((err) => sendResponse({ success: false, error: String(err) }));
        return true;

      case 'SYNC_RETAILER_REQUEST':
        triggerSingleRetailer(message.retailerId)
          .then(() => sendResponse({ success: true }))
          .catch((err: unknown) =>
            sendResponse({ success: false, error: String(err) })
          );
        return true;

      case 'GET_STATUS_REQUEST':
        orchestrator
          .getStatus()
          .then((status) =>
            sendResponse({ type: 'GET_STATUS_RESPONSE', status })
          )
          .catch(console.error);
        return true;

      case 'GET_DEBUG_LOG_REQUEST':
        getDebugLog()
          .then((entries) =>
            sendResponse({ type: 'GET_DEBUG_LOG_RESPONSE', entries })
          )
          .catch(console.error);
        return true;

      case 'CLEAR_DEBUG_LOG':
        clearDebugLog().catch(console.error);
        break;
    }
  }
);
