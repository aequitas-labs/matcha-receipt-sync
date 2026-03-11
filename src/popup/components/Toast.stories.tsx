import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { showToast } from '../../content/toast';
import { Button } from './ui/Button';

function ToastDemo() {
  return (
    <div className="space-y-3 p-4">
      <h2 className="font-sans text-sm font-semibold text-foreground mb-2">
        Toast Notifications
      </h2>
      <p className="text-xs text-muted-foreground mb-4">
        Branded toasts shown on retailer pages during sync. Click to preview.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={() => showToast('Found 12 order(s) from Amazon', 'success')}
        >
          Success
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => showToast('Scanning Amazon orders (page 1)...', 'info')}
        >
          Info
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={() =>
            showToast('Session expired. Please log in to Amazon and try again.', 'error')
          }
        >
          Error
        </Button>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => showToast('No new Costco orders found', 'info')}
        >
          No orders
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            showToast(
              'Found 3 order(s) from Walmart. Fetching invoices...',
              'success'
            )
          }
        >
          Multiple
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={() =>
            showToast('No Costco auth tokens found. Please log in to costco.com first.', 'error')
          }
        >
          Auth error
        </Button>
      </div>
    </div>
  );
}

const meta: Meta<typeof ToastDemo> = {
  title: 'Components/Toast',
  component: ToastDemo,
};

export default meta;
type Story = StoryObj<typeof ToastDemo>;

export const Default: Story = {};
