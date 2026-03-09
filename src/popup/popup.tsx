import React from 'react';
import { createRoot } from 'react-dom/client';
import './globals.css';
import { App } from './components/App';

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<App />);
}
