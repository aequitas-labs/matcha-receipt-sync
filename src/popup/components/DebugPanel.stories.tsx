import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { DebugPanelView } from './DebugPanel';
import type { DebugLogEntry } from '../../types/messages';

const mockEntries: DebugLogEntry[] = [
  {
    timestamp: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    method: 'POST',
    endpoint: '/api/v1/transactions/batch',
    payload: { count: 3, retailer: 'amazon' },
    response: { created: 3 },
    error: undefined,
  },
  {
    timestamp: new Date(Date.now() - 1000 * 30).toISOString(),
    method: 'POST',
    endpoint: '/api/v1/transactions/batch',
    payload: { count: 1, retailer: 'costco' },
    response: undefined,
    error: 'Network error: Failed to fetch',
  },
  {
    timestamp: new Date().toISOString(),
    method: 'GET',
    endpoint: '/api/v1/session',
    payload: {},
    response: { connected: true, userId: 'usr_abc123' },
    error: undefined,
  },
];

const meta: Meta<typeof DebugPanelView> = {
  title: 'Components/DebugPanel',
  component: DebugPanelView,
  args: {
    onExpand: () => {},
    onClear: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof DebugPanelView>;

export const Collapsed: Story = {
  args: { entries: [] },
};

export const WithLogs: Story = {
  args: { entries: mockEntries },
};

export const Empty: Story = {
  args: { entries: [] },
  // Same as Collapsed but expanded — click the toggle to see "No API requests logged yet"
};
