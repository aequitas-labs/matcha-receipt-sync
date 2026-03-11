/**
 * Screenshot generator for Chrome Web Store
 * Renders 3 screenshots at 1280×800 using Playwright
 * Run: node generate-screenshots.js
 */

const {
  chromium,
} = require('/Users/chris/matcha/matcha/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const OUT_DIR = __dirname;
const ICON_PATH = path.resolve(
  __dirname,
  '../extensions/receipt-sync/dist/icons/icon-128.png'
);
const ICON_B64 =
  'data:image/png;base64,' + fs.readFileSync(ICON_PATH).toString('base64');

// Brand colors
const C = {
  bg: '#2F3E2E',
  bgLight: '#374837',
  card: '#FFFFFF',
  oatMilk: '#F3F1E8',
  green: '#88B04B',
  greenMuted: 'rgba(136,176,75,0.15)',
  border: '#E5E2D9',
  muted: '#F5F3EC',
  mutedText: '#52525B',
  destructive: '#E57373',
  foreground: '#2F3E2E',
  white: '#FFFFFF',
};

const FONT_LINK = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">`;

const BASE_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Geist', -apple-system, sans-serif; background: ${C.bg}; width: 1280px; height: 800px; overflow: hidden; display: flex; }
  .mono { font-family: 'JetBrains Mono', monospace; }
  .popup {
    width: 360px; min-height: 480px;
    background: ${C.oatMilk}; border-radius: 16px;
    box-shadow: 0 32px 80px rgba(0,0,0,0.5);
    overflow: hidden; flex-shrink: 0;
  }
  .popup-inner { padding: 16px; }
  /* header */
  .popup-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid ${C.border}; }
  .popup-header img { width: 24px; height: 24px; border-radius: 6px; }
  .popup-header h1 { font-size: 15px; font-weight: 600; color: ${C.foreground}; line-height: 1.2; }
  .popup-header p { font-size: 10px; color: ${C.mutedText}; }
  .popup-header .ml-auto { margin-left: auto; display: flex; gap: 4px; }
  .icon-btn { width: 28px; height: 28px; border-radius: 6px; border: none; background: transparent; display: flex; align-items: center; justify-content: center; cursor: pointer; color: ${C.mutedText}; }
  /* status */
  .status-bar { display: flex; align-items: center; gap: 6px; margin-bottom: 12px; }
  .status-dot { width: 7px; height: 7px; border-radius: 50%; background: ${C.green}; flex-shrink: 0; }
  .status-dot.idle { background: ${C.border}; }
  .status-text { font-size: 11px; color: ${C.mutedText}; }
  .status-text.connected { color: ${C.green}; font-weight: 500; }
  /* section label */
  .section-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: ${C.mutedText}; margin-bottom: 8px; }
  /* card */
  .card { background: ${C.white}; border: 1px solid ${C.border}; border-radius: 10px; padding: 10px 12px; margin-bottom: 8px; }
  /* retailer card */
  .retailer-row { display: flex; align-items: center; gap: 8px; }
  .retailer-icon { font-size: 15px; }
  .retailer-name { font-size: 13px; font-weight: 600; color: ${C.foreground}; flex: 1; }
  .badge { font-family: 'JetBrains Mono', monospace; font-size: 10px; padding: 2px 7px; border-radius: 20px; background: ${C.muted}; color: ${C.mutedText}; }
  .sync-time { font-size: 11px; color: ${C.mutedText}; margin-top: 4px; }
  .progress-bar { height: 4px; background: ${C.muted}; border-radius: 2px; margin-top: 6px; overflow: hidden; }
  .progress-fill { height: 100%; background: ${C.green}; border-radius: 2px; }
  /* sync button */
  .sync-btn { width: 100%; padding: 9px; border-radius: 8px; border: none; background: ${C.green}; color: white; font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 600; cursor: pointer; margin-bottom: 16px; margin-top: 4px; }
  /* export */
  .export-row { display: flex; align-items: center; gap: 8px; }
  .export-count { font-size: 11px; color: ${C.mutedText}; flex: 1; }
  .export-btns { display: flex; gap: 6px; }
  .btn-secondary { padding: 5px 10px; border-radius: 6px; border: 1px solid ${C.border}; background: ${C.white}; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 500; color: ${C.foreground}; cursor: pointer; display: flex; align-items: center; gap: 4px; }
  /* copy panel */
  .copy-panel { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 64px 72px; }
  .eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: ${C.green}; letter-spacing: 0.08em; margin-bottom: 16px; text-transform: uppercase; }
  .headline { font-family: 'Geist', sans-serif; font-size: 44px; font-weight: 700; color: ${C.oatMilk}; line-height: 1.1; letter-spacing: -0.03em; margin-bottom: 20px; }
  .headline em { color: ${C.green}; font-style: normal; }
  .body-copy { font-family: 'JetBrains Mono', monospace; font-size: 14px; color: ${C.oatMilk}; opacity: 0.65; line-height: 1.6; margin-bottom: 32px; max-width: 420px; }
  .pill-list { display: flex; flex-wrap: wrap; gap: 8px; }
  .pill { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 600; color: ${C.green}; background: rgba(136,176,75,0.15); border-radius: 20px; padding: 5px 14px; }
  /* dot pattern overlay */
  .dot-overlay { position: absolute; inset: 0; background-image: radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px); background-size: 20px 20px; pointer-events: none; }
  .scene { position: relative; width: 1280px; height: 800px; display: flex; align-items: center; }
  /* accent line */
  .accent-line { position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: ${C.green}; }
`;

function popupHeader() {
  return `
  <div class="popup-header">
    <img src="${ICON_B64}" alt="">
    <div>
      <h1>matcha money</h1>
      <p class="mono">receipt sync</p>
    </div>
    <div class="ml-auto">
      <button class="icon-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
      </button>
      <button class="icon-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </button>
    </div>
  </div>`;
}

// ── Screenshot 1: Main view — connected, synced ─────────────────────────────
const screenshot1Html = `<!DOCTYPE html>
<html><head>${FONT_LINK}
<style>${BASE_STYLES}
  .scene { padding: 0 80px; gap: 0; }
  .copy-panel { padding-left: 80px; }
</style></head><body>
<div class="scene">
  <div class="accent-line"></div>
  <div class="dot-overlay"></div>

  <div class="popup">
    <div class="popup-inner">
      ${popupHeader()}
      <div class="status-bar">
        <div class="status-dot"></div>
        <span class="status-text connected mono">Connected to matcha.money</span>
      </div>

      <div class="section-label">Retailers</div>
      ${[
        {
          icon: '🛒',
          name: 'Amazon',
          count: '142 receipts',
          time: '2 hours ago',
        },
        {
          icon: '🏪',
          name: 'Costco',
          count: '38 receipts',
          time: '2 hours ago',
        },
        {
          icon: '🟡',
          name: 'Walmart',
          count: '61 receipts',
          time: '2 hours ago',
        },
        {
          icon: '🎯',
          name: 'Target',
          count: '29 receipts',
          time: '2 hours ago',
        },
      ]
        .map(
          (r) => `
      <div class="card">
        <div class="retailer-row">
          <span class="retailer-icon">${r.icon}</span>
          <span class="retailer-name">${r.name}</span>
          <span class="badge">${r.count}</span>
          <button class="icon-btn" style="width:24px;height:24px">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${C.mutedText}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </button>
        </div>
        <div class="sync-time mono">Last sync: ${r.time}</div>
      </div>`
        )
        .join('')}

      <button class="sync-btn">Sync all retailers</button>

      <div class="section-label">Export</div>
      <div class="export-row">
        <span class="export-count mono">270 receipts stored locally</span>
        <div class="export-btns">
          <button class="btn-secondary">↓ JSON</button>
          <button class="btn-secondary">↓ CSV</button>
        </div>
      </div>
    </div>
  </div>

  <div class="copy-panel">
    <div class="eyebrow">receipt sync</div>
    <div class="headline">All your orders.<br><em>One place.</em></div>
    <div class="body-copy">Automatically pull receipts from Amazon, Costco, Walmart, and Target. Every purchase, neatly organized and ready to use.</div>
    <div class="pill-list">
      <div class="pill">auto-sync</div>
      <div class="pill">4 retailers</div>
      <div class="pill">works in the background</div>
    </div>
  </div>
</div>
</body></html>`;

// ── Screenshot 2: Export view ────────────────────────────────────────────────
const screenshot2Html = `<!DOCTYPE html>
<html><head>${FONT_LINK}
<style>${BASE_STYLES}
  .scene { padding: 0 80px; gap: 0; flex-direction: row-reverse; }
  .copy-panel { padding-right: 80px; padding-left: 0; }
  .export-section { background: ${C.white}; border: 1px solid ${C.border}; border-radius: 10px; padding: 14px; margin-bottom: 8px; }
  .export-format-row { display: flex; gap: 10px; margin-top: 12px; }
  .export-format-card { flex: 1; background: ${C.muted}; border: 1px solid ${C.border}; border-radius: 8px; padding: 12px; }
  .export-format-card h3 { font-size: 13px; font-weight: 600; color: ${C.foreground}; margin-bottom: 4px; }
  .export-format-card p { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: ${C.mutedText}; line-height: 1.4; }
  .export-format-card .btn-dl { display: block; width: 100%; margin-top: 10px; padding: 6px; border-radius: 6px; border: 1px solid ${C.border}; background: white; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 600; color: ${C.foreground}; text-align: center; cursor: pointer; }
  .stats-row { display: flex; gap: 8px; margin-bottom: 8px; }
  .stat-card { flex: 1; background: ${C.white}; border: 1px solid ${C.border}; border-radius: 10px; padding: 12px; text-align: center; }
  .stat-num { font-size: 24px; font-weight: 700; color: ${C.foreground}; font-family: 'JetBrains Mono', monospace; }
  .stat-label { font-size: 10px; color: ${C.mutedText}; margin-top: 2px; }
</style></head><body>
<div class="scene">
  <div class="accent-line"></div>
  <div class="dot-overlay"></div>

  <div class="popup">
    <div class="popup-inner">
      ${popupHeader()}
      <div class="status-bar">
        <div class="status-dot"></div>
        <span class="status-text connected mono">Connected to matcha.money</span>
      </div>

      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-num">270</div>
          <div class="stat-label mono">receipts</div>
        </div>
        <div class="stat-card">
          <div class="stat-num">4</div>
          <div class="stat-label mono">retailers</div>
        </div>
        <div class="stat-card">
          <div class="stat-num">$8,412</div>
          <div class="stat-label mono">captured</div>
        </div>
      </div>

      <div class="section-label" style="margin-top:8px">Export</div>
      <div class="export-section">
        <div style="font-size:11px;color:${C.mutedText}" class="mono">270 receipts stored locally</div>
        <div class="export-format-row">
          <div class="export-format-card">
            <h3>JSON</h3>
            <p>Full data with line items. For developers &amp; custom tools.</p>
            <button class="btn-dl">↓ Download JSON</button>
          </div>
          <div class="export-format-card">
            <h3>CSV</h3>
            <p>Spreadsheet-ready. Open in Excel or Google Sheets.</p>
            <button class="btn-dl">↓ Download CSV</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="copy-panel">
    <div class="eyebrow">no account required</div>
    <div class="headline">Your data,<br><em>your format.</em></div>
    <div class="body-copy">Export everything as JSON or CSV — no subscription needed. Open in Excel, import into your own tools, or build something new.</div>
    <div class="pill-list">
      <div class="pill">free to use</div>
      <div class="pill">CSV for spreadsheets</div>
      <div class="pill">JSON for developers</div>
    </div>
  </div>
</div>
</body></html>`;

// ── Screenshot 3: Syncing in progress ───────────────────────────────────────
const screenshot3Html = `<!DOCTYPE html>
<html><head>${FONT_LINK}
<style>${BASE_STYLES}
  .scene { padding: 0 80px; gap: 0; }
  .copy-panel { padding-left: 80px; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  .pulse { animation: pulse 1.5s ease-in-out infinite; }
</style></head><body>
<div class="scene">
  <div class="accent-line"></div>
  <div class="dot-overlay"></div>

  <div class="popup">
    <div class="popup-inner">
      ${popupHeader()}
      <div class="status-bar">
        <div class="status-dot"></div>
        <span class="status-text connected mono">Connected to matcha.money</span>
      </div>

      <div class="section-label">Retailers</div>

      <!-- Amazon: syncing with progress -->
      <div class="card">
        <div class="retailer-row">
          <span class="retailer-icon">🛒</span>
          <span class="retailer-name">Amazon</span>
          <button class="icon-btn" style="width:24px;height:24px;color:${C.green}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation:spin 1s linear infinite">
              <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </button>
        </div>
        <div class="sync-time mono" style="color:${C.green}">87 / 142 orders</div>
        <div class="progress-bar"><div class="progress-fill" style="width:61%"></div></div>
      </div>

      <!-- Costco: syncing -->
      <div class="card">
        <div class="retailer-row">
          <span class="retailer-icon">🏪</span>
          <span class="retailer-name">Costco</span>
          <button class="icon-btn" style="width:24px;height:24px;color:${C.green}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation:spin 1s linear infinite"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </button>
        </div>
        <div class="sync-time mono pulse">Scanning...</div>
        <div class="progress-bar"><div class="progress-fill pulse" style="width:100%;opacity:0.4"></div></div>
      </div>

      <!-- Walmart: done -->
      <div class="card">
        <div class="retailer-row">
          <span class="retailer-icon">🟡</span>
          <span class="retailer-name">Walmart</span>
          <span class="badge">61 receipts</span>
          <button class="icon-btn" style="width:24px;height:24px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${C.mutedText}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></button>
        </div>
        <div class="sync-time mono">Last sync: just now</div>
      </div>

      <!-- Target: done -->
      <div class="card">
        <div class="retailer-row">
          <span class="retailer-icon">🎯</span>
          <span class="retailer-name">Target</span>
          <span class="badge">29 receipts</span>
          <button class="icon-btn" style="width:24px;height:24px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${C.mutedText}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></button>
        </div>
        <div class="sync-time mono">Last sync: just now</div>
      </div>

      <button class="sync-btn" style="opacity:0.5">Syncing 2 of 4...</button>
    </div>
  </div>

  <div class="copy-panel">
    <div class="eyebrow">set it and forget it</div>
    <div class="headline">Syncs while<br><em>you shop.</em></div>
    <div class="body-copy">Schedule daily or weekly syncs. The extension runs in the background and keeps your receipt history up to date — no manual steps needed.</div>
    <div class="pill-list">
      <div class="pill">daily auto-sync</div>
      <div class="pill">real-time progress</div>
      <div class="pill">runs in background</div>
    </div>
  </div>
</div>
</body></html>`;

async function render(html, filename) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const outPath = path.join(OUT_DIR, filename);
  await page.screenshot({
    path: outPath,
    clip: { x: 0, y: 0, width: 1280, height: 800 },
  });
  await browser.close();
  console.log(`✓ ${filename}`);
}

(async () => {
  await render(screenshot1Html, 'screenshot-1-main.png');
  await render(screenshot2Html, 'screenshot-2-export.png');
  await render(screenshot3Html, 'screenshot-3-syncing.png');
  console.log('All screenshots saved to store-assets/');
})();
