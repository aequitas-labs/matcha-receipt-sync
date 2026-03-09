/**
 * Branded toast notification for content scripts.
 * Uses inline styles since content scripts can't load extension CSS.
 *
 * Usage:
 *   showToast('Found 3 orders from Amazon', 'success');
 *   showToast('Scanning orders...', 'info');
 *   showToast('Session expired', 'error');
 */

export type ToastLevel = 'success' | 'info' | 'error';

const COLORS: Record<
  ToastLevel,
  { bg: string; border: string; text: string; icon: string }
> = {
  success: {
    bg: '#f0fdf4',
    border: '#88b04b',
    text: '#2f3e2e',
    icon: '#88b04b',
  },
  info: { bg: '#faf9f5', border: '#e0c097', text: '#2f3e2e', icon: '#e0c097' },
  error: { bg: '#fef2f2', border: '#e57373', text: '#991b1b', icon: '#e57373' },
};

const LOGO_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#88b04b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M7 20h10"/>
  <path d="M10 20c5.5-2.5.8-6.4 3-10"/>
  <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/>
  <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>
</svg>`;

let toastContainer: HTMLDivElement | null = null;

function getContainer(): HTMLDivElement {
  if (toastContainer && document.body.contains(toastContainer)) {
    return toastContainer;
  }
  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'fixed',
    bottom: '16px',
    right: '16px',
    zIndex: '2147483647',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    pointerEvents: 'none',
  });
  document.body.appendChild(container);
  toastContainer = container;
  return container;
}

export function showToast(message: string, level: ToastLevel = 'info'): void {
  const c = COLORS[level];
  const container = getContainer();

  const el = document.createElement('div');
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;">
      <div style="flex-shrink:0;width:16px;height:16px;">${LOGO_SVG}</div>
      <div style="display:flex;flex-direction:column;gap:1px;">
        <span style="font-size:10px;font-weight:600;color:${c.icon};text-transform:uppercase;letter-spacing:0.5px;">matcha money</span>
        <span style="font-size:13px;color:${c.text};">${escapeHtml(message)}</span>
      </div>
    </div>
  `;
  Object.assign(el.style, {
    pointerEvents: 'auto',
    padding: '10px 14px',
    borderRadius: '10px',
    background: c.bg,
    border: `1px solid ${c.border}`,
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    maxWidth: '360px',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    opacity: '0',
    transform: 'translateY(8px)',
    transition: 'opacity 0.3s ease, transform 0.3s ease',
  });

  container.appendChild(el);

  // Trigger enter animation
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  });

  // Auto-dismiss after 10 seconds
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    setTimeout(() => el.remove(), 300);
  }, 10000);
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
