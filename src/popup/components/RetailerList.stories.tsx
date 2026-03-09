import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { RetailerList } from './RetailerList';

const meta: Meta<typeof RetailerList> = {
  title: 'Components/RetailerList',
  component: RetailerList,
  args: {
    syncingRetailers: new Set(),
    enabledRetailers: new Set(['amazon', 'costco', 'walmart', 'target']),
    onSyncRetailer: () => {},
    onRetailerClick: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof RetailerList>;

export const Empty: Story = {
  args: { status: {} },
};

export const AllSynced: Story = {
  args: {
    status: {
      amazon: { retailerId: 'amazon', retailerName: 'Amazon', lastSyncedAt: new Date(Date.now() - 60000 * 10).toISOString(), transactionCount: 12, lastError: null },
      costco: { retailerId: 'costco', retailerName: 'Costco', lastSyncedAt: new Date(Date.now() - 60000 * 45).toISOString(), transactionCount: 4, lastError: null },
      walmart: { retailerId: 'walmart', retailerName: 'Walmart', lastSyncedAt: new Date(Date.now() - 60000 * 120).toISOString(), transactionCount: 9, lastError: null },
      target: { retailerId: 'target', retailerName: 'Target', lastSyncedAt: new Date(Date.now() - 60000 * 5).toISOString(), transactionCount: 2, lastError: null },
    },
  },
};

export const WithErrors: Story = {
  args: {
    status: {
      amazon: { retailerId: 'amazon', retailerName: 'Amazon', lastSyncedAt: new Date(Date.now() - 60000 * 30).toISOString(), transactionCount: 8, lastError: 'Session expired. Please log in.' },
      walmart: { retailerId: 'walmart', retailerName: 'Walmart', lastSyncedAt: new Date(Date.now() - 60000 * 90).toISOString(), transactionCount: 3, lastError: 'Scraping timeout after 30s' },
    },
  },
};

export const SyncingOne: Story = {
  args: {
    status: {
      amazon: { retailerId: 'amazon', retailerName: 'Amazon', lastSyncedAt: new Date(Date.now() - 60000 * 10).toISOString(), transactionCount: 12, lastError: null },
    },
    syncingRetailers: new Set(['amazon']),
  },
};
