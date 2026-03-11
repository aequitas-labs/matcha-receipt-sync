import React from 'react';
import type { Preview } from '@storybook/react-webpack5';
import '../src/popup/globals.css';

// Mock chrome APIs for Storybook
if (typeof globalThis.chrome === 'undefined') {
  (globalThis as unknown as Record<string, unknown>).chrome = {
    runtime: {
      sendMessage: (_msg: unknown, cb?: (r: unknown) => void) => cb?.({}),
      getURL: (path: string) => `chrome-extension://mock/${path}`,
    },
    storage: {
      local: {
        get: (_keys: unknown, cb?: (r: Record<string, unknown>) => void) =>
          cb?.({}),
        set: (_data: unknown, cb?: () => void) => cb?.(),
        remove: (_keys: unknown, cb?: () => void) => cb?.(),
      },
    },
    alarms: {
      clear: (_name: unknown, cb?: () => void) => cb?.(),
      create: () => {},
    },
    tabs: {
      create: () => {},
    },
    windows: {
      create: () => {},
    },
  };
}

const preview: Preview = {
  decorators: [
    (Story) => (
      <div
        style={{
          width: 360,
          minHeight: 200,
          background: 'var(--background)',
          color: 'var(--foreground)',
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export default preview;
