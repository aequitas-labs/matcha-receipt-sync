import React from 'react';
import { createRoot } from 'react-dom/client';
import './globals.css';
import { App } from './components/App';
import { capture } from '../analytics/posthog';
import { tryIdentify } from '../analytics/identify';
import { Events } from '../analytics/events';

capture(Events.POPUP_OPENED);
tryIdentify().catch(() => {});

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<App />);
}
