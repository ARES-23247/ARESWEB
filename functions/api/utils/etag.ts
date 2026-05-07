import { Context } from "hono";

/**
 * Generates an ETag for the given data payload using the Web Crypto API.
 */
export async function generateETag(data: unknown): Promise<string> {
  const str = JSON.stringify(data);
  const encoder = new TextEncoder();
  const dataBuf = encoder.encode(str);
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuf);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  
  return `"${hashHex}"`;
}

/**
 * Wraps a successful JSON response with ETag headers and handles 304 Not Modified.
 */
export async function withETag<T>(c: Context, data: T) {
  const etag = await generateETag(data);
  const ifNoneMatch = c.req.header('If-None-Match');

  if (ifNoneMatch === etag) {
    return c.body(null, 304);
  }

  c.header('ETag', etag);
  return c.json(data, 200);
}
