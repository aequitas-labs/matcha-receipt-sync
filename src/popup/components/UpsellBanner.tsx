import React, { useEffect, useState } from 'react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

interface UpsellBannerViewProps {
  onDismiss: () => void;
  onSignup: () => void;
  onLogin: () => void;
}

export function UpsellBannerView({
  onDismiss,
  onSignup,
  onLogin,
}: UpsellBannerViewProps) {
  return (
    <Card className="mb-3 bg-primary-bg border-primary/20 animate-fade-in">
      <div className="flex items-start justify-between">
        <h3 className="font-sans font-semibold text-sm text-foreground">
          Track your receipts automatically
        </h3>
        <button
          onClick={onDismiss}
          className="text-muted-foreground hover:text-foreground text-xs cursor-pointer"
        >
          ✕
        </button>
      </div>
      <p className="text-xs text-muted-foreground mt-1 mb-3">
        Know exactly where your money goes. matcha money builds your budget
        automatically from real bank and purchase data.
      </p>
      <div className="flex gap-2">
        <Button variant="primary" size="sm" onClick={onSignup}>
          Create Account
        </Button>
        <Button variant="secondary" size="sm" onClick={onLogin}>
          Log In
        </Button>
      </div>
    </Card>
  );
}

const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function UpsellBanner() {
  const [dismissed, setDismissed] = useState(true); // hidden by default until we check

  useEffect(() => {
    chrome.storage.local.get(['upsellDismissedAt'], (result) => {
      if (result.upsellDismissedAt) {
        const elapsed = Date.now() - result.upsellDismissedAt;
        setDismissed(elapsed < DISMISS_DURATION_MS);
      } else {
        setDismissed(false);
      }
    });
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    chrome.storage.local.set({ upsellDismissedAt: Date.now() });
  };

  if (dismissed) return null;

  return (
    <UpsellBannerView
      onDismiss={handleDismiss}
      onSignup={() =>
        chrome.tabs.create({ url: 'https://matcha.money/sign-up' })
      }
      onLogin={() =>
        chrome.tabs.create({ url: 'https://matcha.money/sign-in' })
      }
    />
  );
}
