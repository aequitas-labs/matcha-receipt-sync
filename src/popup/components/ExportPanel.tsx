import React, { useEffect, useState } from 'react';
import { Button } from './ui/Button';
import { Download } from './ui/Icons';
import { getAllReceipts, getReceiptCount } from '../../storage/receipts';
import { exportAsJSON, exportAsCSV, downloadFile } from '../../utils/export';
import { capture } from '../../analytics/posthog';
import { Events } from '../../analytics/events';

interface ExportPanelViewProps {
  count: number;
  exportState: 'idle' | 'success' | 'error';
  onExportJSON: () => void;
  onExportCSV: () => void;
}

export function ExportPanelView({
  count,
  exportState,
  onExportJSON,
  onExportCSV,
}: ExportPanelViewProps) {
  return (
    <div className="mb-3">
      <h2 className="font-sans text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        Export
      </h2>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {count} receipt{count !== 1 ? 's' : ''} stored locally
        </span>
        <div className="ml-auto flex gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={onExportJSON}
            disabled={count === 0}
          >
            <Download size={12} />
            JSON
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onExportCSV}
            disabled={count === 0}
          >
            <Download size={12} />
            CSV
          </Button>
        </div>
      </div>
      {exportState === 'success' && (
        <p className="text-[10px] text-success mt-1">Export downloaded.</p>
      )}
      {exportState === 'error' && (
        <p className="text-[10px] text-destructive mt-1">
          Export failed. Please try again.
        </p>
      )}
    </div>
  );
}

export function ExportPanel() {
  const [count, setCount] = useState(0);
  const [exportState, setExportState] = useState<'idle' | 'success' | 'error'>(
    'idle'
  );

  useEffect(() => {
    getReceiptCount().then(setCount);

    // Re-fetch count when syncs complete (syncStatus updates after each retailer)
    const listener = (changes: {
      [key: string]: chrome.storage.StorageChange;
    }) => {
      if (changes.syncStatus) {
        getReceiptCount().then(setCount);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const runExport = async (format: 'json' | 'csv') => {
    try {
      const receipts = await getAllReceipts();
      if (format === 'json') {
        downloadFile(
          exportAsJSON(receipts),
          'matcha-receipts.json',
          'application/json'
        );
      } else {
        downloadFile(exportAsCSV(receipts), 'matcha-receipts.csv', 'text/csv');
      }
      capture(Events.EXPORT_TRIGGERED, {
        format,
        receipt_count: receipts.length,
      });
      setExportState('success');
      setTimeout(() => setExportState('idle'), 3000);
    } catch {
      setExportState('error');
      setTimeout(() => setExportState('idle'), 5000);
    }
  };

  return (
    <ExportPanelView
      count={count}
      exportState={exportState}
      onExportJSON={() => runExport('json')}
      onExportCSV={() => runExport('csv')}
    />
  );
}
