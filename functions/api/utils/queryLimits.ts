/**
 * Query limit constants for API endpoints
 */
export const QUERY_LIMITS = {
  /** Default page size for list endpoints */
  DEFAULT_PAGE: 20,

  /** Maximum page size for list endpoints */
  MAX_PAGE: 100,

  /** Global search results per domain */
  GLOBAL_SEARCH: 5,

  /** FTS query maximum length */
  FTS_MAX_LENGTH: 100,

  /** Autocomplete suggestions */
  AUTOCOMPLETE: 10,

  /** Audit log history limit */
  AUDIT_LOG_LIMIT: 50,
} as const;
