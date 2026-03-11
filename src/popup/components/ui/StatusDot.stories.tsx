import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { StatusDot } from './StatusDot';

const meta: Meta<typeof StatusDot> = {
  title: 'UI/StatusDot',
  component: StatusDot,
};

export default meta;
type Story = StoryObj<typeof StatusDot>;

export const Success: Story = {
  args: { variant: 'success' },
};

export const Error: Story = {
  args: { variant: 'error' },
};

export const Idle: Story = {
  args: { variant: 'idle' },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex items-center gap-4 p-4">
      <div className="flex items-center gap-1.5">
        <StatusDot variant="success" />
        <span className="text-xs">Success</span>
      </div>
      <div className="flex items-center gap-1.5">
        <StatusDot variant="error" />
        <span className="text-xs">Error</span>
      </div>
      <div className="flex items-center gap-1.5">
        <StatusDot variant="idle" />
        <span className="text-xs">Idle</span>
      </div>
    </div>
  ),
};
