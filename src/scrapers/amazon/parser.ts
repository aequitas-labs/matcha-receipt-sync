import { parseCurrency } from '../../utils/currency';
import { computeEffectivePrices } from '../../utils/effectivePrice';
import type { ScrapedReceipt, ScrapedItem } from '../../types/scraper';

export interface InvoiceRef {
  orderId: string;
  orderDate: string;
  invoiceUrl: string;
}

export function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseInvoiceItemsHtml(html: string): ScrapedItem[] {
  const items: ScrapedItem[] = [];
  const seen = new Set<string>();
  const linkPattern = /<a[^>]*href="\/dp\/[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  let linkMatch;
  while ((linkMatch = linkPattern.exec(html)) !== null) {
    const name = stripTags(linkMatch[1]).trim();
    if (!name || name.length < 3 || seen.has(name)) continue;
    const after = html.slice(linkMatch.index, linkMatch.index + 5000);
    const priceMatch = after.match(
      /class="a-offscreen">\s*\$([\d,]+\.\d{2})\s*</
    );
    if (!priceMatch) continue;
    seen.add(name);
    const price = parseCurrency('$' + priceMatch[1]);
    items.push({ name, totalPrice: price });
  }
  return items;
}

export function parseInvoiceItemsText(text: string): ScrapedItem[] {
  const items: ScrapedItem[] = [];
  const seen = new Set<string>();
  const chunks = text.split(/Sold by:/i);
  for (let i = 0; i < chunks.length - 1; i++) {
    const beforeSoldBy = chunks[i];
    const afterSoldBy = chunks[i + 1];
    const priceMatches = [...afterSoldBy.matchAll(/\$[\d,]+\.\d{2}/g)];
    if (priceMatches.length === 0) continue;
    const prices = priceMatches.slice(0, 2).map((m) => parseCurrency(m[0]));
    const nameMatch = beforeSoldBy.match(
      /(?:Delivered[^.]*\.\s*|door or porch\.\s*|front door\.\s*|Your package[^.]*\.\s*|Eligible through [A-Z][a-z]+ \d+, \d{4}\s+)(.+?)$/i
    );
    let name: string;
    if (nameMatch) {
      name = nameMatch[1].trim();
    } else {
      const parts = beforeSoldBy.trim().split(/\s{2,}/);
      name = parts[parts.length - 1]?.trim() || '';
    }
    name = name.replace(/^\d+\s+/, '').trim();
    if (!name || name.length < 3 || seen.has(name)) continue;
    seen.add(name);
    const totalPrice = prices[prices.length - 1];
    const unitPrice = prices.length >= 2 ? prices[0] : undefined;
    items.push({ name, unitPrice, totalPrice });
  }
  return items;
}

export function parseInvoicePage(
  html: string,
  ref: InvoiceRef
): ScrapedReceipt | null {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
  const text = stripTags(cleaned);

  const htmlItems = parseInvoiceItemsHtml(cleaned);
  const items = htmlItems.length > 0 ? htmlItems : parseInvoiceItemsText(text);

  const extract = (pattern: RegExp): number => {
    const m = text.match(pattern);
    return m ? parseCurrency(m[1]) : 0;
  };
  const subtotal = extract(/Item(?:s)?\s+Subtotal\s*:?\s*(\$[\d,]+\.\d{2})/i);
  const shipping = extract(
    /Shipping\s+(?:&\s+Handling)?\s*:?\s*(\$[\d,]+\.\d{2})/i
  );
  const tax =
    extract(
      /Estimated\s+tax\s+to\s+be\s+collected\s*:?\s*(\$[\d,]+\.\d{2})/i
    ) ||
    extract(/Tax\s+Collected\s*:?\s*(\$[\d,]+\.\d{2})/i) ||
    extract(/(?:^|[\s.])Tax\s*:?\s*(\$[\d,]+\.\d{2})/i);
  const grandTotal =
    extract(/Grand\s+Total\s*:?\s*(\$[\d,]+\.\d{2})/i) ||
    extract(/Order\s+Total\s*:?\s*(\$[\d,]+\.\d{2})/i);

  const itemsWithEffective = computeEffectivePrices(items, grandTotal, {
    tax: tax || undefined,
  });

  return {
    retailer: 'amazon',
    orderId: ref.orderId,
    orderDate: new Date(ref.orderDate),
    totalAmount: grandTotal,
    tax: tax || undefined,
    orderUrl: `https://www.amazon.com/gp/your-account/order-details?orderID=${ref.orderId}`,
    items: itemsWithEffective,
    rawData: { subtotal, tax, shipping, grandTotal },
  };
}
