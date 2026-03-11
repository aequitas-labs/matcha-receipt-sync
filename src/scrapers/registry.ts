import type { ReceiptScraper } from '../types/scraper';
import { AmazonScraper } from './amazon';
import { CostcoScraper } from './costco';
import { WalmartScraper } from './walmart';
import { TargetScraper } from './target';

const ALL_SCRAPERS: ReceiptScraper[] = [
  new AmazonScraper(),
  new CostcoScraper(),
  new WalmartScraper(),
  new TargetScraper(),
];

export class ScraperRegistry {
  private scrapers = new Map<string, ReceiptScraper>();

  constructor(scrapers: ReceiptScraper[] = ALL_SCRAPERS) {
    for (const scraper of scrapers) {
      this.scrapers.set(scraper.retailerId, scraper);
    }
  }

  getById(retailerId: string): ReceiptScraper | undefined {
    return this.scrapers.get(retailerId);
  }

  getAll(): ReceiptScraper[] {
    return Array.from(this.scrapers.values());
  }
}
