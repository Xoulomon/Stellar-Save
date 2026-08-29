/**
 * Shared formatting utilities used by both frontend and backend.
 *
 * These were previously duplicated across packages. Any formatting function
 * that is used in more than one package should live here.
 */

/**
 * Truncate a Stellar address for display: G...XXXX
 */
export function truncateAddress(address: string, prefixLen = 4, suffixLen = 4): string {
  if (!address || address.length <= prefixLen + suffixLen + 3) return address;
  return `${address.slice(0, prefixLen)}...${address.slice(-suffixLen)}`;
}

/**
 * Format a date to a locale-aware string.
 * Uses Intl.DateTimeFormat for consistent formatting across environments.
 */
export function formatDate(
  date: Date | string | number,
  options?: Intl.DateTimeFormatOptions,
  locale = 'en-US',
): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  const defaults: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  };
  return new Intl.DateTimeFormat(locale, defaults).format(d);
}

/**
 * Format a date as relative time (e.g., "2 hours ago", "in 3 days").
 */
export function formatRelativeTime(date: Date | string | number, locale = 'en-US'): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  const now = Date.now();
  const diffMs = d.getTime() - now;
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (Math.abs(diffSec) < 60) return rtf.format(diffSec, 'second');
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute');
  if (Math.abs(diffHour) < 24) return rtf.format(diffHour, 'hour');
  return rtf.format(diffDay, 'day');
}

/**
 * Format a currency amount with locale-aware number formatting.
 */
export function formatCurrency(
  amount: number | string,
  currency = 'USD',
  locale = 'en-US',
): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Format a number with thousands separators and optional decimal places.
 */
export function formatNumber(
  value: number | string,
  decimals = 2,
  locale = 'en-US',
): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Format a percentage value.
 */
export function formatPercent(value: number, decimals = 2): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}
