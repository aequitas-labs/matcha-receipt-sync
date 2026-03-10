import React from 'react';
import type { RetailerConfig } from '../constants';
import type { RetailerSyncStatus, SyncProgress } from '../../types/messages';
import { Card } from './ui/Card';
import { StatusDot } from './ui/StatusDot';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { RefreshCw, AlertCircle } from './ui/Icons';
import { timeAgo } from '../../utils/date';

interface RetailerCardProps {
  retailer: RetailerConfig;
  status?: RetailerSyncStatus;
  syncing: boolean;
  progress?: SyncProgress;
  onSync: (retailerId: string) => void;
  onClick?: (retailerId: string) => void;
}

const AUTH_ERROR_PATTERNS = [/log\s*in/i, /session\s*expired/i, /auth\s*token/i, /please\s*sign\s*in/i];

function isAuthError(error: string | null): boolean {
  if (!error) return false;
  return AUTH_ERROR_PATTERNS.some((p) => p.test(error));
}

export function RetailerCard({
  retailer,
  status,
  syncing,
  progress,
  onSync,
  onClick,
}: RetailerCardProps) {
  const hasSynced = !!status?.lastSyncedAt;
  const hasError = !!status?.lastError;
  const needsLogin = isAuthError(status?.lastError ?? null);

  const dotVariant = hasError ? 'error' : hasSynced ? 'success' : 'idle';

  return (
    <Card
      className={`animate-fade-in ${onClick ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}`}
      onClick={onClick ? () => onClick(retailer.id) : undefined}
    >
      {/* Row 1: Icon + Name + Status */}
      <div className="flex items-center gap-2">
        <span className="text-base">{retailer.icon}</span>
        <span className="font-sans font-semibold text-sm text-foreground">
          {retailer.name}
        </span>
        <StatusDot variant={dotVariant} />
        <div className="ml-auto flex items-center gap-2">
          {hasSynced && (
            <Badge variant="muted">{status!.transactionCount} receipts</Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            loading={false}
            disabled={syncing}
            onClick={(e) => {
              e.stopPropagation();
              onSync(retailer.id);
            }}
            title={`Sync ${retailer.name}`}
          >
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {/* Row 2: Progress, "Syncing...", or last sync time */}
      {progress ? (
        <div className="mt-1.5">
          <div className="text-xs text-muted-foreground mb-1">
            {progress.message ?? (progress.phase === 'fetching'
              ? `${progress.current}/${progress.total} orders`
              : progress.phase === 'pushing'
              ? 'Saving to matcha...'
              : 'Scanning...')}
          </div>
          <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
            {progress.phase === 'fetching' && progress.total > 0 ? (
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
              />
            ) : (
              <div className="h-full bg-primary/60 rounded-full animate-pulse w-full" />
            )}
          </div>
        </div>
      ) : syncing ? (
        <div className="mt-1 text-xs text-muted-foreground">Syncing...</div>
      ) : (
        <div className="mt-1 text-xs text-muted-foreground">
          {hasSynced
            ? `Last sync: ${timeAgo(status!.lastSyncedAt!)}`
            : 'Never synced'}
        </div>
      )}

      {/* Row 3: Error (if any) */}
      {hasError && (
        <div className="mt-1.5 flex items-start gap-1 text-xs text-destructive bg-destructive-bg rounded px-2 py-1">
          <AlertCircle size={12} className="shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="line-clamp-2">{status!.lastError}</span>
            {needsLogin && (
              <button
                onClick={() => chrome.tabs.create({ url: retailer.url, active: true })}
                className="text-primary hover:underline cursor-pointer mt-0.5 block"
              >
                Log in to {retailer.name} &rarr;
              </button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
