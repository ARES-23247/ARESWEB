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
      'iframe', 'video', 'audio', 'source'
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'class', 'id', 'src', 'alt', 'width', 'height', 
      'frameborder', 'allow', 'allowfullscreen', 'title', 'autoplay', 'controls', 'muted', 'loop', 'type'
    ]
  });
}
