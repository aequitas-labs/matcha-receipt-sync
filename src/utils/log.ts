/** Console logging gated to dev mode (runtime setting, not build-time).
 *  Reads `useFakeApi` from chrome.storage.local and caches the result.
 *  Falls back to enabled in non-production builds. */

let devMode: boolean | null = null;

function loadDevMode(): void {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    chrome.storage.local.get('useFakeApi', (result) => {
      devMode = result.useFakeApi !== false;
    });
    // Listen for changes so toggling dev mode takes effect immediately
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.useFakeApi !== undefined) {
        devMode = changes.useFakeApi.newValue !== false;
      }
    });
  } else {
    // Outside extension context (e.g. tests) — always log
    devMode = true;
  }
}

loadDevMode();

function isEnabled(): boolean {
  // Before storage responds, fall back to build-time check
  if (devMode === null) return process.env.NODE_ENV !== 'production';
  return devMode;
}

export function log(...args: unknown[]): void {
  if (isEnabled()) console.log(...args);
}

export function warn(...args: unknown[]): void {
  if (isEnabled()) console.warn(...args);
}
