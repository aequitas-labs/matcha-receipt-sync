import type {
  ReceiptScraper,
  ScrapeContext,
  ScrapedReceipt,
} from '../../types/scraper';

export class AmazonScraper implements ReceiptScraper {
  readonly retailerId = 'amazon';
  readonly retailerName = 'Amazon';
  readonly matchUrls = [
    'https://www.amazon.com/your-orders*',
    'https://www.amazon.com/gp/your-account/order-history*',
    'https://www.amazon.com/gp/css/order-history*',
  ];
  readonly requiresApiAccess = false;

  async scrape(_context: ScrapeContext): Promise<ScrapedReceipt[]> {
    // Scraping is handled by page.ts (MAIN world) + bridge.ts (ISOLATED world)
    return [];
  }
}
