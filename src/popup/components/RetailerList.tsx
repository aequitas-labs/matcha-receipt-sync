import React from 'react';
import type { SyncStatusMap } from '../../types/messages';
import { RETAILERS } from '../constants';
import { RetailerCard } from './RetailerCard';

interface Props {
  status: SyncStatusMap;
  syncingRetailers: Set<string>;
  enabledRetailers: Set<string>;
  onSyncRetailer: (retailerId: string) => void;
}

export function RetailerList({
  status,
  syncingRetailers,
  enabledRetailers,
  onSyncRetailer,
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
              syncing={syncingRetailers.has(r.id)}
              onSync={onSyncRetailer}
            />
          ))
        )}
      </div>
    </div>
  );
}
