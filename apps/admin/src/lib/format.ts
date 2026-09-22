/**
 * Formatting for the admin panel's own screens.
 *
 * Deliberately *not* the website's `fmt`. The site writes "US$ 4,500" with a
 * thin space because the design says so; a table of enquiries wants "$4,500"
 * in a column that lines up. Sharing one formatter between them would mean one
 * of the two is wrong, so they are separate and this comment is the reason.
 */

export function currency(amountUsd: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amountUsd);
}

/**
 * Money held as minor units: `123450` → `$1,234.50`.
 *
 * Separate from `currency()` above, and not folded into it, because the two
 * take different numbers. The catalogue holds whole dollars and prints them
 * without a decimal; a booking holds cents and must print both places, since
 * `$1,234.5` on an invoice is a figure somebody queries.
 *
 * The trailing `.00` stays. A column of totals where some have decimals and
 * some do not is a column that does not line up, and lining up is most of what
 * a table of money is for.
 */
export function money(cents: number, currencyCode = 'USD'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function metres(value: number): string {
  return `${new Intl.NumberFormat('en-GB').format(value)} m`;
}

/**
 * "21 Sep 2026".
 *
 * Written out rather than left to `toLocaleDateString`, whose output depends
 * on the ICU data of whichever runtime renders it — which in a server
 * component that also hydrates is a React hydration error.
 */
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  return `${formatDate(date)}, ${hh}:${mm}`;
}

/** "3 days ago". Falls back to a date beyond a month, where "5 weeks" stops helping. */
export function relativeTime(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (Number.isNaN(seconds)) return '—';
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  const days = Math.floor(seconds / 86400);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return formatDate(date);
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Title-cases an enum for display: `FEW_PLACES` → `Few places`. */
export function humanise(value: string): string {
  const lower = value.toLowerCase().replace(/_/g, ' ');
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
