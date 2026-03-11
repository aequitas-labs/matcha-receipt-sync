/** Format ISO date as a short human-readable string, e.g. "Jan 1, 2025" */
export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Relative time string (e.g. "2h ago", "3d ago", "just now") */
export function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

/** Format a Date to YYYY-MM-DD */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/** Parse a date string in various formats into a Date */
export function parseDate(text: string): Date | null {
  const trimmed = text.trim();

  // Try native Date parsing first
  const date = new Date(trimmed);
  if (!isNaN(date.getTime())) return date;

  // Try "Month Day, Year" format (e.g. "January 15, 2024")
  const monthDayYear = trimmed.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (monthDayYear) {
    const parsed = new Date(
      `${monthDayYear[1]} ${monthDayYear[2]}, ${monthDayYear[3]}`
    );
    if (!isNaN(parsed.getTime())) return parsed;
  }

  return null;
}
