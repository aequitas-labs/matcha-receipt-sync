import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { SettingsPanelView } from './SettingsPanel';

const meta: Meta<typeof SettingsPanelView> = {
  title: 'Components/SettingsPanel',
  component: SettingsPanelView,
  args: {
    syncFromDate: '',
    syncInterval: 24,
    lastMatchaSync: null,
    connected: true,
    devMode: false,
    budgetStartMonth: null,
    enabledRetailers: new Set(['amazon', 'costco', 'walmart', 'target']),
    onBack: () => {},
    onSyncFromDateChange: () => {},
    onIntervalChange: () => {},
    onDevModeToggle: () => {},
    onRetailerToggle: () => {},
    onClearData: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof SettingsPanelView>;

export const Default: Story = {};

export const DevMode: Story = {
  args: { devMode: true, syncInterval: 24 },
};

export const WithSyncDate: Story = {
  args: {
    syncFromDate: '2025-01-01',
    syncInterval: 12,
    lastMatchaSync: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
};

export const WithBudgetStartMonth: Story = {
  args: {
    budgetStartMonth: '2025-01',
    syncFromDate: '',
  },
};

export const NotConnected: Story = {
  args: {
    connected: false,
  },
};

export const NotConnectedDevMode: Story = {
  args: {
    connected: false,
    devMode: true,
  },
};

export const ManualOnly: Story = {
  args: {
    syncInterval: 0,
  },
};

export const SomeRetailersDisabled: Story = {
  args: {
    enabledRetailers: new Set(['amazon', 'target']),
  },
};
