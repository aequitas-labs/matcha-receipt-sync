import React, { useEffect, useState } from 'react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { ChevronDown } from './ui/Icons';
import { DebugPanel } from './DebugPanel';
import { RETAILERS } from '../constants';

const INTERVAL_OPTIONS = [
  { label: 'Daily', value: 24 },
  { label: 'Weekly', value: 168 },
  { label: 'Manual only', value: 0 },
];

export interface SettingsPanelViewProps {
  syncFromDate: string;
  syncInterval: number;
  lastMatchaSync: string | null;
  connected: boolean | null;
  devMode: boolean;
  budgetStartMonth: string | null;
  enabledRetailers: Set<string>;
  onBack: () => void;
  onSyncFromDateChange: (value: string) => void;
  onIntervalChange: (value: number) => void;
  onDevModeToggle: (checked: boolean) => void;
  onRetailerToggle: (retailerId: string, enabled: boolean) => void;
  onClearData: () => void;
}

export function SettingsPanelView({
  syncFromDate,
  syncInterval,
  lastMatchaSync,
  connected,
  devMode,
  budgetStartMonth,
  enabledRetailers,
  onBack,
  onSyncFromDateChange,
  onIntervalChange,
  onDevModeToggle,
  onRetailerToggle,
  onClearData,
}: SettingsPanelViewProps) {
  const [confirmClear, setConfirmClear] = useState(false);

  const handleClearData = () => {
    onClearData();
    setConfirmClear(false);
  };

  return (
    <div className="animate-fade-in">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3 cursor-pointer"
      >
        <ChevronDown size={12} className="rotate-90" />
        Back
      </button>

      <h2 className="font-sans text-sm font-semibold text-foreground mb-3">
        Settings
      </h2>

      <div className="space-y-3">
        {/* Sync start date */}
        <Card>
          <label className="block text-xs font-medium text-foreground mb-1">
            Sync from date
          </label>
          <input
            type="date"
            value={syncFromDate}
            onChange={(e) => onSyncFromDateChange(e.target.value)}
            className="w-full text-xs bg-muted border border-border rounded-md px-2 py-1.5 text-foreground"
          />
          {budgetStartMonth && !syncFromDate && (
            <p className="text-[10px] text-muted-foreground mt-1">
              Using budget start month: {budgetStartMonth}
            </p>
          )}
          <p className="text-[10px] text-muted-foreground mt-1">
            Only sync orders placed after this date
          </p>
        </Card>

        {/* Sync interval */}
        <Card>
          <label className="block text-xs font-medium text-foreground mb-1">
            Auto-sync interval
          </label>
          <select
            value={syncInterval}
            onChange={(e) => onIntervalChange(Number(e.target.value))}
            className="w-full text-xs bg-muted border border-border rounded-md px-2 py-1.5 text-foreground cursor-pointer"
          >
            {INTERVAL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Card>

        {/* Enabled retailers */}
        <Card>
          <label className="block text-xs font-medium text-foreground mb-1.5">
            Retailers
          </label>
          <div className="space-y-1.5">
            {RETAILERS.map((r) => (
              <label key={r.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabledRetailers.has(r.id)}
                  onChange={(e) => onRetailerToggle(r.id, e.target.checked)}
                  className="rounded border-border accent-primary"
                />
                <span className="text-xs text-foreground">
                  {r.icon} {r.name}
                </span>
              </label>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            Disabled retailers are skipped during sync
          </p>
        </Card>

        {/* Last matcha money sync / upsell */}
        <Card>
          <label className="block text-xs font-medium text-foreground mb-1">
            matcha money sync
          </label>
          {connected === false && !devMode ? (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                Connect to matcha money to automatically sync receipts as
                transactions.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() =>
                    chrome.tabs.create({
                      url: 'https://matcha.money/register',
                    })
                  }
                >
                  Create Account
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    chrome.tabs.create({ url: 'https://matcha.money/login' })
                  }
                >
                  Log In
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {lastMatchaSync
                ? `Last synced ${new Date(lastMatchaSync).toLocaleString()}`
                : 'Never synced'}
            </p>
          )}
        </Card>

        {/* Dev mode */}
        <Card>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={devMode}
              onChange={(e) => onDevModeToggle(e.target.checked)}
              className="rounded border-border accent-primary"
            />
            <span className="text-xs font-medium text-foreground">
              Dev mode
            </span>
          </label>
          <p className="text-[10px] text-muted-foreground mt-1">
            Log transactions locally instead of pushing to matcha money
          </p>
        </Card>

        {/* Clear data */}
        <Card>
          {!confirmClear ? (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setConfirmClear(true)}
            >
              Clear all local data
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-destructive">
                This will delete all locally stored receipts and sync status.
                Are you sure?
              </p>
              <div className="flex gap-2">
                <Button variant="danger" size="sm" onClick={handleClearData}>
                  Confirm
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setConfirmClear(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Debug log */}
        <DebugPanel />
      </div>
    </div>
  );
}

interface SettingsPanelProps {
  useFakeApi: boolean;
  connected: boolean | null;
  onBack: () => void;
}

const ALL_RETAILER_IDS = RETAILERS.map((r) => r.id);

export function SettingsPanel({ useFakeApi, connected, onBack }: SettingsPanelProps) {
  const [syncFromDate, setSyncFromDate] = useState('');
  const [syncInterval, setSyncInterval] = useState(24);
  const [lastMatchaSync, setLastMatchaSync] = useState<string | null>(null);
  const [devMode, setDevMode] = useState(useFakeApi);
  const [budgetStartMonth, setBudgetStartMonth] = useState<string | null>(null);
  const [enabledRetailers, setEnabledRetailers] = useState<Set<string>>(new Set(ALL_RETAILER_IDS));

  useEffect(() => {
    chrome.storage.local.get(
      ['syncFromDate', 'lastSuccessfulMatchaSync', 'syncIntervalHours', 'useFakeApi', 'enabledRetailers'],
      (result) => {
        if (result.syncFromDate) setSyncFromDate(result.syncFromDate);
        if (result.lastSuccessfulMatchaSync) setLastMatchaSync(result.lastSuccessfulMatchaSync);
        if (result.syncIntervalHours) setSyncInterval(result.syncIntervalHours);
        setDevMode(result.useFakeApi !== false);
        if (result.enabledRetailers) {
          setEnabledRetailers(new Set(result.enabledRetailers));
        }
      }
    );
    fetchBudgetStartMonth();
  }, []);

  const fetchBudgetStartMonth = async () => {
    try {
      const { useFakeApi: isFake } = await chrome.storage.local.get('useFakeApi');
      if (isFake !== false) return;
      const { apiBaseUrl = 'https://matcha.money' } = await chrome.storage.local.get('apiBaseUrl');
      const response = await fetch(`${apiBaseUrl}/api/v1/budget/start-month`, { credentials: 'include' });
      if (response.ok) {
        const data = (await response.json()) as { startMonth: string };
        setBudgetStartMonth(data.startMonth);
      }
    } catch {
      // Not connected or endpoint unavailable
    }
  };

  const handleSyncFromDateChange = (value: string) => {
    setSyncFromDate(value);
    chrome.storage.local.set({ syncFromDate: value || null });
  };

  const handleIntervalChange = (value: number) => {
    setSyncInterval(value);
    chrome.storage.local.set({ syncIntervalHours: value });
    if (value === 0) {
      // Manual only — remove the alarm entirely
      chrome.alarms.clear('matcha-receipt-sync');
    } else {
      chrome.alarms.clear('matcha-receipt-sync', () => {
        chrome.alarms.create('matcha-receipt-sync', {
          periodInMinutes: value * 60,
          delayInMinutes: value * 60,
        });
      });
    }
  };

  const handleRetailerToggle = (retailerId: string, enabled: boolean) => {
    setEnabledRetailers((prev) => {
      const next = new Set(prev);
      if (enabled) {
        next.add(retailerId);
      } else {
        next.delete(retailerId);
      }
      chrome.storage.local.set({ enabledRetailers: [...next] });
      return next;
    });
  };

  const handleDevModeToggle = (checked: boolean) => {
    setDevMode(checked);
    chrome.storage.local.set({ useFakeApi: checked });
  };

  const handleClearData = async () => {
    await chrome.storage.local.remove([
      'scrapedReceipts',
      'syncStatus',
      'cursors',
      'debugLog',
      'lastSuccessfulMatchaSync',
      'upsellDismissedAt',
      'costcoTokens',
    ]);
  };

  return (
    <SettingsPanelView
      syncFromDate={syncFromDate}
      syncInterval={syncInterval}
      lastMatchaSync={lastMatchaSync}
      connected={connected}
      devMode={devMode}
      budgetStartMonth={budgetStartMonth}
      enabledRetailers={enabledRetailers}
      onBack={onBack}
      onSyncFromDateChange={handleSyncFromDateChange}
      onIntervalChange={handleIntervalChange}
      onDevModeToggle={handleDevModeToggle}
      onRetailerToggle={handleRetailerToggle}
      onClearData={handleClearData}
    />
  );
}
