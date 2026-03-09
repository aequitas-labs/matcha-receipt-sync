import type { ScrapedReceipt } from '../types/scraper';

const STORAGE_KEY = 'scrapedReceipts';

type ReceiptStore = Record<string, ScrapedReceipt[]>;

/** Save receipts to local storage, deduplicating by retailer+orderId */
export async function saveReceipts(receipts: ScrapedReceipt[]): Promise<void> {
  const { [STORAGE_KEY]: existing = {} } =
    await chrome.storage.local.get(STORAGE_KEY);
  const store: ReceiptStore = existing;

  for (const receipt of receipts) {
    const key = receipt.retailer;
    if (!store[key]) store[key] = [];

    const idx = store[key].findIndex((r) => r.orderId === receipt.orderId);
    if (idx >= 0) {
      store[key][idx] = receipt; // update existing
    } else {
      store[key].push(receipt);
    }
  }

  await chrome.storage.local.set({ [STORAGE_KEY]: store });
}

export async function getAllReceipts(): Promise<ScrapedReceipt[]> {
  const { [STORAGE_KEY]: store = {} } =
    await chrome.storage.local.get(STORAGE_KEY);
  return Object.values(store as ReceiptStore).flat();
}

export async function getReceiptsByRetailer(
  retailerId: string
): Promise<ScrapedReceipt[]> {
  const { [STORAGE_KEY]: store = {} } =
    await chrome.storage.local.get(STORAGE_KEY);
  return (store as ReceiptStore)[retailerId] ?? [];
}

export async function getReceiptCount(): Promise<number> {
  const all = await getAllReceipts();
  return all.length;
}

export async function clearReceipts(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}
