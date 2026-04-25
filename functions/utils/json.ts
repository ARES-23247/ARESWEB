
/**
 * JSON utility helpers for resilient parsing and stringification.
 */

/**
 * Safely parses a JSON string into a typed object.
 * Returns the default value if parsing fails.
 */
export function safeJSONParse<T>(val: unknown, defaultValue: T): T {
  if (typeof val !== 'string') {
    return (val as T) ?? defaultValue;
  }
  try {
    return JSON.parse(val) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Safely stringifies an object or array.
 * If the input is already a string, it returns it as-is.
 * Returns the default string if stringification fails.
 */
export function safeJSONStringify(val: unknown, defaultStr: string = "[]"): string {
  if (typeof val === 'string') return val;
  if (val === null || val === undefined) return defaultStr;
  
  try {
    return JSON.stringify(val);
  } catch {
    return defaultStr;
  }
}
