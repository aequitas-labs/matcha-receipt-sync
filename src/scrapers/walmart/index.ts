import type {
  ReceiptScraper,
  ScrapeContext,
  ScrapedReceipt,
  ScrapedItem,
} from '../../types/scraper';
import { parseCurrency } from '../../utils/currency';
import { parseDate } from '../../utils/date';
import { SELECTORS } from './selectors';

export class WalmartScraper implements ReceiptScraper {
  readonly retailerId = 'walmart';
  readonly retailerName = 'Walmart';
  readonly matchUrls = ['https://www.walmart.com/orders*'];
  readonly requiresApiAccess = false;

  async scrape(context: ScrapeContext): Promise<ScrapedReceipt[]> {
    const doc = context.document;
    if (!doc) throw new Error('Walmart scraper requires document context');

    const receipts: ScrapedReceipt[] = [];
    const orderCards = doc.querySelectorAll(SELECTORS.ORDER_CARD);

    for (const card of orderCards) {
      try {
        const receipt = this.parseOrderCard(card);
        if (!receipt) continue;

        if (context.cursor?.lastSyncedAt) {
          const cutoff = new Date(context.cursor.lastSyncedAt);
          if (receipt.orderDate < cutoff) continue;
        }

        receipts.push(receipt);
      } catch {
        // Skip malformed orders
      }
    }

    return receipts;
  }

  private parseOrderCard(el: Element): ScrapedReceipt | null {
    const orderId = el
      .querySelector(SELECTORS.ORDER_NUMBER)
      ?.textContent?.trim();
    const dateText = el
      .querySelector(SELECTORS.ORDER_DATE)
      ?.textContent?.trim();
    const totalText = el
      .querySelector(SELECTORS.ORDER_TOTAL)
      ?.textContent?.trim();

    if (!orderId || !dateText || !totalText) return null;

    const orderDate = parseDate(dateText);
    if (!orderDate) return null;

    const items = Array.from(el.querySelectorAll(SELECTORS.ITEM_ROW))
      .map((row) => this.parseItem(row))
      .filter((i): i is ScrapedItem => i !== null);

    return {
      retailer: this.retailerId,
      orderId: orderId.replace(/[^a-zA-Z0-9-]/g, ''),
      orderDate,
      totalAmount: parseCurrency(totalText),
      items,
    };
  }

  private parseItem(el: Element): ScrapedItem | null {
    const name = el.querySelector(SELECTORS.ITEM_NAME)?.textContent?.trim();
    const priceText = el
      .querySelector(SELECTORS.ITEM_PRICE)
      ?.textContent?.trim();
    if (!name || !priceText) return null;

    const price = parseCurrency(priceText);
    const qtyText = el.querySelector(SELECTORS.ITEM_QTY)?.textContent?.trim();
    const quantity = qtyText ? parseInt(qtyText, 10) || 1 : 1;

    return {
      name,
      quantity,
      unitPrice: price / quantity,
      totalPrice: price,
    };
  }
}
