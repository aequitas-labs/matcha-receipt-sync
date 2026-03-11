import type {
  ReceiptScraper,
  ScrapeContext,
  ScrapedReceipt,
  ScrapedItem,
} from '../../types/scraper';
import { parseCurrency } from '../../utils/currency';
import { parseDate } from '../../utils/date';
import { waitForElement } from '../../utils/dom';
import { SELECTORS } from './selectors';

export class TargetScraper implements ReceiptScraper {
  readonly retailerId = 'target';
  readonly retailerName = 'Target';
  readonly matchUrls = ['https://www.target.com/orders*'];
  readonly requiresApiAccess = false;

  async scrape(context: ScrapeContext): Promise<ScrapedReceipt[]> {
    const doc = context.document;
    if (!doc) throw new Error('Target scraper requires document context');

    // Target is a React SPA - wait for order cards to render
    await waitForElement(doc, SELECTORS.ORDER_CARD.split(',')[0].trim(), 8000);

    const receipts: ScrapedReceipt[] = [];
    const orderCards = doc.querySelectorAll(SELECTORS.ORDER_CARD);

    for (const card of orderCards) {
      try {
        const receipt = this.parseCard(card);
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

  private parseCard(el: Element): ScrapedReceipt | null {
    const orderId = el.querySelector(SELECTORS.ORDER_ID)?.textContent?.trim();
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
    return { name, quantity: 1, unitPrice: price, totalPrice: price };
  }
}
