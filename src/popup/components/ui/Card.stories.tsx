import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { Card } from './Card';
import { Badge } from './Badge';
import { StatusDot } from './StatusDot';

const meta: Meta<typeof Card> = {
  title: 'UI/Card',
  component: Card,
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  args: {
    children: (
      <div>
        <h3 className="font-sans font-semibold text-sm">Amazon</h3>
        <p className="text-xs text-muted-foreground mt-1">Last sync: 2h ago</p>
      </div>
    ),
  },
};

export const Raised: Story = {
  args: {
    variant: 'raised',
    children: (
      <div>
        <h3 className="font-sans font-semibold text-sm">Walmart</h3>
        <p className="text-xs text-muted-foreground mt-1">4 transactions</p>
      </div>
    ),
  },
};

export const WithBadgesAndDots: Story = {
  render: () => (
    <div className="flex flex-col gap-2 p-4">
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>📦</span>
            <span className="font-sans font-semibold text-sm">Amazon</span>
            <StatusDot variant="success" />
          </div>
          <Badge variant="success">12 txns</Badge>
        </div>
      </Card>
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>🏪</span>
            <span className="font-sans font-semibold text-sm">Costco</span>
            <StatusDot variant="error" />
          </div>
          <Badge variant="error">Error</Badge>
        </div>
      </Card>
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>🎯</span>
            <span className="font-sans font-semibold text-sm">Target</span>
            <StatusDot variant="idle" />
          </div>
          <Badge variant="muted">Never synced</Badge>
        </div>
      </Card>
    </div>
  ),
};
