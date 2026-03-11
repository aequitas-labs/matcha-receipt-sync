import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { OnboardingViewPresentation } from './OnboardingView';

const noop = () => {};

const meta: Meta<typeof OnboardingViewPresentation> = {
  title: 'Components/OnboardingView',
  component: OnboardingViewPresentation,
  args: {
    step: 'welcome',
    selectedRetailers: new Set(['amazon', 'costco', 'walmart', 'target']),
    loginStatus: {},
    matchaConnected: null,
    syncFromDate: '2025-03-10',
    onStepChange: noop,
    onRetailerToggle: noop,
    onSyncFromDateChange: noop,
    onLoginRecheck: noop,
    onMatchaRecheck: noop,
    onOpenUrl: noop,
    onComplete: noop,
    onSkip: noop,
  },
};

export default meta;
type Story = StoryObj<typeof OnboardingViewPresentation>;

export const Welcome: Story = {};

export const RetailerSelection: Story = {
  args: { step: 'retailers' },
};

export const RetailerSelectionPartial: Story = {
  args: {
    step: 'retailers',
    selectedRetailers: new Set(['amazon', 'target']),
  },
};

export const RetailerSelectionEmpty: Story = {
  args: {
    step: 'retailers',
    selectedRetailers: new Set(),
  },
};

export const LoginCheckChecking: Story = {
  args: {
    step: 'login-check',
    loginStatus: {
      amazon: 'checking',
      costco: 'checking',
      walmart: 'checking',
      target: 'checking',
    },
  },
};

export const LoginCheckMixed: Story = {
  args: {
    step: 'login-check',
    loginStatus: {
      amazon: 'logged-in',
      costco: 'logged-in',
      walmart: 'not-logged-in',
      target: 'not-logged-in',
    },
  },
};

export const LoginCheckAllLoggedIn: Story = {
  args: {
    step: 'login-check',
    loginStatus: {
      amazon: 'logged-in',
      costco: 'logged-in',
      walmart: 'logged-in',
      target: 'logged-in',
    },
  },
};

export const LoginCheckAllFailed: Story = {
  args: {
    step: 'login-check',
    loginStatus: {
      amazon: 'not-logged-in',
      costco: 'not-logged-in',
      walmart: 'not-logged-in',
      target: 'not-logged-in',
    },
  },
};

export const MatchaCheckLoading: Story = {
  args: {
    step: 'matcha-check',
    matchaConnected: null,
  },
};

export const MatchaCheckConnected: Story = {
  args: {
    step: 'matcha-check',
    matchaConnected: true,
  },
};

export const MatchaCheckNotConnected: Story = {
  args: {
    step: 'matcha-check',
    matchaConnected: false,
  },
};

export const SyncDate: Story = {
  args: {
    step: 'sync-date',
    syncFromDate: '2025-03-10',
  },
};

export const ReadyConnected: Story = {
  args: {
    step: 'ready',
    matchaConnected: true,
    syncFromDate: '2025-03-10',
  },
};

export const ReadyNotConnected: Story = {
  args: {
    step: 'ready',
    matchaConnected: false,
    syncFromDate: '2025-03-10',
  },
};

export const ReadyPartialRetailers: Story = {
  args: {
    step: 'ready',
    selectedRetailers: new Set(['amazon']),
    matchaConnected: true,
    syncFromDate: '2025-06-01',
  },
};
