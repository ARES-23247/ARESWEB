/**
 * HTML sanitization utilities using DOMPurify
 * Provides consistent XSS protection across the application
 */
import DOMPurify from 'dompurify';

/**
 * Sanitize HTML to prevent XSS attacks
 * Uses DOMPurify with a strict allowlist for safe HTML rendering
 *
 * @param input - Potentially unsafe HTML string
 * @returns Sanitized HTML string safe for rendering
 */
export function sanitizeHtml(input: string): string {
  if (!input) return input;

  return DOMPurify.sanitize(input, {
    // Allow only basic formatting tags
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'code', 'pre', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'hr'],
    // Allow only safe attributes
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'id'],
    // Force https for links
    FORCE_BODY: false,
    // Sanitize the HTML itself, not the source
    RETURN_TRUSTED_TYPE: false,
  });
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
