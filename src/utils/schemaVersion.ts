/**
 * Schema version history. Each entry defines which retailers were changed and
 * what changed. Receipts from affected retailers stored before this version
 * will be considered stale on the next sync, triggering a cursor reset and
 * full re-fetch for that retailer only.
 *
 * To bump a retailer's schema: add a new entry with the next version number
 * and list only the retailers whose scraping output actually changed.
 */
export const SCHEMA_VERSIONS: Array<{
  version: number;
  retailers: string[];
  description: string;
}> = [
  {
    version: 1,
    retailers: ['costco'],
    description:
      'effectivePrice (2dp with remainder correction), paymentMethods, taxFlag-based tax attribution',
  },
];

/**
 * Returns the current required schema version for a given retailer — the
 * highest version number in which that retailer appears. Returns 0 for
 * retailers with no schema version history (no re-sync needed).
 */
export function getCurrentSchemaVersion(retailerId: string): number {
  let version = 0;
  for (const entry of SCHEMA_VERSIONS) {
    if (entry.retailers.includes(retailerId) && entry.version > version) {
      version = entry.version;
    }
  }
  return version;
}
