import React, { useEffect, useState, Suspense, lazy } from 'react';
import { Header } from './Header';
import { ConnectionStatus } from './ConnectionStatus';
import { UpsellBanner } from './UpsellBanner';
import { RetailerList } from './RetailerList';
import { SyncButton } from './SyncButton';
import { ExportPanel } from './ExportPanel';

const SettingsPanel = lazy(() => import('./SettingsPanel').then((m) => ({ default: m.SettingsPanel })));
const RetailerDetail = lazy(() => import('./RetailerDetail').then((m) => ({ default: m.RetailerDetail })));
import { OnboardingView } from './OnboardingView';
import type { SyncStatusMap, SyncProgress } from '../../types/messages';
import { checkSession } from '../../auth/session';
import { RETAILERS } from '../constants';

type View = 'main' | 'settings' | 'retailer-detail';

const ALL_RETAILER_IDS = new Set(RETAILERS.map((r) => r.id));

export function App() {
  const isWindow = new URLSearchParams(window.location.search).get('mode') === 'window';
  const [firstRun, setFirstRun] = useState<boolean | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [status, setStatus] = useState<SyncStatusMap>({});
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingRetailers, setSyncingRetailers] = useState<Set<string>>(
    new Set()
  );
  const [useFakeApi, setUseFakeApi] = useState(false);
  const [syncProgress, setSyncProgress] = useState<Record<string, SyncProgress>>({});
  const [view, setView] = useState<View>('main');
  const [enabledRetailers, setEnabledRetailers] = useState<Set<string>>(ALL_RETAILER_IDS);
  const [selectedRetailer, setSelectedRetailer] = useState<string | null>(null);

  // Detect dark mode from system preference
  useEffect(() => {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  useEffect(() => {
    checkSession().then((s) => setConnected(s.connected));

    chrome.storage.local.get(['useFakeApi', 'enabledRetailers', 'syncingRetailers', 'syncProgress', 'firstRun'], (result) => {
      setUseFakeApi(result.useFakeApi !== false);
      setFirstRun(result.firstRun === true);
      if (result.enabledRetailers) {
        setEnabledRetailers(new Set(result.enabledRetailers));
      }
      if (result.syncingRetailers) {
        setSyncingRetailers(new Set(result.syncingRetailers));
      }
      if (result.syncProgress) {
        setSyncProgress(result.syncProgress);
      }
    });

    refreshStatus();
  }, []);

  // Real-time updates from storage changes
  useEffect(() => {
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.syncStatus) {
        setStatus(changes.syncStatus.newValue ?? {});
      }
      if (changes.useFakeApi !== undefined) {
        setUseFakeApi(changes.useFakeApi.newValue !== false);
      }
      if (changes.enabledRetailers) {
        setEnabledRetailers(
          changes.enabledRetailers.newValue
            ? new Set(changes.enabledRetailers.newValue)
            : ALL_RETAILER_IDS
        );
      }
      if (changes.syncingRetailers) {
        const fromStorage = new Set<string>(changes.syncingRetailers.newValue ?? []);
        setSyncingRetailers(fromStorage);
        if (fromStorage.size === 0) {
          setSyncingAll(false);
        }
      }
      if (changes.syncProgress) {
        setSyncProgress(changes.syncProgress.newValue ?? {});
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const refreshStatus = () => {
    chrome.runtime.sendMessage({ type: 'GET_STATUS_REQUEST' }, (response) => {
      if (response?.status) setStatus(response.status);
    });
  };

  // A retailer is "active" if it has sync progress or is in syncingRetailers
  const isRetailerActive = (id: string) => !!syncProgress[id] || syncingRetailers.has(id);
  const anyActive = Object.keys(syncProgress).length > 0 || syncingRetailers.size > 0;
  const activeRetailerIds = [...new Set([...Object.keys(syncProgress), ...syncingRetailers])];

  const handleSyncAll = () => {
    if (anyActive) return;
    setSyncingAll(true);
    setSyncingRetailers(new Set(enabledRetailers));
    chrome.runtime.sendMessage({ type: 'MANUAL_SYNC_REQUEST' });
  };

  const handleSyncRetailer = (retailerId: string) => {
    if (isRetailerActive(retailerId)) return;
    setSyncingRetailers((prev) => new Set(prev).add(retailerId));
    chrome.runtime.sendMessage({ type: 'SYNC_RETAILER_REQUEST', retailerId });
  };

  const handleOpenInWindow = () => {
    chrome.windows.create({
      url: chrome.runtime.getURL('popup/index.html') + '?mode=window',
      type: 'popup',
      width: 400,
      height: 600,
    });
    window.close();
  };

  const handleRetailerClick = (retailerId: string) => {
    setSelectedRetailer(retailerId);
    setView('retailer-detail');
  };

  const handleOnboardingComplete = (triggerSync: boolean) => {
    setFirstRun(false);
    // Refresh enabled retailers and sync status from storage
    chrome.storage.local.get('enabledRetailers', (result) => {
      if (result.enabledRetailers) {
        setEnabledRetailers(new Set(result.enabledRetailers));
      }
    });
    refreshStatus();
    if (triggerSync) {
      handleSyncAll();
    }
  };

  // Don't render until we know if it's first run
  if (firstRun === null) return <div className="h-[480px]" />;

  if (firstRun) {
    return <OnboardingView onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="p-4 min-h-[200px]">
      <Header
        useFakeApi={useFakeApi}
        onOpenInWindow={handleOpenInWindow}
        onToggleSettings={() =>
          setView((v) => (v === 'settings' ? 'main' : 'settings'))
        }
        isWindow={isWindow}
      />

      {view === 'settings' ? (
        <Suspense fallback={null}>
          <SettingsPanel
            useFakeApi={useFakeApi}
            connected={connected}
            onBack={() => setView('main')}
            onResetOnboarding={() => {
              chrome.storage.local.set({ firstRun: true });
              setFirstRun(true);
            }}
          />
        </Suspense>
      ) : view === 'retailer-detail' && selectedRetailer ? (
        <Suspense fallback={null}>
          <RetailerDetail
            retailerId={selectedRetailer}
            onBack={() => {
              setSelectedRetailer(null);
              setView('main');
            }}
          />
        </Suspense>
      ) : (
        <>
          <ConnectionStatus connected={connected} useFakeApi={useFakeApi} />
          {connected === false && <UpsellBanner />}

          <RetailerList
            status={status}
            syncingRetailers={syncingRetailers}
            syncProgress={syncProgress}
            enabledRetailers={enabledRetailers}
            onSyncRetailer={handleSyncRetailer}
            onRetailerClick={handleRetailerClick}
          />

          <SyncButton loading={syncingAll || anyActive} activeCount={activeRetailerIds.length} onClick={handleSyncAll} />
          <ExportPanel />
        </>
      )}
    </div>
  );
}
