import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML to prevent XSS attacks while allowing safe tags.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li',
      'code', 'pre', 'span', 'div', 'blockquote', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'figure', 'figcaption', 'details', 'summary',
      'video', 'audio', 'source'
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'class', 'src', 'alt', 'width', 'height',
      'frameborder', 'allow', 'allowfullscreen', 'title', 'autoplay', 'controls', 'muted', 'loop', 'type'
    ]
  });
}

/**
 * Validates numeric ID parameters (UUID or integer).
 */
export function validateIdParam(param: string | undefined): string | null {
  if (!param) return null;

  // Length limit to prevent DoS before regex execution
  if (param.length > 128) {
    return null;
  }

  // Check for UUID format
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidPattern.test(param)) {
    return param;
  }

  // Check for numeric ID (positive integers only)
  const numericPattern = /^\d+$/;
  if (numericPattern.test(param)) {
    return param;
  }

  // Check for slug-like format (alphanumeric with single hyphens)
  // Non-backtracking O(n) check, length capped at 128 above
  if (
    !param.startsWith("-") &&
    !param.endsWith("-") &&
    !param.includes("--") &&
    /^[a-z0-9-]+$/i.test(param)
  ) {
    return param;
  }

  return null;
}
