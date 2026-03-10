export const Events = {
  EXTENSION_INSTALLED: 'extension_installed',
  EXTENSION_UPDATED: 'extension_updated',
  SYNC_STARTED: 'sync_started',
  SYNC_COMPLETED: 'sync_completed',
  SYNC_ERROR: 'sync_error',
  EXPORT_TRIGGERED: 'export_triggered',
  POPUP_OPENED: 'popup_opened',
} as const;

export type EventName = (typeof Events)[keyof typeof Events];

export interface ExtensionInstalledProps {
  version: string;
}

export interface ExtensionUpdatedProps {
  version: string;
  previous_version: string;
}

export interface SyncStartedProps {
  trigger: 'manual_all' | 'manual_single' | 'scheduled';
  retailer_ids: string[];
}

export interface SyncCompletedProps {
  retailer_id: string;
  receipt_count: number;
  duration_ms: number;
}

export interface SyncErrorProps {
  retailer_id: string;
  error_message: string;
  error_type: 'scrape' | 'api' | 'timeout';
}

export interface ExportTriggeredProps {
  format: 'json' | 'csv';
  receipt_count: number;
}
