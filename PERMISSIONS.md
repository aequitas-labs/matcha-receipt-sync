# Permissions Justification

This document explains why each permission and host permission is required by the matcha money receipt sync extension. It is intended as a reference for Chrome Web Store reviewers.

## Permissions

| Permission | Justification |
|------------|--------------|
| `storage` | Stores sync cursors, cached receipts, user settings (enabled retailers, sync date), and auth tokens in `chrome.storage.local`. |
| `alarms` | Schedules automatic periodic syncs (daily or weekly) using `chrome.alarms` so syncing runs even when the popup is not open. |
| `cookies` | Reads the matcha.money session cookie to authenticate API requests that push receipt data to the user's account. |
| `scripting` | Injects content scripts into retailer pages using the MAIN world context, which is required to access `localStorage` and same-origin auth tokens (e.g. Costco MSAL tokens, Target session cookies). |
| `tabs` | Opens background tabs to retailer order pages to trigger scraping, and closes them automatically when scraping is complete. |

## Host Permissions

| Host | Justification |
|------|--------------|
| `https://www.amazon.com/*` | Fetches Amazon invoice pages from the service worker to parse order details. Content scripts inject on order history pages. |
| `https://www.costco.com/*` | Content scripts inject on Costco order history pages to read MSAL auth tokens from `localStorage` and call the Costco GraphQL API. |
| `https://ecom-api.costco.com/*` | Costco's order API endpoint. Requests are made from the MAIN world content script (must originate from a costco.com page to pass Akamai WAF). |
| `https://www.walmart.com/*` | Content scripts inject on Walmart order pages to extract `__NEXT_DATA__` SSR state and paginate via Walmart's internal GraphQL API. |
| `https://www.target.com/*` | Content scripts inject on Target order pages to call Target's internal order history REST API. |
| `https://api.target.com/*` | Target's order aggregation and invoice API. Requests are made from the MAIN world content script running on target.com. |
| `https://matcha.money/*` | Reads the user's session cookie for authentication, calls `/api/auth/get-session` to verify login, and pushes scraped receipts to the matcha API. |
| `https://us.i.posthog.com/*` | Sends anonymous usage analytics (sync counts, errors, export events) to PostHog for product improvement. Users can opt out in Settings. |
