import { ScraperRegistry } from '../scrapers/registry';
import { RETAILER_TAB_CONFIG } from '../scrapers/config';
import { SyncOrchestrator } from './sync-orchestrator';
import { AlarmManager } from './alarm-manager';
import { getDebugLog, clearDebugLog } from '../debug/logger';
import type { ExtensionMessage } from '../types/messages';

const registry = new ScraperRegistry();
const orchestrator = new SyncOrchestrator(registry);

console.log('[matcha] Service worker started');

// Track tabs we opened so we can close them after scraping
const autoOpenedTabs = new Set<number>();

/**
 * For each retailer: open a fresh background tab to the order page.
 * Always opens a new tab (even if one is already open) to ensure a fresh
 * page load with current auth sessions. The manifest's content_scripts
 * will auto-inject when the page loads. Tabs are closed after scraping
 * completes via closeIfAutoOpened().
 */
async function getEnabledRetailers(): Promise<Set<string>> {
  const { enabledRetailers } = await chrome.storage.local.get('enabledRetailers');
  if (enabledRetailers) return new Set(enabledRetailers);
  return new Set(Object.keys(RETAILER_TAB_CONFIG)); // all enabled by default
}

async function triggerDomScrapers(): Promise<void> {
  const enabled = await getEnabledRetailers();
  for (const [retailerId, config] of Object.entries(RETAILER_TAB_CONFIG)) {
    if (!enabled.has(retailerId)) {
      console.log(`[matcha] Skipping disabled retailer: ${retailerId}`);
      continue;
    }
    try {
      console.log(
        `[matcha] Opening ${retailerId} order page in background tab`
      );
      const tab = await chrome.tabs.create({
        url: config.orderPageUrl,
        active: false,
      });
      if (tab.id) {
        autoOpenedTabs.add(tab.id);
      }
    } catch (err) {
      console.warn(`[matcha] Failed to trigger ${retailerId}:`, err);
    }
  }
}

// Initialize alarms — fires triggerDomScrapers on schedule
const alarmManager = new AlarmManager(() => triggerDomScrapers());
alarmManager.initialize().catch(console.error);

/** Open a fresh tab for a single retailer */
async function triggerSingleRetailer(retailerId: string): Promise<void> {
  const config = RETAILER_TAB_CONFIG[retailerId];
  if (!config) {
    console.warn(`[matcha] Unknown retailer: ${retailerId}`);
    return;
  }
  console.log(`[matcha] Opening ${retailerId} order page in background tab`);
  const tab = await chrome.tabs.create({
    url: config.orderPageUrl,
    active: false,
  });
  if (tab.id) {
    autoOpenedTabs.add(tab.id);
  }
}

// Debug: log when auto-opened tabs finish loading (to catch redirects)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (autoOpenedTabs.has(tabId) && changeInfo.status === 'complete') {
    console.log(`[matcha] Auto-opened tab ${tabId} loaded: ${tab.url}`);
  }
});

/** Close a tab if we auto-opened it for scraping */
function closeIfAutoOpened(sender: chrome.runtime.MessageSender): void {
  const tabId = sender.tab?.id;
  if (tabId && autoOpenedTabs.has(tabId)) {
    autoOpenedTabs.delete(tabId);
    console.log(`[matcha] Closing auto-opened tab ${tabId}`);
    chrome.tabs.remove(tabId).catch(() => {});
  }
}

/** Write sync progress to storage (popup listens via onChanged) */
async function updateSyncProgress(
  retailerId: string,
  progress: { phase: string; current: number; total: number; message?: string } | null
): Promise<void> {
  const { syncProgress = {} } = await chrome.storage.local.get('syncProgress');
  if (progress) {
    syncProgress[retailerId] = progress;
  } else {
    delete syncProgress[retailerId];
  }
  await chrome.storage.local.set({ syncProgress });
}

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender, sendResponse) => {
    console.log(
      `[matcha] SW received: ${message.type}`,
      'from tab:',
      sender.tab?.id,
      sender.tab?.url
    );
    switch (message.type) {
      case 'SCRAPE_COMPLETE':
        closeIfAutoOpened(sender);
        updateSyncProgress(message.retailerId, { phase: 'pushing', current: 0, total: 0, message: 'Saving to matcha...' });
        orchestrator
          .handleScrapedReceipts(message.retailerId, message.receipts)
          .then(() => {
            updateSyncProgress(message.retailerId, null);
            sendResponse({ success: true });
          })
          .catch((err) => {
            updateSyncProgress(message.retailerId, null);
            console.error(`[matcha] Scrape processing error:`, err);
            sendResponse({ success: false, error: String(err) });
          });
        return true;

      case 'SCRAPE_ERROR':
        closeIfAutoOpened(sender);
        updateSyncProgress(message.retailerId, null);
        orchestrator
          .recordError(message.retailerId, message.error)
          .catch(console.error);
        break;

      case 'SYNC_PROGRESS':
        updateSyncProgress(message.retailerId, message.progress);
        break;

      case 'MANUAL_SYNC_REQUEST':
        triggerDomScrapers()
          .then(() => sendResponse({ success: true }))
          .catch((err) => sendResponse({ success: false, error: String(err) }));
        return true;

      case 'SYNC_RETAILER_REQUEST':
        triggerSingleRetailer(message.retailerId)
          .then(() => sendResponse({ success: true }))
          .catch((err: unknown) =>
            sendResponse({ success: false, error: String(err) })
          );
        return true;

      case 'GET_STATUS_REQUEST':
        orchestrator
          .getStatus()
          .then((status) =>
            sendResponse({ type: 'GET_STATUS_RESPONSE', status })
          )
          .catch(console.error);
        return true;

      case 'GET_DEBUG_LOG_REQUEST':
        getDebugLog()
          .then((entries) =>
            sendResponse({ type: 'GET_DEBUG_LOG_RESPONSE', entries })
          )
          .catch(console.error);
        return true;

      case 'CLEAR_DEBUG_LOG':
        clearDebugLog().catch(console.error);
        break;
    }
  }
);
