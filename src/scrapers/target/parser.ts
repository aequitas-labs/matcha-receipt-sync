import { computeEffectivePrices } from '../../utils/effectivePrice';
import type { ScrapedItem } from '../../types/scraper';

export interface TargetOrderLine {
  description: string;
  quantity: number;
  unit_price: number;
  effective_amount: number;
  sub_total: number;
  total_tax: number;
  item: { tcin: string; description: string };
  charges?: Array<{ type: string; name: string; value: number }>;
}

export interface TargetStoreOrderLine {
  quantity: number;
  item: {
    description: string;
    unit_price: string;
    list_price: string;
    dpci?: string;
  };
}

/** Normalize DPCI "206-06-7033" → "206067033" (strip dashes) */
export function normalizeDpci(dpci: string): string {
  return dpci.replace(/-/g, '');
}

export function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCharCode(parseInt(code, 16))
    )
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&trade;/g, '\u2122')
    .replace(/&reg;/g, '\u00AE');
}

export function mapTargetInvoiceLines(lines: TargetOrderLine[]): {
  items: ScrapedItem[];
  tax: number;
} {
  const items: ScrapedItem[] = lines.map((line) => {
    const qty = line.quantity || undefined;
    const subTotal =
      parseFloat(String(line.effective_amount || line.sub_total)) || 0;
    const lineTax = parseFloat(String(line.total_tax)) || 0;
    const unitPrice =
      qty && qty > 0
        ? Math.round((subTotal / qty) * 100) / 100
        : parseFloat(String(line.unit_price)) || undefined;
    // Effective price is exact per-item: post-discount amount + item's own tax
    const effectivePrice = qty
      ? Math.round(((subTotal + lineTax) / qty) * 10000) / 10000
      : undefined;
    return {
      name: decodeHtmlEntities(
        line.item?.description || line.description || ''
      ),
      quantity: qty,
      unitPrice,
      totalPrice: subTotal,
      effectivePrice,
    };
  });

  const tax = lines.reduce(
    (sum, line) => sum + (parseFloat(String(line.total_tax)) || 0),
    0
  );

  return { items, tax: Math.round(tax * 100) / 100 };
}

export interface TargetStoreTotals {
  total: number;
  tax: number;
}

export function mapTargetStoreLines(
  orderLines: TargetStoreOrderLine[],
  totals: TargetStoreTotals,
  options?: { taxable?: boolean[] }
): ScrapedItem[] {
  const items: ScrapedItem[] = orderLines.map((line) => {
    const qty = line.quantity || undefined;
    const unitPrice = parseFloat(line.item.unit_price) || undefined;
    return {
      name: decodeHtmlEntities(line.item.description),
      quantity: qty,
      unitPrice,
      totalPrice:
        unitPrice != null && qty != null
          ? Math.round(unitPrice * qty * 100) / 100
          : unitPrice ?? 0,
    };
  });
  return computeEffectivePrices(items, totals.total, {
    tax: totals.tax,
    ...(options?.taxable ? { taxable: options.taxable } : {}),
  });
}

export interface TargetReceiptHtmlItem {
  dpci: string;
  name: string;
  taxFlag: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface TargetReceiptHtmlResult {
  items: TargetReceiptHtmlItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

/**
 * Parse the HTML receipt returned by POST /receipts/v1/invoice
 * { receipt_name, receipt_id, printer_type: "html" }.
 *
 * The receipt is a narrow 3-inch thermal receipt layout. Item rows look like:
 *   <td><div>206067033</div></td><td><div>Carter's JOY</div></td>
 *   <td><div>T</div></td><td><div>$20.00&nbsp;</div></td><td>&nbsp;</td>
 * with optional quantity sub-rows:
 *   <td><div>2 @ $4.99 ea</div></td>
 * Tax rows use the format: "T = MD TAX 6.00000 on $49.08" in one cell,
 * followed by the actual tax amount "$2.95" in the next cell.
 */
export function parseTargetReceiptHtml(html: string): TargetReceiptHtmlResult {
  const items: TargetReceiptHtmlItem[] = [];

  // Each item row: DPCI inside div inside td, then name, tax-flag, price (5 tds total)
  const itemRowPattern =
    /<td[^>]*>\s*<div[^>]*>\s*(\d{9})\s*<\/div>\s*<\/td><td[^>]*><div[^>]*>([\s\S]*?)<\/div><\/td><td[^>]*>[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>[\s\S]*?<\/td><td[^>]*><div[^>]*>\$([\d,]+\.\d{2})&nbsp;<\/div><\/td>/gi;

  // Quantity sub-row within the segment between two items: "2 @ $4.99 ea"
  const qtySubRowPattern = /(\d+)\s*@\s*\$([\d,]+\.\d{2})\s*ea?/i;

  const rawItems: Array<{
    dpci: string;
    name: string;
    taxFlag: string;
    totalPrice: number;
    index: number;
  }> = [];
  let m: RegExpExecArray | null;
  while ((m = itemRowPattern.exec(html)) !== null) {
    rawItems.push({
      dpci: m[1],
      name: m[2].trim(),
      taxFlag: m[3].trim(),
      totalPrice: parseFloat(m[4].replace(/,/g, '')),
      index: m.index,
    });
  }

  // For each raw item, look ahead to the next item for a qty sub-row
  for (let i = 0; i < rawItems.length; i++) {
    const start = rawItems[i].index;
    const end = i + 1 < rawItems.length ? rawItems[i + 1].index : html.length;
    const segment = html.slice(start, end);

    const qtyMatch = qtySubRowPattern.exec(segment);
    const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
    const unitPrice = qtyMatch
      ? parseFloat(qtyMatch[2].replace(/,/g, ''))
      : rawItems[i].totalPrice;

    items.push({
      dpci: rawItems[i].dpci,
      name: rawItems[i].name,
      taxFlag: rawItems[i].taxFlag,
      quantity,
      unitPrice,
      totalPrice: rawItems[i].totalPrice,
    });
  }

  // Extract summary dollar amounts
  const extractSummary = (labelPattern: RegExp): number => {
    const match = html.match(labelPattern);
    return match ? parseFloat(match[1].replace(/,/g, '')) : 0;
  };

  const subtotal = extractSummary(/SUBTOTAL[\s\S]*?\$([\d,]+\.\d{2})/i);
  // Discount row has label like "$15 offStorewide", then amount, then a "-" cell
  const discount = extractSummary(
    /off[^<]*<\/div>[\s\S]{0,200}\$([\d,]+\.\d{2})&nbsp/i
  );
  // Tax: "T = ... TAX ... on $X.XX" in one cell, "$Y.YY" in the next cell
  const tax = extractSummary(
    /T\s*=\s*\w+\s*TAX[\s\S]*?>\$([\d,]+\.\d{2})&nbsp;/i
  );
  const total = extractSummary(/>TOTAL<[\s\S]*?\$([\d,]+\.\d{2})/i);

  return { items, subtotal, discount, tax, total };
}
