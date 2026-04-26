import { Context, Next } from "hono";
import { AppEnv } from "./utils";
import { Kysely, sql } from "kysely";

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

import { DB } from "../../../shared/schemas/database";

export async function checkPersistentRateLimit(db: Kysely<DB>, ip: string, limit: number, windowSeconds: number): Promise<boolean> {
  if (!db) return true; // Fall open if middleware wasn't attached
  
  const now = Math.floor(Date.now() / 1000);

  try {
    // Cleanup old records occasionally to avoid table bloat
    if (Math.random() < 0.05) {
      db.deleteFrom("rate_limits").where("expires_at", "<", now).execute().catch(console.error);
    }

    const result = await db.insertInto("rate_limits")
      .values({ ip, count: 1, expires_at: now + windowSeconds })
      .onConflict(oc => oc.column("ip").doUpdateSet({
        count: sql`CASE WHEN expires_at < ${now} THEN 1 ELSE count + 1 END`,
        expires_at: sql`CASE WHEN expires_at < ${now} THEN ${now + windowSeconds} ELSE expires_at END`
      }))
      .returning("count")
      .executeTakeFirst();

    return (result?.count ?? 0) <= limit;
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
    // SEC-F01: Harden Turnstile. Fail closed in production.
    // @ts-expect-error - ENVIRONMENT might not be in AppEnv type but exists at runtime
    if (globalThis.process?.env?.ENVIRONMENT === "production" || globalThis.process?.env?.NODE_ENV === "production") {
      console.error("[Turnstile] CRITICAL: TURNSTILE_SECRET_KEY is missing in production! Failing closed.");
      return false;
    }
    console.warn("[Turnstile] TURNSTILE_SECRET_KEY is not configured — CAPTCHA verification is disabled. This is expected in local development but should be resolved in production.");
    return true;
  }
  if (!token) return false;

  // SEC-03: Allow E2E / local development bypass token
  // @ts-expect-error - ENVIRONMENT might not be in AppEnv type but exists at runtime
  const isProd = globalThis.process?.env?.ENVIRONMENT === "production" || globalThis.process?.env?.NODE_ENV === "production";
  if (token === "test-bypass-token" && !isProd) {
    console.warn("[Turnstile] Accepted test-bypass-token in non-production environment.");
    return true;
  }

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(token)}&remoteip=${encodeURIComponent(clientIp)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(5000)
    });

    if (!res.ok) {
      console.error("[Turnstile] Verification request failed:", res.statusText);
      return false;
    }

    const result = await res.json() as { success: boolean, 'error-codes'?: string[] };
    if (result.success !== true) {
      console.warn("[Turnstile] Validation failed:", JSON.stringify(result));
      return false;
    }
    return true;
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
    // SEC-03: Bypass rate limiting in local dev/test if DEV_BYPASS is enabled
    if (c.env.DEV_BYPASS === "true" || c.env.DEV_BYPASS === "1" || c.env.ENVIRONMENT !== "production") {
      return await next();
    }

    const ip = c.req.header("CF-Connecting-IP") || "unknown";
    if (!checkRateLimit(`mw:${ip}`, limit, windowSeconds)) {
      return c.json({ error: "Too many submissions. Please try again later." }, 429);
    }
    await next();
  };
};

/**
 * Middleware: Persistent Rate Limit (D1 Backed)
 */
export const persistentRateLimitMiddleware = (limit = 15, windowSeconds = 60) => {
  return async (c: Context<AppEnv>, next: Next) => {
    if (c.env.DEV_BYPASS === "true" || c.env.DEV_BYPASS === "1" || c.env.ENVIRONMENT !== "production") {
      return await next();
    }
    const ip = c.req.header("CF-Connecting-IP") || "unknown";
    const db = c.get("db");
    const allowed = await checkPersistentRateLimit(db, ip, limit, windowSeconds);
    if (!allowed) {
      return c.json({ error: "Too many requests. Please try again later." }, 429);
    }
    await next();
  };
};

/**
 * Middleware: Turnstile Verification
 */
export const turnstileMiddleware = () => {
  return async (c: Context<AppEnv>, next: Next) => {
    if (c.env.DEV_BYPASS === "true" || c.env.DEV_BYPASS === "1" || c.env.ENVIRONMENT !== "production") {
      return await next();
    }

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
