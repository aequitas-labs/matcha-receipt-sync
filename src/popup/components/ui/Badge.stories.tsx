import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { Badge } from './Badge';

const meta: Meta<typeof Badge> = {
  title: 'UI/Badge',
  component: Badge,
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Success: Story = {
  args: { variant: 'success', children: 'Connected' },
};

export const Error: Story = {
  args: { variant: 'error', children: 'Failed' },
};

export const Warning: Story = {
  args: { variant: 'warning', children: 'Dev' },
};

export const Muted: Story = {
  args: { variant: 'muted', children: '42 txns' },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2 p-4">
      <Badge variant="success">Connected</Badge>
      <Badge variant="error">Failed</Badge>
      <Badge variant="warning">Dev</Badge>
      <Badge variant="muted">42 txns</Badge>
    </div>
  ),
};
