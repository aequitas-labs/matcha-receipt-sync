import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { Header } from './Header';

const meta: Meta<typeof Header> = {
  title: 'Components/Header',
  component: Header,
  args: {
    onOpenInWindow: () => {},
    onToggleSettings: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof Header>;

export const Default: Story = {
  args: { useFakeApi: false },
};

export const DevMode: Story = {
  args: { useFakeApi: true },
};
