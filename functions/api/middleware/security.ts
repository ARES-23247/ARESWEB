import { Context, Next } from "hono";
import { AppEnv } from "./utils";

// ── Rate Limiting (In-Memory Worker V8 Isolate) ────────────────────────
const rateLimitCache = new Map<string, { count: number; expiresAt: number }>();

export function checkRateLimit(ip: string, limit = 100, windowSeconds = 60): boolean {
  const now = Date.now();
  
  if (Math.random() < 0.05) {
    for (const [key, data] of rateLimitCache.entries()) {
      if (data.expiresAt < now) {
        rateLimitCache.delete(key);
      }
    }
  }

  let record = rateLimitCache.get(ip);
  if (!record || record.expiresAt < now) {
    record = { count: 0, expiresAt: now + windowSeconds * 1000 };
  }

  record.count += 1;
  rateLimitCache.set(ip, record);

  return record.count <= limit;
}

// ── Write-Endpoint Rate Limiting (Stricter) ────────────────────────────
const writeRateLimitCache = new Map<string, { count: number; expiresAt: number }>();

export function checkWriteRateLimit(ip: string, limit = 15, windowSeconds = 60): boolean {
  const now = Date.now();

  if (Math.random() < 0.05) {
    for (const [key, data] of writeRateLimitCache.entries()) {
      if (data.expiresAt < now) writeRateLimitCache.delete(key);
    }
  }

  let record = writeRateLimitCache.get(ip);
  if (!record || record.expiresAt < now) {
    record = { count: 0, expiresAt: now + windowSeconds * 1000 };
  }

  record.count += 1;
  writeRateLimitCache.set(ip, record);

  return record.count <= limit;
}

// ── SEC-DoW: Cloudflare Turnstile Verification ──────────────────────
export async function verifyTurnstile(
  token: string | null | undefined,
  secretKey: string | undefined,
  clientIp: string
): Promise<boolean> {
  if (!secretKey) return true;
  if (!token) return false;

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(token)}&remoteip=${encodeURIComponent(clientIp)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const result = await res.json() as { success: boolean, 'error-codes'?: string[] };
    if (!result.success) {
      console.warn("[Turnstile] Validation failed:", JSON.stringify(result));
    }
    return result.success === true;
  } catch (err) {
    console.error("[Turnstile] Verification exception:", err);
    return false;
  }
}

// ── Middlewares ────────────────────────────────────────────────────────

/**
 * Middleware: Rate Limit
 */
export const rateLimitMiddleware = (limit = 15, windowSeconds = 60) => {
  return async (c: Context<AppEnv>, next: Next) => {
    const ip = c.req.header("CF-Connecting-IP") || "unknown";
    if (!checkWriteRateLimit(`mw:${ip}`, limit, windowSeconds)) {
      return c.json({ error: "Too many submissions. Please try again later." }, 429);
    }
    await next();
  };
};

/**
 * Middleware: Turnstile Verification
 */
export const turnstileMiddleware = () => {
  return async (c: Context<AppEnv>, next: Next) => {
    const ip = c.req.header("CF-Connecting-IP") || "unknown";
    
    let token: string | undefined;
    try {
      const clonedReq = c.req.raw.clone();
      const body = await clonedReq.json() as { turnstileToken?: string };
      token = body.turnstileToken;
    } catch {
      // Body might not be JSON, skip token extraction
    }

    const valid = await verifyTurnstile(token, c.env.TURNSTILE_SECRET_KEY, ip);
    if (!valid) {
      return c.json({ error: "Security verification failed. Please try again." }, 403);
    }
    await next();
  };
};
