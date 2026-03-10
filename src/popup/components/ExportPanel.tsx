import React, { useEffect, useState } from 'react';
import { Button } from './ui/Button';
import { Download } from './ui/Icons';
import { getAllReceipts, getReceiptCount } from '../../storage/receipts';
import { exportAsJSON, exportAsCSV, downloadFile } from '../../utils/export';
import { capture } from '../../analytics/posthog';
import { Events } from '../../analytics/events';

interface ExportPanelViewProps {
  count: number;
  onExportJSON: () => void;
  onExportCSV: () => void;
}

export function ExportPanelView({ count, onExportJSON, onExportCSV }: ExportPanelViewProps) {
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
    </div>
  );
}

export function ExportPanel() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    getReceiptCount().then(setCount);
  }, []);

  const handleExportJSON = async () => {
    const receipts = await getAllReceipts();
    const content = exportAsJSON(receipts);
    downloadFile(content, 'matcha-receipts.json', 'application/json');
    capture(Events.EXPORT_TRIGGERED, { format: 'json', receipt_count: receipts.length });
  };

  const handleExportCSV = async () => {
    const receipts = await getAllReceipts();
    const content = exportAsCSV(receipts);
    downloadFile(content, 'matcha-receipts.csv', 'text/csv');
    capture(Events.EXPORT_TRIGGERED, { format: 'csv', receipt_count: receipts.length });
  };

  return (
    <ExportPanelView
      count={count}
      onExportJSON={handleExportJSON}
      onExportCSV={handleExportCSV}
    />
  );
}
