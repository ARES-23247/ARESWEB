const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;

/** Parse a YYYY-MM-DD value as a local calendar date instead of UTC midnight. */
export function parseDateOnly(value: string): Date | null {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) return null;

  const year = Number.parseInt(match[1], 10);
  const monthIndex = Number.parseInt(match[2], 10) - 1;
  const day = Number.parseInt(match[3], 10);
  const parsed = new Date(year, monthIndex, day);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== monthIndex ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

export function formatDateOnly(
  value: string,
  options: Intl.DateTimeFormatOptions,
  fallback = "Date unavailable",
): string {
  const parsed = parseDateOnly(value);
  return parsed ? parsed.toLocaleDateString("en-US", options) : fallback;
}
