# Agent Context & Operating Instructions

## 1. Project Overview

**Name:** matcha money receipt sync

A Chrome extension (Manifest V3) that syncs receipts from Amazon, Costco, Walmart, and Target to matcha money.

## 2. Technology Stack

- **Platform:** Chrome Extension (Manifest V3)
- **Language:** TypeScript
- **UI:** React (popup only)
- **Bundler:** Webpack
- **Build output:** `dist/`

## 3. Architecture

### Two-World Content Script Pattern

Retailers that need access to page cookies, localStorage, or same-origin fetch use two content scripts:

1. **MAIN world** (`content-*-main.ts`) — runs in the page's JS context. Has access to cookies, localStorage, and can make same-origin API calls.
2. **ISOLATED world** (`content-*.ts`) — has access to `chrome.*` extension APIs. Communicates with MAIN world via `window.postMessage` and forwards results to the service worker via `chrome.runtime.sendMessage`.

### Message Flow

```
MAIN world → window.postMessage → ISOLATED world → chrome.runtime.sendMessage → service worker
```

### Sync Flow

1. User clicks "Sync Now" in popup → sends `MANUAL_SYNC_REQUEST` to service worker
2. Service worker opens a fresh background tab for each retailer
3. Manifest content scripts auto-inject on page load
4. Content scripts scrape data and send results back to service worker
5. Service worker pushes transactions to matcha money API and advances cursors
6. Auto-opened tabs are closed after scraping completes

## 4. Key Conventions

- **Scraper registration:** All scrapers are registered in `src/scrapers/registry.ts`
- **Message types:** Defined in `src/types/messages.ts`
- **Cursors:** Stored in `chrome.storage.local` under the `cursors` key, keyed by retailer ID
- **Error pattern:** Content scripts send `SCRAPE_ERROR` messages; service worker logs them via `orchestrator.recordError()`
- **Race condition handling:** ISOLATED world scripts use `waitForMainReady()` with a timeout fallback for retailers that need MAIN world initialization

## 5. Build & Test

```bash
npm install
npm run dev       # webpack watch mode
npm run build     # production build
npm run typecheck # type checking
```

Load `dist/` as an unpacked extension in `chrome://extensions` (developer mode).

## 6. Adding a New Retailer

1. Create `src/scrapers/<retailer>/` with content script(s) and scraper class
2. Add MAIN world script if the retailer needs page-context access
3. Register the scraper in `src/scrapers/registry.ts`
4. Add URL patterns and tab config to `RETAILER_TAB_CONFIG` in `src/background/service-worker.ts`
5. Add content script entries to `src/manifest.json`
6. Add webpack entry points in `webpack.config.js`
