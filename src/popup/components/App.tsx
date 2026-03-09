import React, { useEffect, useState } from 'react';
import { Header } from './Header';
import { ConnectionStatus } from './ConnectionStatus';
import { UpsellBanner } from './UpsellBanner';
import { RetailerList } from './RetailerList';
import { SyncButton } from './SyncButton';
import { ExportPanel } from './ExportPanel';
import { DebugPanel } from './DebugPanel';
import { SettingsPanel } from './SettingsPanel';
import type { SyncStatusMap } from '../../types/messages';
import { checkSession } from '../../auth/session';
import { RETAILERS } from '../constants';

type View = 'main' | 'settings';

const ALL_RETAILER_IDS = new Set(RETAILERS.map((r) => r.id));

export function App() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [status, setStatus] = useState<SyncStatusMap>({});
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingRetailers, setSyncingRetailers] = useState<Set<string>>(
    new Set()
  );
  const [useFakeApi, setUseFakeApi] = useState(false);
  const [view, setView] = useState<View>('main');
  const [enabledRetailers, setEnabledRetailers] = useState<Set<string>>(ALL_RETAILER_IDS);

  // Detect dark mode from system preference
  useEffect(() => {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  useEffect(() => {
    checkSession().then((s) => setConnected(s.connected));

    chrome.storage.local.get(['useFakeApi', 'enabledRetailers'], (result) => {
      setUseFakeApi(result.useFakeApi !== false);
      if (result.enabledRetailers) {
        setEnabledRetailers(new Set(result.enabledRetailers));
      }
    });

    refreshStatus();
  }, []);

  const refreshStatus = () => {
    chrome.runtime.sendMessage({ type: 'GET_STATUS_REQUEST' }, (response) => {
      if (response?.status) setStatus(response.status);
    });
  };

  const handleSyncAll = () => {
    setSyncingAll(true);
    chrome.runtime.sendMessage({ type: 'MANUAL_SYNC_REQUEST' }, () => {
      setSyncingAll(false);
      refreshStatus();
    });
  };

  const handleSyncRetailer = (retailerId: string) => {
    setSyncingRetailers((prev) => new Set(prev).add(retailerId));
    chrome.runtime.sendMessage(
      { type: 'SYNC_RETAILER_REQUEST', retailerId },
      () => {
        setSyncingRetailers((prev) => {
          const next = new Set(prev);
          next.delete(retailerId);
          return next;
        });
        refreshStatus();
      }
    );
  };

  const handleOpenInWindow = () => {
    chrome.windows.create({
      url: chrome.runtime.getURL('popup/index.html'),
      type: 'popup',
      width: 400,
      height: 600,
    });
    window.close();
  };

  return (
    <div className="p-4 min-h-[200px]">
      <Header
        useFakeApi={useFakeApi}
        onOpenInWindow={handleOpenInWindow}
        onToggleSettings={() =>
          setView((v) => (v === 'settings' ? 'main' : 'settings'))
        }
      />

      {view === 'settings' ? (
        <SettingsPanel
          useFakeApi={useFakeApi}
          connected={connected}
          onBack={() => {
            // Reload enabled retailers in case they changed
            chrome.storage.local.get(['enabledRetailers'], (result) => {
              if (result.enabledRetailers) {
                setEnabledRetailers(new Set(result.enabledRetailers));
              } else {
                setEnabledRetailers(ALL_RETAILER_IDS);
              }
            });
            setView('main');
          }}
        />
      ) : (
        <>
          <ConnectionStatus connected={connected} useFakeApi={useFakeApi} />
          {connected === false && <UpsellBanner />}

          <RetailerList
            status={status}
            syncingRetailers={syncingRetailers}
            enabledRetailers={enabledRetailers}
            onSyncRetailer={handleSyncRetailer}
          />

          <SyncButton loading={syncingAll} onClick={handleSyncAll} />
          <ExportPanel />
          <DebugPanel />
        </>
      )}
    </div>
  );
}
