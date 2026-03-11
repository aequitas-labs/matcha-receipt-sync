import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { ConnectionStatus } from './ConnectionStatus';

const meta: Meta<typeof ConnectionStatus> = {
  title: 'Components/ConnectionStatus',
  component: ConnectionStatus,
};

export default meta;
type Story = StoryObj<typeof ConnectionStatus>;

export const Connected: Story = {
  args: { connected: true, useFakeApi: false },
};

export const Checking: Story = {
  args: { connected: null, useFakeApi: false },
};

export const Disconnected: Story = {
  args: { connected: false, useFakeApi: false },
  // Returns null — nothing rendered (UpsellBanner handles this state)
};

export const DevMode: Story = {
  args: { connected: true, useFakeApi: true },
};
