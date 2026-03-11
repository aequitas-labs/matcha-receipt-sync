import React from 'react';
import { Check } from './ui/Icons';

interface Props {
  connected: boolean | null;
  useFakeApi: boolean;
}

export function ConnectionStatus({ connected, useFakeApi }: Props) {
  if (useFakeApi) {
    return (
      <div className="rounded-lg px-3 py-2 mb-3 bg-warning-bg text-xs text-muted-foreground">
        Dev mode — transactions logged locally for debugging
      </div>
    );
  }

  if (connected === null) {
    return (
      <div className="px-3 py-2 mb-3 text-xs text-muted-foreground">
        Checking connection...
      </div>
    );
  }

  if (connected) {
    return (
      <div className="rounded-lg px-3 py-2 mb-3 bg-success-bg text-xs text-success flex items-center gap-1.5">
        <Check size={12} />
        Connected to matcha money
      </div>
    );
  }

  return null; // UpsellBanner handles the not-connected state
}
