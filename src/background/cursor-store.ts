import type { SyncCursor } from '../types/scraper';

export class CursorStore {
  async get(retailerId: string): Promise<SyncCursor | undefined> {
    const { cursors = {} } = await chrome.storage.local.get(['cursors']);
    return cursors[retailerId];
  }

  async set(retailerId: string, cursor: SyncCursor): Promise<void> {
    const { cursors = {} } = await chrome.storage.local.get(['cursors']);
    cursors[retailerId] = cursor;
    await chrome.storage.local.set({ cursors });
  }

  async clear(retailerId: string): Promise<void> {
    const { cursors = {} } = await chrome.storage.local.get(['cursors']);
    delete cursors[retailerId];
    await chrome.storage.local.set({ cursors });
  }
}
