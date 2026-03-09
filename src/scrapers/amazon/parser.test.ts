import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  parseInvoiceItemsHtml,
  parseInvoiceItemsText,
  parseInvoicePage,
  type InvoiceRef,
} from './parser';
import { FIXTURE_INVOICE_20260309 } from './fixtures/index';

const REF: InvoiceRef = {
  orderId: '123-4567890-1234567',
  orderDate: '2024-06-15T00:00:00.000Z',
  invoiceUrl: 'https://www.amazon.com/gp/css/summary/print.html?orderID=123',
};

// ─── parseInvoiceItemsHtml ──────────────────────────────────────────────────

describe('parseInvoiceItemsHtml', () => {
  it('extracts items from /dp/ links with a-offscreen prices', () => {
    const html = `
      <a href="/dp/B08N5WRWNW/ref=abc">Echo Dot (4th Gen)</a>
      <span class="a-offscreen">$49.99</span>
    `;
    const items = parseInvoiceItemsHtml(html);
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Echo Dot (4th Gen)');
    expect(items[0].unitPrice).toBe(49.99);
    expect(items[0].totalPrice).toBe(49.99);
    expect(items[0].quantity).toBe(1);
  });

  it('extracts multiple items', () => {
    const html = `
      <a href="/dp/B001">Widget Alpha</a>
      <span class="a-offscreen">$9.99</span>
      <a href="/dp/B002">Widget Beta</a>
      <span class="a-offscreen">$14.99</span>
    `;
    const items = parseInvoiceItemsHtml(html);
    expect(items).toHaveLength(2);
    expect(items[0].name).toBe('Widget Alpha');
    expect(items[1].name).toBe('Widget Beta');
  });

  it('deduplicates items with the same name', () => {
    const html = `
      <a href="/dp/B001">Widget Alpha</a>
      <span class="a-offscreen">$9.99</span>
      <a href="/dp/B002">Widget Alpha</a>
      <span class="a-offscreen">$9.99</span>
    `;
    const items = parseInvoiceItemsHtml(html);
    expect(items).toHaveLength(1);
  });

  it('skips items with names shorter than 3 characters', () => {
    const html = `<a href="/dp/B001">AB</a><span class="a-offscreen">$5.00</span>`;
    expect(parseInvoiceItemsHtml(html)).toHaveLength(0);
  });

  it('skips links without a nearby offscreen price', () => {
    const html = `<a href="/dp/B001">Real Product Name</a>`;
    expect(parseInvoiceItemsHtml(html)).toHaveLength(0);
  });

  it('strips HTML tags from item names', () => {
    const html = `
      <a href="/dp/B001">
        <span><img alt="">Echo Dot</span>
      </a>
      <span class="a-offscreen">$49.99</span>
    `;
    const items = parseInvoiceItemsHtml(html);
    expect(items[0].name).toBe('Echo Dot');
  });

  it('handles commas in prices', () => {
    const html = `
      <a href="/dp/B001">Expensive Item</a>
      <span class="a-offscreen">$1,299.99</span>
    `;
    const items = parseInvoiceItemsHtml(html);
    expect(items[0].unitPrice).toBe(1299.99);
  });
});

// ─── parseInvoiceItemsText ──────────────────────────────────────────────────

describe('parseInvoiceItemsText', () => {
  it('extracts items split by "Sold by:" marker', () => {
    const text = `Delivered January 10. Echo DotSold by: Amazon.com $49.99 $49.99`;
    const items = parseInvoiceItemsText(text);
    expect(items).toHaveLength(1);
    expect(items[0].totalPrice).toBe(49.99);
  });

  it('uses last price as totalPrice when one price present', () => {
    const text = `Delivered. Widget ABCSold by: Seller $14.99`;
    const items = parseInvoiceItemsText(text);
    expect(items[0].totalPrice).toBe(14.99);
    expect(items[0].unitPrice).toBe(14.99);
  });

  it('uses first price as unitPrice and last as totalPrice when two prices present', () => {
    const text = `Delivered. Big Widget PackSold by: Seller $9.99 $19.98`;
    const items = parseInvoiceItemsText(text);
    expect(items[0].unitPrice).toBe(9.99);
    expect(items[0].totalPrice).toBe(19.98);
  });

  it('skips chunks with no prices after "Sold by:"', () => {
    const text = `Delivered. Some ProductSold by: Seller no prices here`;
    expect(parseInvoiceItemsText(text)).toHaveLength(0);
  });

  it('deduplicates items with the same name', () => {
    const text = `Delivered. Same ItemSold by: Seller $9.99\nDelivered. Same ItemSold by: Seller $9.99`;
    const items = parseInvoiceItemsText(text);
    expect(items).toHaveLength(1);
  });

  it('sets quantity to 1', () => {
    const text = `Delivered. My ProductSold by: Seller $9.99`;
    const items = parseInvoiceItemsText(text);
    expect(items[0].quantity).toBe(1);
  });
});

// ─── parseInvoicePage ──────────────────────────────────────────────────────

describe('parseInvoicePage', () => {
  it('extracts grand total from text', () => {
    const receipt = parseInvoicePage('Grand Total: $97.18', REF);
    expect(receipt?.totalAmount).toBe(97.18);
  });

  it('falls back to Order Total if no Grand Total present', () => {
    const receipt = parseInvoicePage('Order Total: $55.00', REF);
    expect(receipt?.totalAmount).toBe(55.0);
  });

  it('extracts subtotal, tax, and shipping', () => {
    const html = `
      Items Subtotal: $89.98
      Shipping & Handling: $5.99
      Estimated tax to be collected: $7.20
      Grand Total: $103.17
    `;
    const receipt = parseInvoicePage(html, REF);
    expect(receipt?.tax).toBe(7.2);
    expect(receipt?.rawData).toMatchObject({
      subtotal: 89.98,
      shipping: 5.99,
      grandTotal: 103.17,
    });
  });

  it('extracts "Tax Collected" variant', () => {
    const html = `Tax Collected: $4.50\nGrand Total: $54.50`;
    const receipt = parseInvoicePage(html, REF);
    expect(receipt?.tax).toBe(4.5);
  });

  it('strips script and style tags before parsing totals', () => {
    const html = `
      <script>var x = "Grand Total: $999.99";</script>
      <style>.price::before { content: "Grand Total: $000.00" }</style>
      Grand Total: $50.00
    `;
    const receipt = parseInvoicePage(html, REF);
    expect(receipt?.totalAmount).toBe(50.0);
  });

  it('sets retailer to "amazon"', () => {
    const receipt = parseInvoicePage('Grand Total: $10.00', REF);
    expect(receipt?.retailer).toBe('amazon');
  });

  it('sets orderId from ref', () => {
    const receipt = parseInvoicePage('Grand Total: $10.00', REF);
    expect(receipt?.orderId).toBe(REF.orderId);
  });

  it('sets orderUrl to include orderId', () => {
    const receipt = parseInvoicePage('Grand Total: $10.00', REF);
    expect(receipt?.orderUrl).toContain(REF.orderId);
  });

  it('sets orderDate from ref', () => {
    const receipt = parseInvoicePage('Grand Total: $10.00', REF);
    expect(receipt?.orderDate).toEqual(new Date(REF.orderDate));
  });

  it('uses HTML item parsing when /dp/ links present', () => {
    const html = `
      <a href="/dp/B001">Widget Name</a>
      <span class="a-offscreen">$9.99</span>
      Sold by: Seller Widget Name $9.99
      Grand Total: $9.99
    `;
    const receipt = parseInvoicePage(html, REF);
    expect(receipt?.items).toHaveLength(1);
    expect(receipt?.items[0].name).toBe('Widget Name');
  });

  it('falls back to text parsing when no HTML items found', () => {
    const html = `
      Delivered January 10. My ProductSold by: Some Seller $29.99
      Grand Total: $29.99
    `;
    const receipt = parseInvoicePage(html, REF);
    expect(receipt?.items).toHaveLength(1);
    expect(receipt?.items[0].totalPrice).toBe(29.99);
  });

  it('returns tax as undefined when no tax found', () => {
    const receipt = parseInvoicePage('Grand Total: $10.00', REF);
    expect(receipt?.tax).toBeUndefined();
  });
});

// ─── Fixture: Invoice detail (20260309.html) ────────────────────────────────
// Page: GET /gp/css/summary/print.html?orderID={id}
// Parser: parseInvoicePage(html, ref)

describe(`parseInvoicePage — fixture ${FIXTURE_INVOICE_20260309.file}`, () => {
  const html = readFileSync(
    join(__dirname, 'fixtures', FIXTURE_INVOICE_20260309.file),
    'utf-8'
  );
  const receipt = parseInvoicePage(html, FIXTURE_INVOICE_20260309.ref);
  const expected = FIXTURE_INVOICE_20260309.expected;

  it('parses without throwing', () => {
    expect(receipt).not.toBeNull();
  });

  it('extracts correct number of items', () => {
    expect(receipt!.items).toHaveLength(expected.items.length);
  });

  it('item names match expected', () => {
    for (let i = 0; i < expected.items.length; i++) {
      expect(receipt!.items[i].name).toBe(expected.items[i].name);
    }
  });

  it('item prices match expected', () => {
    for (let i = 0; i < expected.items.length; i++) {
      expect(receipt!.items[i].totalPrice).toBeCloseTo(expected.items[i].totalPrice, 2);
    }
  });

  it('grand total matches expected', () => {
    expect(receipt!.totalAmount).toBeCloseTo(expected.totalAmount, 2);
  });

  it('tax matches expected', () => {
    expect(receipt!.tax).toBeCloseTo(expected.tax, 2);
  });

  it('page method is GET', () => {
    expect(FIXTURE_INVOICE_20260309.page.method).toBe('GET');
  });
});
