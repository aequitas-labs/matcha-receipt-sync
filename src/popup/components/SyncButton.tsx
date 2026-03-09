import React from 'react';
import { Button } from './ui/Button';
import { RefreshCw } from './ui/Icons';

interface Props {
  loading: boolean;
  onClick: () => void;
}

export function SyncButton({ loading, onClick }: Props) {
  return (
    <Button
      variant="primary"
      className="w-full mb-3"
      loading={loading}
      onClick={onClick}
    >
      {!loading && <RefreshCw size={14} />}
      {loading ? 'Syncing All...' : 'Sync All'}
    </Button>
  );
}
