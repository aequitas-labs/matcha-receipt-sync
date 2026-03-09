import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { SyncButton } from './SyncButton';

const meta: Meta<typeof SyncButton> = {
  title: 'Components/SyncButton',
  component: SyncButton,
  args: { onClick: () => {} },
};

export default meta;
type Story = StoryObj<typeof SyncButton>;

export const Default: Story = {
  args: { loading: false },
};

export const Loading: Story = {
  args: { loading: true },
};
