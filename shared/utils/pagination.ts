/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PAGINATION UTILITIES
 * ─────────────────────────────────────────────────────────────────────────────
 * Standardized pagination types and helpers for API list endpoints.
 * Ensures consistent pagination behavior across all list endpoints.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Standard pagination request parameters.
 * Used by list endpoints to control pagination behavior.
 */
export interface PaginationParams {
  /** Maximum number of items to return per page */
  limit?: number;
  /** Number of items to skip from the beginning */
  offset?: number;
}

/**
 * Standard paginated response structure.
 * Includes both the data and metadata for pagination.
 */
export interface PaginatedResponse<T> {
  /** The paginated data items */
  data: T[];
  /** Total number of items available (optional, may be omitted for performance) */
  total?: number;
  /** The limit applied to this request */
  limit: number;
  /** The offset applied to this request */
  offset: number;
  /** Whether there are more items available */
  hasMore: boolean;
}

/**
 * Default pagination values.
 */
export const DEFAULT_PAGINATION = {
  limit: 50,
  offset: 0,
} as const;

/**
 * Maximum allowed limit to prevent excessive queries.
 */
export const MAX_LIMIT = 500;

/**
 * Normalizes pagination parameters from user input.
 * Ensures values are within acceptable ranges.
 *
 * @param params - Raw pagination parameters from request
 * @param defaults - Default values to use (optional)
 * @returns Normalized pagination parameters
 */
export function normalizePagination(
  params: PaginationParams,
  defaults: PaginationParams = DEFAULT_PAGINATION
): Required<PaginationParams> {
  const limit = Math.min(
    Math.max(1, params.limit ?? defaults.limit ?? DEFAULT_PAGINATION.limit),
    MAX_LIMIT
  );
  const offset = Math.max(0, params.offset ?? defaults.offset ?? DEFAULT_PAGINATION.offset);

  return { limit, offset };
}

/**
 * Creates a paginated response object.
 *
 * @param data - The data items for the current page
 * @param limit - The limit applied
 * @param offset - The offset applied
 * @param total - Total count (optional)
 * @returns A properly formatted paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  limit: number,
  offset: number,
  total?: number
): PaginatedResponse<T> {
  return {
    data,
    limit,
    offset,
    hasMore: total !== undefined ? offset + data.length < total : data.length === limit,
    ...(total !== undefined && { total }),
  };
}

/**
 * Calculates whether there are more items based on current page data.
 *
 * @param itemsReturned - Number of items returned from query
 * @param limit - The limit applied
 * @param total - Total count if available
 * @returns Whether there are more items
 */
export function calculateHasMore(
  itemsReturned: number,
  limit: number,
  total?: number
): boolean {
  if (total !== undefined) {
    return itemsReturned + limit < total;
  }
  return itemsReturned === limit;
}
