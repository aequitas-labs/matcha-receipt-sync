import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { variant: 'primary', children: 'Sync Now' },
};

export const Secondary: Story = {
  args: { variant: 'secondary', children: 'Export' },
};

export const Danger: Story = {
  args: { variant: 'danger', children: 'Clear Data' },
};

export const Ghost: Story = {
  args: { variant: 'ghost', children: 'Settings' },
};

export const Small: Story = {
  args: { variant: 'secondary', size: 'sm', children: 'Sync' },
};

export const Loading: Story = {
  args: { variant: 'primary', loading: true, children: 'Syncing...' },
};

export const Disabled: Story = {
  args: { variant: 'primary', disabled: true, children: 'Disabled' },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-2 p-4">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="danger">Danger</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="primary" size="sm">
        Small Primary
      </Button>
      <Button variant="primary" loading>
        Loading
      </Button>
    </div>
  ),
};
