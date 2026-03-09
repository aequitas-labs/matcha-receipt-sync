import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { ExportPanelView } from './ExportPanel';

const meta: Meta<typeof ExportPanelView> = {
  title: 'Components/ExportPanel',
  component: ExportPanelView,
  args: {
    onExportJSON: () => {},
    onExportCSV: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof ExportPanelView>;

export const NoReceipts: Story = {
  args: { count: 0 },
};

export const WithReceipts: Story = {
  args: { count: 47 },
};

export const OneReceipt: Story = {
  args: { count: 1 },
};
