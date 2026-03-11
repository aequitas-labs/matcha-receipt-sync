import type {
  ReceiptScraper,
  ScrapeContext,
  ScrapedReceipt,
} from '../../types/scraper';

export class CostcoScraper implements ReceiptScraper {
  readonly retailerId = 'costco';
  readonly retailerName = 'Costco';
  readonly matchUrls = ['https://www.costco.com/OrderStatusCmd*'];
  // Costco API calls must run from the content script (costco.com origin)
  // to pass Akamai WAF checks. The content script handles everything and
  // sends SCRAPE_COMPLETE back to the service worker.
  readonly requiresApiAccess = false;

  async scrape(_context: ScrapeContext): Promise<ScrapedReceipt[]> {
    return [];
  }
}
