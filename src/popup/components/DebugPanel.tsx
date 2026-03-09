import React, { useEffect, useState } from 'react';
import type { DebugLogEntry } from '../../types/messages';
import { Button } from './ui/Button';
import { ChevronDown } from './ui/Icons';

interface DebugPanelViewProps {
  entries: DebugLogEntry[];
  onExpand: () => void;
  onClear: () => void;
}

export function DebugPanelView({ entries, onExpand, onClear }: DebugPanelViewProps) {
  const [expanded, setExpanded] = useState(false);

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) onExpand();
  };

  return (
    <div className="border-t border-border pt-2">
      <button
        onClick={handleToggle}
        className="flex items-center gap-1 w-full text-left text-xs text-muted-foreground hover:text-foreground py-1 cursor-pointer transition-colors"
      >
        <ChevronDown
          size={12}
          className={`transition-transform ${expanded ? '' : '-rotate-90'}`}
        />
        Debug Log ({entries.length || '...'})
      </button>

      {expanded && (
        <div className="mt-2">
          {entries.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onClear}
              className="mb-2"
            >
              Clear
            </Button>
          )}

          <div className="max-h-[300px] overflow-y-auto text-[11px] font-mono">
            {entries.length === 0 && (
              <div className="text-muted-foreground p-2">
                No API requests logged yet.
              </div>
            )}

            {entries.map((entry, i) => (
              <div
                key={i}
                className={`p-2 mb-1 rounded ${
                  entry.error
                    ? 'bg-destructive-bg border-l-[3px] border-l-destructive'
                    : 'bg-muted border-l-[3px] border-l-success'
                }`}
              >
                <div className="text-muted-foreground mb-0.5">
                  {new Date(entry.timestamp).toLocaleTimeString()}{' '}
                  <strong>
                    {entry.method} {entry.endpoint}
                  </strong>
                </div>
                <div className="whitespace-pre-wrap break-all">
                  {JSON.stringify(entry.payload as object, null, 2)}
                </div>
                {entry.response != null && (
                  <div className="text-success mt-1">
                    Response:{' '}
                    {JSON.stringify(entry.response as object, null, 2)}
                  </div>
                )}
                {entry.error && (
                  <div className="text-destructive mt-1">
                    Error: {entry.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function DebugPanel() {
  const [entries, setEntries] = useState<DebugLogEntry[]>([]);

  const handleExpand = () => {
    chrome.runtime.sendMessage(
      { type: 'GET_DEBUG_LOG_REQUEST' },
      (response) => {
        if (response?.entries) setEntries(response.entries);
      }
    );
  };

  const handleClear = () => {
    chrome.runtime.sendMessage({ type: 'CLEAR_DEBUG_LOG' });
    setEntries([]);
  };

  return <DebugPanelView entries={entries} onExpand={handleExpand} onClear={handleClear} />;
}
