import type { ReceiptScraper, ScrapeContext } from '../types/scraper';
import { MessageBridge } from './message-bridge';
import { showToast } from './toast';
import { log } from '../utils/log';

/**
 * Shared content script runner for DOM-based scrapers.
 * Each retailer's content.ts imports this and passes its scraper instance.
 */
export async function runContentScript(scraper: ReceiptScraper): Promise<void> {
  const bridge = new MessageBridge();

  if (scraper.requiresApiAccess) {
    return;
  }

  try {
    const cursor = await bridge.getCursor(scraper.retailerId);
    const context: ScrapeContext = { document, cursor };
    const receipts = await scraper.scrape(context);

    log(
      `[matcha] ${scraper.retailerName}: scraped ${receipts.length} receipts`,
      receipts
    );

    if (receipts.length > 0) {
      bridge.sendScrapedReceipts(scraper.retailerId, receipts);
      showToast(
        `Found ${receipts.length} order(s) from ${scraper.retailerName}`,
        'success'
      );
    } else {
      log(
        `[matcha] ${scraper.retailerName}: no orders matched. Page URL: ${location.href}`
      );
      log(
        `[matcha] Page body snippet (first 500 chars):`,
        document.body?.innerText?.slice(0, 500)
      );
      showToast(
        `No orders found on ${scraper.retailerName}`,
        'info'
      );
    }
  } catch (err) {
    console.error(`[matcha] ${scraper.retailerName} scrape error:`, err);
    bridge.sendScrapeError(scraper.retailerId, String(err));
    showToast(
      `Error scanning ${scraper.retailerName}: ${err}`,
      'error'
    );
  }
}
