import { Context, Next } from "hono";
import { AppEnv } from "./utils";

// ── Rate Limiting (In-Memory Worker V8 Isolate) ────────────────────────
const MAX_RATE_LIMIT_CACHE = 500;
const rateLimitCache = new Map<string, { count: number; expiresAt: number }>();

function pruneCache(cache: Map<string, unknown>) {
  if (cache.size >= MAX_RATE_LIMIT_CACHE) {
    const first = cache.keys().next().value;
    if (first !== undefined) cache.delete(first);
  }
}

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
    pruneCache(rateLimitCache);
    record = { count: 0, expiresAt: now + windowSeconds * 1000 };
  }

  record.count += 1;
  rateLimitCache.set(ip, record);

  return record.count <= limit;
}

// ── Write-Endpoint Rate Limiting (Persistent D1) ────────────────────────────

export async function checkPersistentRateLimit(db: D1Database, ip: string, limit: number, windowSeconds: number): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  
  // Cleanup old records occasionally to avoid table bloat
  if (Math.random() < 0.05) {
    db.prepare("DELETE FROM rate_limits WHERE expires_at < ?").bind(now).run().catch(console.error);
  }

  try {
    const row = await db.prepare("SELECT count, expires_at FROM rate_limits WHERE ip = ?").bind(ip).first<{ count: number, expires_at: number }>();
    if (!row || row.expires_at < now) {
      await db.prepare("INSERT OR REPLACE INTO rate_limits (ip, count, expires_at) VALUES (?, 1, ?)").bind(ip, now + windowSeconds).run();
      return true;
    }
    if (row.count >= limit) return false;
    
    await db.prepare("UPDATE rate_limits SET count = count + 1 WHERE ip = ?").bind(ip).run();
    return true;
  } catch (err) {
    console.error("[RateLimit] Persistent check failed:", err);
    // Fall open on DB error or missing table so we don't bring down the API
    return true;
  }
}

// ── SEC-DoW: Cloudflare Turnstile Verification ──────────────────────
export async function verifyTurnstile(
  token: string | null | undefined,
  secretKey: string | undefined,
  clientIp: string
): Promise<boolean> {
  if (!secretKey) {
    console.warn("[Turnstile] TURNSTILE_SECRET_KEY is not configured — CAPTCHA verification is disabled. This is expected in local development but should be resolved in production.");
    return true;
  }
  if (!token) return false;

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(token)}&remoteip=${encodeURIComponent(clientIp)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(5000)
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
    if (!checkRateLimit(`mw:${ip}`, limit, windowSeconds)) {
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
    const contentType = c.req.header("Content-Type") || "";
    
    let token: string | undefined;
    try {
      if (contentType.includes("application/json")) {
        const clonedReq = c.req.raw.clone();
        const body = await clonedReq.json() as { turnstileToken?: string };
        token = body.turnstileToken;
      } else if (contentType.includes("multipart/form-data")) {
        const clonedReq = c.req.raw.clone();
        const formData = await clonedReq.formData();
        token = formData.get("turnstileToken") as string;
      }
    } catch (err) {
      console.error("[Turnstile] Token extraction failed:", err);
    }

    const valid = await verifyTurnstile(token, c.env.TURNSTILE_SECRET_KEY, ip);
    if (!valid) {
      return c.json({ error: "Security verification failed. Please try again." }, 403);
    }
    await next();
  };
};
