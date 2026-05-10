/**
 * Drizzle ORM â†’ API Response Case Mapper
 * 
 * After the Drizzle migration, queries return JavaScript property names (camelCase)
 * but the frontend API consumers expect snake_case keys (matching original DB columns).
 * This utility maps camelCase keys to snake_case in API response objects.
 * 
 * Usage:
 *   import { toSnakeCase } from "../../utils/caseMapper";
 *   return c.json({ events: results.map(toSnakeCase) }, 200);
 */

/**
 * Convert a single camelCase string to snake_case.
 * e.g. "dateStart" â†’ "dateStart", "isPotluck" â†’ "isPotluck"
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Convert all camelCase keys in an object to snake_case.
 * Preserves keys that are already snake_case or single-word.
 * Does NOT recurse into nested objects (API responses are flat row objects).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toSnakeCase<T extends Record<string, any>>(obj: T): Record<string, any> {
  if (!obj || typeof obj !== "object") return obj;
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = camelToSnake(key);
    result[snakeKey] = value;
    // Also keep the original key if it was already snake_case (idempotent)
    if (snakeKey !== key) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Map an array of Drizzle result objects to snake_case.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapToSnakeCase<T extends Record<string, any>>(rows: T[]): Record<string, any>[] {
  return rows.map(toSnakeCase);
}

