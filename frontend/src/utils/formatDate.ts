/**
 * Date formatting utility for Stellar Save frontend.
 * Supports relative (e.g. "2 hours ago") and absolute (e.g. "Jan 15, 2024 3:45 PM") formats.
 * Uses native Intl APIs for locale-aware formatting.
 */

interface FormatDateOptions {
  /** 'relative' (default) or 'absolute' */
  mode?: 'relative' | 'absolute';
  /** Custom locale, defaults to 'en-US' */
  locale?: string;
  /** Max relative unit (e.g. 'day' for up to days ago) */
  maxRelativeUnit?: 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year';
}

/**
 * Formats timestamp as relative or absolute date/time.
 * 
 * @param input - Date string/number/Date/timestamp
 * @param options - Formatting options
 * @returns Formatted string
 * @throws Invalid date
 */
export function formatDate(input: string | number | Date, options: FormatDateOptions = {}): string {
  const { mode = 'relative', locale = 'en-US', maxRelativeUnit = 'year' } = options;
  
  // Normalize to Date
  let date: Date;
  if (input instanceof Date) {
    date = input;
  } else if (typeof input === 'number') {
    date = new Date(input);
  } else {
    date = new Date(input);
  }
  
  // Validate
  if (isNaN(date.getTime())) {
    throw new Error('Invalid date input');
  }
  
  const now = new Date();
  const diffMs = Math.abs(now.getTime() - date.getTime());
  const diffSeconds = Math.floor(diffMs / 1000);
  
  if (mode === 'absolute') {
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
    });
  }
  
  // Relative mode
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  
  // Match cycleProgress style for short remaining: #d #h #m
  if (date > now && diffSeconds < 7 * 24 * 60 * 60) { // Future, <1 week: remaining style
    const days = Math.floor(diffSeconds / (24 * 60 * 60));
    const hours = Math.floor((diffSeconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((diffSeconds % (60 * 60)) / 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }
  
  // Past relative
  if (diffSeconds < 60 && maxRelativeUnit === 'second') {
    return rtf.format(-Math.floor(diffMs / 1000), 'second');
  }
  if (diffSeconds < 60 * 60 && maxRelativeUnit === 'minute') {
    return rtf.format(-Math.floor(diffSeconds / 60), 'minute');
  }
  if (diffSeconds < 24 * 60 * 60 && maxRelativeUnit === 'hour') {
    return rtf.format(-Math.floor(diffSeconds / (60 * 60)), 'hour');
  }
  if (diffSeconds < 30 * 24 * 60 * 60 && maxRelativeUnit === 'day') {
    return rtf.format(-Math.floor(diffSeconds / (24 * 60 * 60)), 'day');
  }
  if (diffSeconds < 12 * 30 * 24 * 60 * 60 && maxRelativeUnit === 'month') {
    return rtf.format(-Math.floor(diffSeconds / (30 * 24 * 60 * 60)), 'month');
  }
  
  // Fallback to short date
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

// Convenience functions
export function formatDateRelative(input: string | number | Date, options: Omit<FormatDateOptions, 'mode'> = {}): string {
  return formatDate(input, { mode: 'relative', ...options });
}

export function formatDateAbsolute(input: string | number | Date, options: Omit<FormatDateOptions, 'mode'> = {}): string {
  return formatDate(input, { mode: 'absolute', ...options });
}

export type { FormatDateOptions };

