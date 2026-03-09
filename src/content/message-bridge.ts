import type { ExtensionMessage, InvoiceRef } from '../types/messages';
import type { ScrapedReceipt, SyncCursor } from '../types/scraper';

export class MessageBridge {
  sendScrapedReceipts(retailerId: string, receipts: ScrapedReceipt[]): void {
    chrome.runtime.sendMessage({
      type: 'SCRAPE_COMPLETE',
      retailerId,
      receipts,
    } satisfies ExtensionMessage);
  }

  sendScrapeError(retailerId: string, error: string): void {
    chrome.runtime.sendMessage({
      type: 'SCRAPE_ERROR',
      retailerId,
      error,
    } satisfies ExtensionMessage);
  }

  sendInvoiceUrls(retailerId: string, invoices: InvoiceRef[]): void {
    chrome.runtime.sendMessage({
      type: 'INVOICE_URLS',
      retailerId,
      invoices,
    } satisfies ExtensionMessage);
  }

  sendCostcoTokens(clientId: string, idToken: string): void {
    chrome.runtime.sendMessage({
      type: 'COSTCO_AUTH_TOKENS',
      clientId,
      idToken,
    } satisfies ExtensionMessage);
  }

  async fetchPaginatedInvoices(
    retailerId: string,
    nextUrl: string,
    cursorDate?: string
  ): Promise<InvoiceRef[]> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: 'FETCH_PAGINATED_INVOICES',
          retailerId,
          nextUrl,
          cursorDate,
        } satisfies ExtensionMessage,
        (response: InvoiceRef[]) => resolve(response ?? [])
      );
    });
  }

  async getCursor(retailerId: string): Promise<SyncCursor | undefined> {
    const { cursors = {} } = await chrome.storage.local.get(['cursors']);
    return cursors[retailerId];
  }
}
