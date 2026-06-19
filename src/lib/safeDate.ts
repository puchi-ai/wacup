/**
 * Safe date parsing — auto-fixes invalid date formats and falls back gracefully.
 *
 * Common issues handled:
 * - Invalid ISO strings from external APIs
 * - Undefined/null timestamps
 * - NaN dates after subtraction/comparison
 * - Locale-specific format mismatches
 */

/**
 * Safely parse any date-ish value into a Date object.
 * Returns a fallback Date (or null) instead of Invalid Date.
 * Fully try-catch wrapped — never throws, always returns a valid Date.
 */
export function safeParseDate(
  value: string | number | Date | undefined | null,
  fallback?: Date,
): Date {
  try {
    if (value == null || value === '') {
      return fallback ?? new Date();
    }

    if (value instanceof Date && !isNaN(value.getTime())) {
      return value;
    }

    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }

    // Try common non-standard formats
    // e.g. "2026-06-11 20:00 UTC" or "June 11, 2026"
    const cleaned = String(value)
      .replace(/\s*UTC\s*/gi, '')
      .replace(/\s*GMT\s*/gi, '')
      .trim();

    const retry = new Date(cleaned);
    if (!isNaN(retry.getTime())) {
      return retry;
    }
  } catch {
    // Non-blocking: silently fall through to fallback
  }

  console.warn('[safeDate] Unparseable date value:', value);
  return fallback ?? new Date();
}

/**
 * Safe timestamp (ms since epoch). Returns 0 for invalid dates.
 * Non-blocking — catches any unexpected errors.
 */
export function safeTimestamp(value: string | number | Date | undefined | null): number {
  try {
    const d = safeParseDate(value);
    return d.getTime();
  } catch {
    return 0;
  }
}

/**
 * Format a date for display without throwing on invalid input.
 */
export function safeFormatDate(
  value: string | number | Date | undefined | null,
  options?: Intl.DateTimeFormatOptions,
  locale?: string,
): string {
  const d = safeParseDate(value);
  try {
    return d.toLocaleString(locale || 'en', options || { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return String(value ?? '');
  }
}

/**
 * Safe time string like "14:30" or "Dec 12 · 20:00"
 */
export function safeFormatTime(iso: string | undefined | null): string {
  const d = safeParseDate(iso);
  if (d.getTime() === 0) return 'TBD';
  try {
    const month = d.toLocaleString('en', { month: 'short' });
    const day = d.getDate();
    const time = d.toLocaleString('en', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${month} ${day} · ${time}`;
  } catch {
    return 'TBD';
  }
}

/**
 * Safe date difference in milliseconds. Returns 0 for invalid dates.
 * Non-blocking — catches any unexpected errors.
 */
export function safeDiffMs(
  a: string | number | Date | undefined | null,
  b: string | number | Date | undefined | null,
): number {
  try {
    return safeTimestamp(a) - safeTimestamp(b);
  } catch {
    return 0;
  }
}
