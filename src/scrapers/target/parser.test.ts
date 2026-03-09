import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  decodeHtmlEntities,
  mapTargetInvoiceLines,
  mapTargetStoreLines,
  parseTargetReceiptHtml,
  type TargetOrderLine,
  type TargetStoreOrderLine,
} from './parser';
import {
  FIXTURE_ONLINE_20260309,
  FIXTURE_STORE_JSON_20260309,
  FIXTURE_STORE_HTML_20260309,
  FIXTURE_ONLINE_ORDER_HISTORY_20260309,
  FIXTURE_STORE_ORDER_HISTORY_20260309,
  FIXTURE_ONLINE_INVOICES_20260309,
} from './fixtures/index';

// ─── decodeHtmlEntities ──────────────────────────────────────────────────────

describe('decodeHtmlEntities', () => {
  it('decodes &amp;', () => {
    expect(decodeHtmlEntities('Rock &amp; Roll')).toBe('Rock & Roll');
  });

  it('decodes &lt; and &gt;', () => {
    expect(decodeHtmlEntities('&lt;h1&gt;')).toBe('<h1>');
  });

  it('decodes &quot;', () => {
    expect(decodeHtmlEntities('say &quot;hi&quot;')).toBe('say "hi"');
  });

  it('decodes &#39; as single quote', () => {
    expect(decodeHtmlEntities("can&#39;t")).toBe("can't");
  });

  it('decodes numeric decimal entities', () => {
    expect(decodeHtmlEntities('&#65;')).toBe('A');
    expect(decodeHtmlEntities('&#169;')).toBe('\u00A9'); // copyright
  });

  it('decodes numeric hex entities', () => {
    expect(decodeHtmlEntities('&#xAE;')).toBe('\u00AE'); // registered trademark
    expect(decodeHtmlEntities('&#x41;')).toBe('A');
  });

  it('decodes &trade;', () => {
    expect(decodeHtmlEntities('Nike&trade;')).toBe('Nike\u2122');
  });

  it('decodes &reg;', () => {
    expect(decodeHtmlEntities('Target&reg;')).toBe('Target\u00AE');
  });

  it('passes through plain strings unchanged', () => {
    expect(decodeHtmlEntities('Up & Up Vitamins')).toBe('Up & Up Vitamins');
  });

  it('handles empty string', () => {
    expect(decodeHtmlEntities('')).toBe('');
  });

  it('handles multiple entities in one string', () => {
    expect(decodeHtmlEntities('&lt;b&gt;Hello &amp; World&lt;/b&gt;')).toBe(
      '<b>Hello & World</b>'
    );
  });
});

// ─── mapTargetInvoiceLines ───────────────────────────────────────────────────

describe('mapTargetInvoiceLines', () => {
  const makeLine = (overrides: Partial<TargetOrderLine> = {}): TargetOrderLine => ({
    description: 'Default Item',
    quantity: 1,
    unit_price: 9.99,
    effective_amount: 9.99,
    sub_total: 9.99,
    total_tax: 0.80,
    item: { tcin: '00001', description: 'Default Item' },
    ...overrides,
  });

  it('extracts items with correct prices', () => {
    const lines = [
      makeLine({
        quantity: 2,
        effective_amount: 19.98,
        sub_total: 19.98,
        total_tax: 1.6,
        item: { tcin: '12345', description: 'Up&amp;Up Vitamins' },
      }),
    ];
    const { items, tax } = mapTargetInvoiceLines(lines);
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Up&Up Vitamins'); // entity decoded
    expect(items[0].quantity).toBe(2);
    expect(items[0].totalPrice).toBeCloseTo(19.98, 2);
    expect(items[0].unitPrice).toBeCloseTo(9.99, 2);
    expect(tax).toBeCloseTo(1.6, 2);
  });

  it('prefers effective_amount over sub_total', () => {
    const lines = [
      makeLine({
        effective_amount: 8.0, // sale price
        sub_total: 10.0,
      }),
    ];
    const { items } = mapTargetInvoiceLines(lines);
    expect(items[0].totalPrice).toBe(8.0);
  });

  it('uses sub_total when effective_amount is 0', () => {
    const lines = [makeLine({ effective_amount: 0, sub_total: 10.0 })];
    const { items } = mapTargetInvoiceLines(lines);
    expect(items[0].totalPrice).toBe(10.0);
  });

  it('accumulates tax across multiple lines', () => {
    const lines = [
      makeLine({ total_tax: 0.8 }),
      makeLine({ description: 'B', total_tax: 0.4, item: { tcin: '2', description: 'B' } }),
    ];
    const { tax } = mapTargetInvoiceLines(lines);
    expect(tax).toBeCloseTo(1.2, 2);
  });

  it('returns tax=0 when no tax on any line', () => {
    const lines = [makeLine({ total_tax: 0 })];
    const { tax } = mapTargetInvoiceLines(lines);
    expect(tax).toBe(0);
  });

  it('defaults quantity to 1 when missing', () => {
    const lines = [makeLine({ quantity: 0 })];
    const { items } = mapTargetInvoiceLines(lines);
    expect(items[0].quantity).toBe(1);
  });

  it('handles empty lines array', () => {
    const { items, tax } = mapTargetInvoiceLines([]);
    expect(items).toHaveLength(0);
    expect(tax).toBe(0);
  });

  it('uses item.description for name', () => {
    const lines = [
      makeLine({
        description: 'fallback',
        item: { tcin: '1', description: 'Preferred Name' },
      }),
    ];
    const { items } = mapTargetInvoiceLines(lines);
    expect(items[0].name).toBe('Preferred Name');
  });

  it('falls back to line description when item.description is empty', () => {
    const lines = [
      makeLine({
        description: 'Line Description',
        item: { tcin: '1', description: '' },
      }),
    ];
    const { items } = mapTargetInvoiceLines(lines);
    expect(items[0].name).toBe('Line Description');
  });
});

// ─── mapTargetStoreLines ─────────────────────────────────────────────────────

describe('mapTargetStoreLines', () => {
  const makeLine = (overrides: Partial<TargetStoreOrderLine> = {}): TargetStoreOrderLine => ({
    quantity: 1,
    item: { description: 'Store Item', unit_price: '9.99', list_price: '9.99' },
    ...overrides,
  });

  it('parses unit_price string correctly', () => {
    const items = mapTargetStoreLines([makeLine()]);
    expect(items[0].unitPrice).toBe(9.99);
  });

  it('calculates totalPrice as unitPrice * qty rounded to 2dp', () => {
    const items = mapTargetStoreLines([
      makeLine({ quantity: 3, item: { description: 'Item', unit_price: '3.33', list_price: '3.33' } }),
    ]);
    expect(items[0].totalPrice).toBe(9.99); // 3 * 3.33 = 9.99
  });

  it('decodes HTML entities in description', () => {
    const items = mapTargetStoreLines([
      makeLine({ item: { description: 'Up&amp;Up', unit_price: '5.00', list_price: '5.00' } }),
    ]);
    expect(items[0].name).toBe('Up&Up');
  });

  it('defaults quantity to 1 when 0', () => {
    const items = mapTargetStoreLines([makeLine({ quantity: 0 })]);
    expect(items[0].quantity).toBe(1);
  });

  it('returns 0 for unparseable unit_price', () => {
    const items = mapTargetStoreLines([
      makeLine({ item: { description: 'Item', unit_price: 'N/A', list_price: '' } }),
    ]);
    expect(items[0].unitPrice).toBe(0);
  });

  it('handles empty array', () => {
    expect(mapTargetStoreLines([])).toHaveLength(0);
  });
});

// ─── Fixture: ONLINE invoice (20260309-online.json) ──────────────────────────
// API: GET /post_order_invoices/v1/orders/{orderId}/invoices/{invoiceId}
// Parser: mapTargetInvoiceLines(data.lines)

describe(`mapTargetInvoiceLines — fixture ${FIXTURE_ONLINE_20260309.file}`, () => {
  const data = JSON.parse(
    readFileSync(join(__dirname, 'fixtures', FIXTURE_ONLINE_20260309.file), 'utf-8')
  );
  const lines: TargetOrderLine[] = data.lines || data.order_lines || [];
  const { items, tax } = mapTargetInvoiceLines(lines);
  const expected = FIXTURE_ONLINE_20260309.expected;

  it('extracts the correct number of items', () => {
    expect(items).toHaveLength(expected.items.length);
  });

  it('item names match expected', () => {
    for (let i = 0; i < expected.items.length; i++) {
      expect(items[i].name).toBe(expected.items[i].name);
    }
  });

  it('item quantities match expected', () => {
    for (let i = 0; i < expected.items.length; i++) {
      expect(items[i].quantity).toBe(expected.items[i].quantity);
    }
  });

  it('item prices match expected (effective_amount used when discounted)', () => {
    for (let i = 0; i < expected.items.length; i++) {
      expect(items[i].totalPrice).toBeCloseTo(expected.items[i].totalPrice, 2);
    }
  });

  it('tax matches expected', () => {
    expect(tax).toBeCloseTo(expected.tax, 2);
  });

  it('API call is GET', () => {
    expect(FIXTURE_ONLINE_20260309.api.method).toBe('GET');
  });
});

// ─── Fixture: STORE order detail JSON (20260309-store.json) ──────────────────
// API: GET /guest_order_aggregations/v1/{storeReceiptId}/store_order_details
// Parser: mapTargetStoreLines(data.order_lines)

describe(`mapTargetStoreLines — fixture ${FIXTURE_STORE_JSON_20260309.file}`, () => {
  const data = JSON.parse(
    readFileSync(join(__dirname, 'fixtures', FIXTURE_STORE_JSON_20260309.file), 'utf-8')
  );
  const orderLines: TargetStoreOrderLine[] = data.order_lines || [];
  const items = mapTargetStoreLines(orderLines);
  const expected = FIXTURE_STORE_JSON_20260309.expected;

  it('extracts the correct number of items', () => {
    expect(items).toHaveLength(expected.items.length);
  });

  it('item names are decoded (HTML entities + trademark symbols)', () => {
    for (let i = 0; i < expected.items.length; i++) {
      expect(items[i].name).toBe(expected.items[i].name);
    }
  });

  it('item quantities match expected', () => {
    for (let i = 0; i < expected.items.length; i++) {
      expect(items[i].quantity).toBe(expected.items[i].quantity);
    }
  });

  it('item prices match expected (unit_price string parsed correctly)', () => {
    for (let i = 0; i < expected.items.length; i++) {
      expect(items[i].totalPrice).toBeCloseTo(expected.items[i].totalPrice, 2);
    }
  });

  it('store metadata accessible from fixture (tax, total, storeName)', () => {
    const tax = parseFloat(data.summary?.total_taxes) || 0;
    const total = parseFloat(data.summary?.grand_total) || 0;
    const storeName = data.address?.[0]?.first_name;
    expect(tax).toBeCloseTo(expected.tax, 2);
    expect(total).toBeCloseTo(expected.total, 2);
    expect(storeName).toBe(expected.storeName);
  });

  it('API call is GET', () => {
    expect(FIXTURE_STORE_JSON_20260309.api.method).toBe('GET');
  });
});

// ─── Fixture: STORE HTML receipt (20260309-store.html) ───────────────────────
// API: POST /receipts/v1/invoice { receipt_name, receipt_id, printer_type: "html" }
// Parser: parseTargetReceiptHtml(html)

describe(`parseTargetReceiptHtml — fixture ${FIXTURE_STORE_HTML_20260309.file}`, () => {
  const html = readFileSync(
    join(__dirname, 'fixtures', FIXTURE_STORE_HTML_20260309.file),
    'utf-8'
  );
  const result = parseTargetReceiptHtml(html);
  const expected = FIXTURE_STORE_HTML_20260309.expected;

  it('extracts the correct number of items', () => {
    expect(result.items).toHaveLength(expected.items.length);
  });

  it('DPCI codes match expected', () => {
    for (let i = 0; i < expected.items.length; i++) {
      expect(result.items[i].dpci).toBe(expected.items[i].dpci);
    }
  });

  it('item names match expected', () => {
    for (let i = 0; i < expected.items.length; i++) {
      expect(result.items[i].name).toBe(expected.items[i].name);
    }
  });

  it('quantities are correct (including multi-qty items)', () => {
    for (let i = 0; i < expected.items.length; i++) {
      expect(result.items[i].quantity).toBe(expected.items[i].quantity);
    }
  });

  it('item total prices match expected', () => {
    for (let i = 0; i < expected.items.length; i++) {
      expect(result.items[i].totalPrice).toBeCloseTo(expected.items[i].totalPrice, 2);
    }
  });

  it('subtotal matches expected', () => {
    expect(result.subtotal).toBeCloseTo(expected.subtotal, 2);
  });

  it('discount amount matches expected', () => {
    expect(result.discount).toBeCloseTo(expected.discount, 2);
  });

  it('tax matches expected', () => {
    expect(result.tax).toBeCloseTo(expected.tax, 2);
  });

  it('total matches expected', () => {
    expect(result.total).toBeCloseTo(expected.total, 2);
  });

  it('API call is POST with receipt_id matching store_receipt_id', () => {
    expect(FIXTURE_STORE_HTML_20260309.api.method).toBe('POST');
    // receipt_id is the store_receipt_id with hyphens removed
    const storeData = JSON.parse(
      readFileSync(join(__dirname, 'fixtures', FIXTURE_STORE_JSON_20260309.file), 'utf-8')
    );
    const receiptIdNormalized = storeData.store_receipt_id.replace(/-/g, '');
    expect(FIXTURE_STORE_HTML_20260309.api.body.receipt_id).toBe(receiptIdNormalized);
  });
});

// ─── Fixture: ONLINE order history (20260309-online-order-history.json) ──────
// API: GET /guest_order_aggregations/v1/order_history?order_purchase_type=ONLINE

describe(`order history — fixture ${FIXTURE_ONLINE_ORDER_HISTORY_20260309.file}`, () => {
  const data = JSON.parse(
    readFileSync(join(__dirname, 'fixtures', FIXTURE_ONLINE_ORDER_HISTORY_20260309.file), 'utf-8')
  );
  const expected = FIXTURE_ONLINE_ORDER_HISTORY_20260309.expected;

  it('total_orders matches expected', () => {
    expect(data.total_orders).toBe(expected.totalOrders);
  });

  it('total_pages matches expected', () => {
    expect(data.total_pages).toBe(expected.totalPages);
  });

  it('first order fields match expected', () => {
    const o = data.orders[0];
    expect(o.placed_date).toBe(expected.firstOrder.placed_date);
    expect(o.order_purchase_type).toBe(expected.firstOrder.order_purchase_type);
    expect(o.summary.grand_total).toBe(expected.firstOrder.grand_total);
    expect(o.order_number).toBe(expected.firstOrder.order_number);
  });

  it('API call is GET', () => {
    expect(FIXTURE_ONLINE_ORDER_HISTORY_20260309.api.method).toBe('GET');
  });
});

// ─── Fixture: STORE order history (20260309-store-order-history.json) ─────────
// API: GET /guest_order_aggregations/v1/order_history?order_purchase_type=STORE

describe(`order history — fixture ${FIXTURE_STORE_ORDER_HISTORY_20260309.file}`, () => {
  const data = JSON.parse(
    readFileSync(join(__dirname, 'fixtures', FIXTURE_STORE_ORDER_HISTORY_20260309.file), 'utf-8')
  );
  const expected = FIXTURE_STORE_ORDER_HISTORY_20260309.expected;

  it('total_orders matches expected', () => {
    expect(data.total_orders).toBe(expected.totalOrders);
  });

  it('total_pages matches expected', () => {
    expect(data.total_pages).toBe(expected.totalPages);
  });

  it('first order is a STORE order with store_receipt_id', () => {
    const o = data.orders[0];
    expect(o.placed_date).toBe(expected.firstOrder.placed_date);
    expect(o.order_purchase_type).toBe(expected.firstOrder.order_purchase_type);
    expect(o.summary.grand_total).toBe(expected.firstOrder.grand_total);
    expect(o.store_receipt_id).toBe(expected.firstOrder.store_receipt_id);
  });

  it('API call is GET', () => {
    expect(FIXTURE_STORE_ORDER_HISTORY_20260309.api.method).toBe('GET');
  });
});

// ─── Fixture: ONLINE invoices list (20260309-online-invoices.json) ────────────
// API: GET /post_order_invoices/v1/orders/{orderId}/invoices

describe(`invoices list — fixture ${FIXTURE_ONLINE_INVOICES_20260309.file}`, () => {
  const data = JSON.parse(
    readFileSync(join(__dirname, 'fixtures', FIXTURE_ONLINE_INVOICES_20260309.file), 'utf-8')
  );
  const expected = FIXTURE_ONLINE_INVOICES_20260309.expected;

  it('returns the correct number of invoices', () => {
    expect(data.invoices).toHaveLength(expected.invoiceCount);
  });

  it('first invoice matches expected id, type, and amount', () => {
    const inv = data.invoices[0];
    expect(inv.id).toBe(expected.firstInvoice.id);
    expect(inv.type).toBe(expected.firstInvoice.type);
    expect(inv.amount).toBeCloseTo(expected.firstInvoice.amount, 2);
  });

  it('invoice id links to order_number from order history', () => {
    // The invoice URL uses the order_number from the order history response
    const onlineHistory = JSON.parse(
      readFileSync(join(__dirname, 'fixtures', FIXTURE_ONLINE_ORDER_HISTORY_20260309.file), 'utf-8')
    );
    const orderNumber = onlineHistory.orders[0].order_number;
    expect(FIXTURE_ONLINE_INVOICES_20260309.api.url).toContain(orderNumber);
  });

  it('API call is GET', () => {
    expect(FIXTURE_ONLINE_INVOICES_20260309.api.method).toBe('GET');
  });
});

// ─── parseTargetReceiptHtml unit tests ───────────────────────────────────────

describe('parseTargetReceiptHtml (unit)', () => {
  it('returns empty items for HTML with no item rows', () => {
    const result = parseTargetReceiptHtml('<html><body>No items here</body></html>');
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('extracts a single item row correctly', () => {
    const html = `<tr><td style="width: 23%;"><div style="text-align: left;">123456789</div></td><td style="width: 44%;"><div style="text-align: left;">Test Widget</div></td><td style="width: 13%; text-align: left;"><div>NF</div></td><td style="width: 19%; text-align: right;"><div style="text-align: right;">$12.99&nbsp;</div></td><td style="width: 1%;">&nbsp;</td></tr>`;
    const result = parseTargetReceiptHtml(html);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].dpci).toBe('123456789');
    expect(result.items[0].name).toBe('Test Widget');
    expect(result.items[0].totalPrice).toBe(12.99);
    expect(result.items[0].quantity).toBe(1);
    expect(result.items[0].unitPrice).toBe(12.99);
  });
});
