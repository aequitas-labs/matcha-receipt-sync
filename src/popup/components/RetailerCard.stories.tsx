import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { RetailerCard } from './RetailerCard';

const AMAZON = { id: 'amazon', name: 'Amazon', icon: '📦', url: 'https://amazon.com' };

const meta: Meta<typeof RetailerCard> = {
  title: 'Components/RetailerCard',
  component: RetailerCard,
  args: {
    retailer: AMAZON,
    syncing: false,
    onSync: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof RetailerCard>;

export const NeverSynced: Story = {
  args: { status: undefined },
};

export const Synced: Story = {
  args: {
    status: {
      retailerId: 'amazon', retailerName: 'Amazon',
      lastSyncedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      transactionCount: 12,
      lastError: null,
    },
  },
};

export const WithError: Story = {
  args: {
    status: {
      retailerId: 'amazon', retailerName: 'Amazon',
      lastSyncedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      transactionCount: 5,
      lastError: 'Session expired. Please log in to Amazon and try again.',
    },
  },
};

export const Syncing: Story = {
  args: {
    syncing: true,
    status: {
      retailerId: 'amazon', retailerName: 'Amazon',
      lastSyncedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      transactionCount: 8,
      lastError: null,
    },
  },
};

export const AuthError: Story = {
  args: {
    status: {
      retailerId: 'amazon', retailerName: 'Amazon',
      lastSyncedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      transactionCount: 5,
      lastError: 'No order cards found. Please log in to Amazon and try again.',
    },
  },
};

export const AllRetailers: Story = {
  render: () => {
    const retailers = [
      { id: 'amazon', name: 'Amazon', icon: '📦', url: '' },
      { id: 'costco', name: 'Costco', icon: '🏪', url: '' },
      { id: 'walmart', name: 'Walmart', icon: '🛒', url: '' },
      { id: 'target', name: 'Target', icon: '🎯', url: '' },
    ];
    const statuses = [
      undefined,
      { retailerId: 'costco', retailerName: 'Costco', lastSyncedAt: new Date(Date.now() - 60000 * 30).toISOString(), transactionCount: 7, lastError: null },
      { retailerId: 'walmart', retailerName: 'Walmart', lastSyncedAt: new Date(Date.now() - 60000 * 120).toISOString(), transactionCount: 3, lastError: 'Network error' },
      { retailerId: 'target', retailerName: 'Target', lastSyncedAt: new Date(Date.now() - 60000 * 5).toISOString(), transactionCount: 21, lastError: null },
    ];
    return (
      <div className="flex flex-col gap-2 p-4">
        {retailers.map((r, i) => (
          <RetailerCard key={r.id} retailer={r} status={statuses[i]} syncing={false} onSync={() => {}} />
        ))}
      </div>
    );
  },
};
