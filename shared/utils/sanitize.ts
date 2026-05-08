/**
 * Basic HTML sanitization utilities
 * For production, consider using DOMPurify or similar library
 */

/**
 * Strip HTML tags and potentially dangerous content from strings
 * This is a basic implementation - for production use DOMPurify
 */
export function sanitizeHtml(input: string): string {
  if (!input) return input;

  // Remove script tags and their content
  // eslint-disable-next-line security/detect-unsafe-regex
  let sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove other potentially dangerous tags (iframe, object, embed, etc.)
  sanitized = sanitized.replace(/<(iframe|object|embed|form|input|button|link|style)[^>]*>/gi, '');

  // Remove event handlers (onclick, onerror, etc.)
  sanitized = sanitized.replace(/\s(on\w+)="[^"]*"/gi, '');
  sanitized = sanitized.replace(/\s(on\w+)='[^']*'/gi, '');

  // Remove javascript: protocol in href/src attributes
  sanitized = sanitized.replace(/(href|src|srcset|background)=\s*["']javascript:[^"']*["']/gi, '$1=""');

  return sanitized;
}

/**
 * Validate that a string is safe JSON
 */
export function validateJsonString(input: string): boolean {
  try {
    const parsed = JSON.parse(input);
    // Basic type check - ensure it's an object or array, not a primitive
    return typeof parsed === 'object' && parsed !== null;
  } catch {
    return false;
  }
}
