/**
 * Response Transform Utilities
 *
 * Converts snake_case database responses to camelCase API responses.
 * Database layer (Drizzle) uses snake_case, API layer uses camelCase.
 *
 * @module transformResponse
 */

/**
 * Converts a snake_case string to camelCase
 * @example user_id -> userId
 * @example points_delta -> pointsDelta
 * @example createdAt -> createdAt
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Converts a camelCase string to snake_case
 * @example userId -> user_id
 * @example pointsDelta -> points_delta
 */
export function camelToSnake(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

/**
 * Recursively transforms all keys in an object from snake_case to camelCase
 *
 * @param obj - The object to transform
 * @returns A new object with camelCase keys
 *
 * @example
 * ```ts
 * const result = toCamelCase({
 *   user_id: '123',
 *   points_delta: 10,
 *   createdAt: '2024-01-01'
 * });
 * // { userId: '123', pointsDelta: 10, createdAt: '2024-01-01' }
 * ```
 */
export function toCamelCase<T>(obj: unknown): T {
  if (obj === null || obj === undefined) {
    return obj as T;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => toCamelCase(item)) as unknown as T;
  }

  // Handle primitive types
  if (typeof obj !== 'object') {
    return obj as T;
  }

  // Handle Date objects
  if (obj instanceof Date) {
    return obj as T;
  }

  // Transform object keys
  const result: Record<string, unknown> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const camelKey = snakeToCamel(key);
      const value = (obj as Record<string, unknown>)[key];
      result[camelKey] = toCamelCase(value);
    }
  }

  return result as T;
}

/**
 * Recursively transforms all keys in an object from camelCase to snake_case
 *
 * @param obj - The object to transform
 * @returns A new object with snake_case keys
 *
 * @example
 * ```ts
 * const result = toSnakeCase({
 *   userId: '123',
 *   pointsDelta: 10,
 *   createdAt: '2024-01-01'
 * });
 * // { user_id: '123', points_delta: 10, createdAt: '2024-01-01' }
 * ```
 */
export function toSnakeCase<T>(obj: unknown): T {
  if (obj === null || obj === undefined) {
    return obj as T;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => toSnakeCase(item)) as unknown as T;
  }

  // Handle primitive types
  if (typeof obj !== 'object') {
    return obj as T;
  }

  // Handle Date objects
  if (obj instanceof Date) {
    return obj as T;
  }

  // Transform object keys
  const result: Record<string, unknown> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const snakeKey = camelToSnake(key);
      const value = (obj as Record<string, unknown>)[key];
      result[snakeKey] = toSnakeCase(value);
    }
  }

  return result as T;
}

/**
 * Creates a response transformer for specific field mappings
 * Use when you need custom field name transformations beyond simple snake_case <-> camelCase
 *
 * @param fieldMap - Map of source field names to target field names
 * @returns A function that transforms objects according to the field map
 *
 * @example
 * ```ts
 * const transformUser = createFieldTransformer({
 *   id: 'userId',
 *   name: 'fullName',
 *   email: 'emailAddress'
 * });
 * ```
 */
export function createFieldTransformer<T extends Record<string, unknown>, U extends Record<string, unknown>>(
  fieldMap: Partial<Record<keyof T, string>>
): (obj: T) => U {
  return (obj: T): U => {
    const result: Record<string, unknown> = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const newKey = fieldMap[key] || key;
        result[newKey] = obj[key];
      }
    }
    return result as U;
  };
}

