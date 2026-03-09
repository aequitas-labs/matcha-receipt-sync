import React from 'react';
import { ExternalLink, Settings } from './ui/Icons';
import { Badge } from './ui/Badge';

interface HeaderProps {
  useFakeApi: boolean;
  onOpenInWindow: () => void;
  onToggleSettings: () => void;
}

export function Header({
  useFakeApi,
  onOpenInWindow,
  onToggleSettings,
}: HeaderProps) {
  return (
    <header className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
      <img src="../icons/icon-128.png" alt="" className="w-6 h-6 rounded-md" />
      <div>
        <h1 className="font-sans text-base font-semibold text-foreground leading-tight">
          matcha money
        </h1>
        <p className="text-[10px] text-muted-foreground leading-tight">
          receipt sync
        </p>
      </div>
      {useFakeApi && <Badge variant="warning">Dev</Badge>}
      <div className="ml-auto flex items-center gap-1">
        <button
          onClick={onToggleSettings}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          title="Settings"
        >
          <Settings size={14} />
        </button>
        <button
          onClick={onOpenInWindow}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          title="Open in window"
        >
          <ExternalLink size={14} />
        </button>
      </div>
    </header>
  );
}
