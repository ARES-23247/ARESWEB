import DOMPurify from 'dompurify';

// SEC-WR-04: HMAC secret for tutorial progress integrity validation.
// IMPORTANT: This does NOT provide real security - the secret is in client-side code.
// Any user can inspect the code and forge signatures. This only provides:
// 1. Tamper detection for casual data corruption (storage bugs, etc.)
// 2. A signal when localStorage data is manually modified
// This is suitable for tutorial progress (non-critical data) but NOT for auth tokens,
// sensitive user data, or anything that impacts security decisions.
const TUTORIAL_SIGNATURE_SECRET = "ares-tutorial-hmac-2025";

/**
 * Creates HMAC-SHA256 signature for data integrity verification.
 * Used for validating that stored data hasn't been tampered with.
 */
async function createHmacSignature(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(TUTORIAL_SIGNATURE_SECRET);
  const messageData = encoder.encode(data);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  const signatureArray = Array.from(new Uint8Array(signature));
  return signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifies HMAC-SHA256 signature for data integrity.
 */
async function verifyHmacSignature(data: string, signature: string): Promise<boolean> {
  const expectedSignature = await createHmacSignature(data);
  return expectedSignature === signature;
}

/**
 * Signs tutorial progress data with HMAC for integrity protection.
 */
export async function signTutorialProgress(progress: string[]): Promise<{ progress: string[]; signature: string }> {
  const progressStr = JSON.stringify(progress);
  const signature = await createHmacSignature(progressStr);
  return { progress, signature };
}

/**
 * Verifies and returns tutorial progress if signature is valid.
 * Returns null if signature verification fails.
 */
export async function verifyTutorialProgress(signedData: { progress?: string[]; signature?: string } | null): Promise<string[] | null> {
  if (!signedData || !signedData.progress || !signedData.signature) {
    return null;
  }
  const isValid = await verifyHmacSignature(JSON.stringify(signedData.progress), signedData.signature);
  return isValid ? signedData.progress : null;
}

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
 * Validates URL parameters to prevent injection attacks.
 * Returns null if validation fails, otherwise returns the validated value.
 */
export function validateUrlParam(param: string | undefined): string | null {
  if (!param) return null;

  // Reject obviously dangerous patterns
  const dangerousPatterns = [
    /\.\./,        // Directory traversal
    /<script/i,    // Script tags
    /javascript:/i, // JavaScript protocol
    /onerror=/i,   // Event handlers
    /onload=/i,    // Event handlers
    /data:/i,      // Data URLs (can be used for XSS)
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(param)) {
      return null;
    }
  }

  // Only allow alphanumeric, hyphens, underscores, and common URL-safe characters
  // This is a basic validation; specific params may need more specific rules
  const safePattern = /^[a-zA-Z0-9-_~.+]+$/;
  if (!safePattern.test(param)) {
    return null;
  }

  // Length limit to prevent DoS
  if (param.length > 256) {
    return null;
  }

  return param;
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

  // Check for slug-like format (alphanumeric with hyphens)
  // Simplified to avoid catastrophic backtracking (security/detect-unsafe-regex)
  // Length is capped at 128 above, so this is safe.
  // eslint-disable-next-line security/detect-unsafe-regex
  const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  if (slugPattern.test(param)) {
    return param;
  }

  return null;
}
