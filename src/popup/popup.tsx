import React from 'react';
import { createRoot } from 'react-dom/client';
import './globals.css';
import { App } from './components/App';
import { Events } from '../analytics/events';

// Defer analytics so PostHog doesn't block initial render
import('../analytics/posthog').then(({ capture }) =>
  capture(Events.POPUP_OPENED)
);
import('../analytics/identify').then(({ tryIdentify }) =>
  tryIdentify().catch(() => {})
);

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<App />);
}
