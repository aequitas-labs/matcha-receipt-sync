import type {
  ReceiptScraper,
  ScrapeContext,
  ScrapedReceipt,
  ScrapedItem,
} from '../../types/scraper';
import type { InvoiceRef } from '../../types/messages';
import { parseCurrency } from '../../utils/currency';
import { parseDate } from '../../utils/date';
import { ORDER_LIST_SELECTORS } from './selectors';

/** Strip HTML tags from a string */
function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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
    return [];
  }

  /**
   * Phase 1: Run in content script on order list page.
   * Extracts invoice URLs + order metadata for each order card.
   */
  collectInvoiceUrls(doc: Document, cursorDate?: string): InvoiceRef[] {
    const S = ORDER_LIST_SELECTORS;
    const orderGroups = doc.querySelectorAll(S.ORDER_GROUP);
    const invoices: InvoiceRef[] = [];

    console.log(`[matcha] Amazon: found ${orderGroups.length} order groups`);

    for (const group of orderGroups) {
      try {
        const orderId = group.querySelector(S.ORDER_ID)?.textContent?.trim();
        if (!orderId) continue;

        let dateText: string | null = null;
        const headerItems = group.querySelectorAll(S.ORDER_HEADER_ITEM);
        for (const item of headerItems) {
          const label = item
            .querySelector('.a-text-caps')
            ?.textContent?.trim()
            ?.toLowerCase();
          if (label === 'order placed') {
            dateText =
              item
                .querySelector(
                  '.a-size-base.a-color-secondary:not(.a-text-caps)'
                )
                ?.textContent?.trim() ??
              item.querySelector('.aok-break-word')?.textContent?.trim() ??
              null;
            break;
          }
        }

        if (!dateText) continue;
        const orderDate = parseDate(dateText);
        if (!orderDate) continue;

        if (cursorDate) {
          const cutoff = new Date(cursorDate);
          if (orderDate < cutoff) continue;
        }

        const invoiceLink = group.querySelector(
          S.INVOICE_LINK
        ) as HTMLAnchorElement | null;
        if (!invoiceLink?.href) continue;

        const cleanOrderId = orderId.replace(/[^a-zA-Z0-9-]/g, '');
        console.log(
          `[matcha] Amazon: found invoice for order ${cleanOrderId}: ${invoiceLink.href}`
        );

        invoices.push({
          orderId: cleanOrderId,
          orderDate: orderDate.toISOString(),
          invoiceUrl: invoiceLink.href,
        });
      } catch {
        // Skip malformed order cards
      }
    }

    return invoices;
  }

  /**
   * Phase 2: Run in service worker after fetching invoice HTML.
   * Parses raw HTML with regex (no DOMParser in service workers).
   */
  parseInvoicePage(html: string, ref: InvoiceRef): ScrapedReceipt | null {
    // Strip scripts/styles to get cleaner text for pattern matching
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '');
    const text = stripTags(cleaned);

    // Debug: log a snippet of the cleaned text
    console.log(
      `[matcha] Amazon invoice ${ref.orderId} text (first 2000 chars):\n`,
      text.slice(0, 2000)
    );

    const items = this.parseInvoiceItems(cleaned);
    const totals = this.parseInvoiceTotals(text);

    console.log(`[matcha] Amazon invoice ${ref.orderId}:`, {
      items: items.length,
      ...totals,
    });

    return {
      retailer: this.retailerId,
      orderId: ref.orderId,
      orderDate: new Date(ref.orderDate),
      totalAmount: totals.grandTotal,
      tax: totals.tax || undefined,
      orderUrl: `https://www.amazon.com/gp/your-account/order-details?orderID=${ref.orderId}`,
      items,
      rawData: {
        subtotal: totals.subtotal,
        tax: totals.tax,
        shipping: totals.shipping,
        grandTotal: totals.grandTotal,
      },
    };
  }

  /**
   * Extract items from invoice HTML using regex.
   * Looks for product links (href containing /dp/ or /gp/product/) and
   * nearby price/quantity patterns.
   */
  private parseInvoiceItems(html: string): ScrapedItem[] {
    const items: ScrapedItem[] = [];
    const seen = new Set<string>();

    // Find product links with their surrounding context
    const linkPattern =
      /<a[^>]*href="[^"]*\/(?:dp|gp\/product)\/[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    while ((match = linkPattern.exec(html)) !== null) {
      const name = stripTags(match[1]);
      if (!name || name.length < 3 || seen.has(name)) continue;
      seen.add(name);

      // Grab surrounding context (500 chars after the link) for qty/price
      const contextStart = match.index;
      const context = html.slice(contextStart, contextStart + 1500);
      const contextText = stripTags(context);

      // Extract quantity
      const qtyMatch = contextText.match(/Qty\s*:\s*(\d+)/i);
      const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;

      // Extract prices from the context
      const prices = [...contextText.matchAll(/\$[\d,]+\.\d{2}/g)].map((m) =>
        parseCurrency(m[0])
      );

      const totalPrice = prices.length > 0 ? prices[prices.length - 1] : 0;
      const unitPrice =
        quantity > 1 && prices.length > 1 ? prices[0] : totalPrice;

      items.push({ name, quantity, unitPrice, totalPrice });
    }

    return items;
  }

  /**
   * Extract totals from the plain text of the invoice page.
   */
  private parseInvoiceTotals(text: string): {
    subtotal: number;
    tax: number;
    shipping: number;
    grandTotal: number;
  } {
    const extract = (pattern: RegExp): number => {
      const match = text.match(pattern);
      return match ? parseCurrency(match[1]) : 0;
    };

    const subtotal = extract(/Item(?:s)?\s+Subtotal\s*:?\s*(\$[\d,]+\.\d{2})/i);
    const shipping = extract(
      /Shipping\s+(?:&\s+Handling)?\s*:?\s*(\$[\d,]+\.\d{2})/i
    );
    const tax =
      extract(/(?:Estimated\s+)?Tax\s*:?\s*(\$[\d,]+\.\d{2})/i) ||
      extract(/Tax\s+Collected\s*:?\s*(\$[\d,]+\.\d{2})/i);
    const grandTotal =
      extract(/Grand\s+Total\s*:?\s*(\$[\d,]+\.\d{2})/i) ||
      extract(/Order\s+Total\s*:?\s*(\$[\d,]+\.\d{2})/i);

    return { subtotal, tax, shipping, grandTotal };
  }
}
