import type { DebugLogEntry } from '../types/messages';

const MAX_LOG_ENTRIES = 200;

/** Redact sensitive values from a payload before storing or logging. */
function redact(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    // Redact anything that looks like a JWT or long token
    if (value.length > 100 && value.includes('.')) return '[REDACTED]';
    // Redact card last-4 patterns (e.g. "4242", "4567")
    if (/^\d{4}$/.test(value)) return '••XXXX';
    return value;
  }
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => {
        // Always redact these keys regardless of value shape
        if (/idToken|clientId|token|secret|cookie|authorization/i.test(k)) {
          return [k, '[REDACTED]'];
        }
        if (/last4|cardNumber|displayAccountNumber/i.test(k)) {
          return [k, '••XXXX'];
        }
        return [k, redact(v)];
      })
    );
  }
  return value;
}

/** Log an outbound API request for debug inspection */
export async function logRequest(
  entry: Omit<DebugLogEntry, 'timestamp'>
): Promise<void> {
  const fullEntry: DebugLogEntry = {
    ...entry,
    payload: redact(entry.payload) as DebugLogEntry['payload'],
    response: redact(entry.response) as DebugLogEntry['response'],
    timestamp: new Date().toISOString(),
  };

  const { debugLog = [] } = await chrome.storage.local.get(['debugLog']);
  const updated = [fullEntry, ...debugLog].slice(0, MAX_LOG_ENTRIES);
  await chrome.storage.local.set({ debugLog: updated });

  // Log to console when dev mode is enabled
  const { useFakeApi } = await chrome.storage.local.get('useFakeApi');
  if (useFakeApi !== false) {
    console.log(
      `[matcha debug] ${entry.method} ${entry.endpoint}`,
      entry.payload,
      entry.response ?? entry.error ?? ''
    );
  }
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
