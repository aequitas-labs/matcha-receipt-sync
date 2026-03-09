import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { UpsellBannerView } from './UpsellBanner';

const meta: Meta<typeof UpsellBannerView> = {
  title: 'Components/UpsellBanner',
  component: UpsellBannerView,
  args: {
    onDismiss: () => {},
    onSignup: () => {},
    onLogin: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof UpsellBannerView>;

export const Default: Story = {};
