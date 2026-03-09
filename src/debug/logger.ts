import type { DebugLogEntry } from '../types/messages';

const MAX_LOG_ENTRIES = 200;

/** Log an outbound API request for debug inspection */
export async function logRequest(
  entry: Omit<DebugLogEntry, 'timestamp'>
): Promise<void> {
  const fullEntry: DebugLogEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };

  const { debugLog = [] } = await chrome.storage.local.get(['debugLog']);
  const updated = [fullEntry, ...debugLog].slice(0, MAX_LOG_ENTRIES);
  await chrome.storage.local.set({ debugLog: updated });

  // Also log to console for service worker inspection
  console.log(
    `[Matcha Debug] ${entry.method} ${entry.endpoint}`,
    entry.payload,
    entry.response ?? entry.error ?? ''
  );
}

/** Get all debug log entries */
export async function getDebugLog(): Promise<DebugLogEntry[]> {
  const { debugLog = [] } = await chrome.storage.local.get(['debugLog']);
  return debugLog;
}

/** Clear all debug log entries */
export async function clearDebugLog(): Promise<void> {
  await chrome.storage.local.set({ debugLog: [] });
}
