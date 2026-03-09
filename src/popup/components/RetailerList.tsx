import React from 'react';
import type { SyncStatusMap, SyncProgress } from '../../types/messages';
import { RETAILERS } from '../constants';
import { RetailerCard } from './RetailerCard';

interface Props {
  status: SyncStatusMap;
  syncingRetailers: Set<string>;
  syncProgress: Record<string, SyncProgress>;
  enabledRetailers: Set<string>;
  onSyncRetailer: (retailerId: string) => void;
  onRetailerClick?: (retailerId: string) => void;
}

export function RetailerList({
  status,
  syncingRetailers,
  syncProgress,
  enabledRetailers,
  onSyncRetailer,
  onRetailerClick,
}: Props) {
  const visible = RETAILERS.filter((r) => enabledRetailers.has(r.id));

  return (
    <div className="mb-3">
      <h2 className="font-sans text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        Retailers
      </h2>
      <div className="flex flex-col gap-2">
        {visible.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            No retailers enabled. Enable them in Settings.
          </p>
        ) : (
          visible.map((r) => (
            <RetailerCard
              key={r.id}
              retailer={r}
              status={status[r.id]}
              syncing={syncingRetailers.has(r.id) || !!syncProgress[r.id]}
              progress={syncProgress[r.id]}
              onSync={onSyncRetailer}
              onClick={onRetailerClick}
            />
          ))
        )}
      </div>
    </div>
  );
}
