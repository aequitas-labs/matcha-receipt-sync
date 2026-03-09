import React from 'react';
import { Button } from './ui/Button';
import { RefreshCw } from './ui/Icons';

interface Props {
  loading: boolean;
  activeCount?: number;
  onClick: () => void;
}

export function SyncButton({ loading, activeCount, onClick }: Props) {
  const label = loading
    ? activeCount && activeCount > 1
      ? `Syncing (${activeCount})...`
      : 'Syncing...'
    : 'Sync All';

  return (
    <Button
      variant="primary"
      className="w-full mb-3"
      loading={loading}
      onClick={onClick}
    >
      {!loading && <RefreshCw size={14} />}
      {label}
    </Button>
  );
}
