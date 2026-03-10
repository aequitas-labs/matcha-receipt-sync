# matcha money receipt sync

A Chrome extension (Manifest V3) that automatically syncs receipts from major retailers into [matcha money](https://matcha.money).

## Supported Retailers

| Retailer    | Method                    | Notes                                                                                           |
| ----------- | ------------------------- | ----------------------------------------------------------------------------------------------- |
| **Amazon**  | Invoice page fetch        | Collects invoice URLs from order list, fetches & parses each invoice page in the service worker |
| **Costco**  | GraphQL API               | Reads auth tokens from localStorage (MAIN world), calls Costco's order API                      |
| **Walmart** | `__NEXT_DATA__` + GraphQL | Phase 1: parses SSR data from Next.js. Phase 2: paginates via GraphQL API                       |
| **Target**  | Internal API              | Calls Target's order history API from the MAIN world context                                    |

## Architecture

```
content script (ISOLATED world)
  ↕  window.postMessage
content script (MAIN world)        ← runs in page JS context, has access to cookies/localStorage
  ↕  chrome.runtime.sendMessage
service worker                     ← orchestrates sync, manages tabs, calls matcha API
```

- **Two-world pattern**: Retailers that need page-context access (cookies, localStorage, same-origin fetch) use a MAIN world content script paired with an ISOLATED world bridge script.
- **Service worker**: Opens background tabs for each retailer, receives scraped data, pushes transactions to matcha money's API, and manages sync cursors.
- **Popup**: React-based UI for login, sync status, and manual sync trigger.

## Development

```bash
npm install
npm run dev       # webpack watch mode
npm run build     # production build → dist/
npm run typecheck # TypeScript check
```

Load the extension in Chrome:

1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `dist/` folder

## Project Structure

```
src/
├── background/          # Service worker, sync orchestrator, alarm manager
├── content/             # MessageBridge (ISOLATED ↔ service worker)
├── scrapers/
│   ├── amazon/          # Invoice URL collection + invoice page parser
│   ├── costco/          # MAIN world GraphQL + ISOLATED bridge
│   ├── walmart/         # __NEXT_DATA__ + GraphQL pagination
│   ├── target/          # MAIN world API + ISOLATED bridge
│   └── registry.ts      # Scraper registration
├── popup/               # React popup UI
├── types/               # Shared TypeScript types
├── debug/               # Debug logging
└── manifest.json        # Chrome extension manifest
```

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE).

## Exported Item Fields

Each scraped receipt includes an `items` array. Every item has:

| Field            | Type     | Description                                                                                                                                                                                                                    |
| ---------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `name`           | `string` | Item description                                                                                                                                                                                                               |
| `quantity`       | `number` | Number of units purchased                                                                                                                                                                                                      |
| `unitPrice`      | `number` | Pre-tax price per unit                                                                                                                                                                                                         |
| `totalPrice`     | `number` | Line total (unitPrice × quantity, after item-level discounts)                                                                                                                                                                  |
| `effectivePrice` | `number` | Per-unit cost including this item's proportional share of receipt-level tax and shipping. Always rounded to 2 decimal places; the last item absorbs any rounding remainder so the sum reconciles exactly to the receipt total. |

**Tax attribution by retailer:**

- **Costco in-store**: per-item `taxFlag` (`Y`/`N`) is used — tax is allocated only to taxable items
- **All others**: tax and shipping are distributed proportionally by `totalPrice / subtotal`
