import type { ScrapedReceipt } from '../types/scraper';

/** Pretty-printed JSON export */
export function exportAsJSON(receipts: ScrapedReceipt[]): string {
  return JSON.stringify(receipts, null, 2);
}

/** Flattened CSV export — one row per item */
export function exportAsCSV(receipts: ScrapedReceipt[]): string {
  const headers = [
    'retailer',
    'orderId',
    'orderDate',
    'totalAmount',
    'itemName',
    'quantity',
    'unitPrice',
    'totalPrice',
  ];

  const rows: string[][] = [];
  for (const r of receipts) {
    if (r.items.length === 0) {
      rows.push([
        r.retailer,
        r.orderId,
        r.orderDate instanceof Date
          ? r.orderDate.toISOString()
          : String(r.orderDate),
        String(r.totalAmount),
        '',
        '',
        '',
        '',
      ]);
    } else {
      for (const item of r.items) {
        rows.push([
          r.retailer,
          r.orderId,
          r.orderDate instanceof Date
            ? r.orderDate.toISOString()
            : String(r.orderDate),
          String(r.totalAmount),
          item.name,
          item.quantity != null ? String(item.quantity) : '',
          item.unitPrice != null ? String(item.unitPrice) : '',
          String(item.totalPrice),
        ]);
      }
    }
  }

  const escape = (s: string) => {
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  return [
    headers.join(','),
    ...rows.map((row) => row.map(escape).join(',')),
  ].join('\n');
}

/** Trigger a file download via blob URL */
export function downloadFile(
  content: string,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
