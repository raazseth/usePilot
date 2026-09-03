/**
 * Format a timestamp (ms) to a human-readable date string.
 */
export function formatDate(timestamp: number, locale = 'en-US'): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(timestamp))
}

/**
 * Format a timestamp to a relative time string (e.g. "2 hours ago").
 */
export function formatRelativeTime(timestamp: number, locale = 'en-US'): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const diffMs = timestamp - Date.now()
  const diffSec = Math.round(diffMs / 1000)
  const diffMin = Math.round(diffSec / 60)
  const diffHour = Math.round(diffMin / 60)
  const diffDay = Math.round(diffHour / 24)
  const diffWeek = Math.round(diffDay / 7)
  const diffMonth = Math.round(diffDay / 30)
  const diffYear = Math.round(diffDay / 365)

  if (Math.abs(diffSec) < 60) return rtf.format(diffSec, 'second')
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute')
  if (Math.abs(diffHour) < 24) return rtf.format(diffHour, 'hour')
  if (Math.abs(diffDay) < 7) return rtf.format(diffDay, 'day')
  if (Math.abs(diffWeek) < 4) return rtf.format(diffWeek, 'week')
  if (Math.abs(diffMonth) < 12) return rtf.format(diffMonth, 'month')
  return rtf.format(diffYear, 'year')
}

/**
 * Convert a Date to a Unix timestamp in milliseconds.
 */
export function toTimestamp(date: Date = new Date()): number {
  return date.getTime()
}

/**
 * Convert a Unix timestamp (ms) to a Date object.
 */
export function fromTimestamp(timestamp: number): Date {
  return new Date(timestamp)
}
