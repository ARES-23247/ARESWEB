/** Formats a Date for an HTML datetime-local control without a UTC conversion. */
export function formatLocalDateTimeInput(date: Date): string {
  if (Number.isNaN(date.getTime()))
    throw new Error("A valid date is required.");
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Converts a stored ISO or legacy local timestamp to a datetime-local value. */
export function storedDateTimeToLocalInput(
  value: string | null | undefined,
): string {
  return value ? formatLocalDateTimeInput(new Date(value)) : "";
}

/** Converts a datetime-local wall-clock value to the canonical UTC API form. */
export function localDateTimeInputToIso(value: string): string {
  return new Date(value).toISOString();
}
