import { Context, Next } from "hono";
import { AppEnv } from "./utils";
import { DrizzleD1Database } from "drizzle-orm/d1";
import { sql } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import * as relations from "../../../src/db/relations";

type DrizzleDb = DrizzleD1Database<typeof schema & typeof relations>;

// ── Global KV Rate limiting removed. Use D1 persistent checks instead. ────────────────────────

// ── Write-Endpoint Rate Limiting (Persistent D1) ────────────────────────────

/**
 * Enhanced Persistent Rate Limit Check
 */
export async function checkPersistentRateLimit(db: DrizzleDb, ip: string, userAgent: string, limit: number, windowSeconds: number, path: string = ""): Promise<boolean> {
  if (!db) return true; // Fall open if middleware wasn't attached

  const now = Math.floor(Date.now() / 1000);
  // Composite key for D1 storage
  const compositeKey = `${ip}:${userAgent.substring(0, 64)}`;

  try {
    // Cleanup old records occasionally to avoid table bloat
    if (Math.random() < 0.05) {
      db.delete(schema.rateLimits).where(sql`expires_at < ${now}`).execute().catch(console.error);
    }

    const result = await db.insert(schema.rateLimits)
      .values({ ip: compositeKey, count: 1, expiresAt: now + windowSeconds })
      .onConflictDoUpdate({
        target: schema.rateLimits.ip,
        set: {
          count: sql`CASE WHEN expires_at < ${now} THEN 1 ELSE count + 1 END`,
          expiresAt: sql`CASE WHEN expires_at < ${now} THEN ${now + windowSeconds} ELSE expires_at END`
        }
      })
      .returning({ count: schema.rateLimits.count, expiresAt: schema.rateLimits.expiresAt });

    const count = result[0]?.count ?? 0;
    const expires = result[0]?.expiresAt ?? 0;
    const allowed = count <= limit;

    // Log rate limit checks for debugging
    console.log(`[RateLimit] ${path || "unknown"} IP=${ip} count=${count}/${limit} allowed=${allowed} expires_at=${expires} now=${now}`);

    return allowed;
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
    if (globalThis.process?.env?.ENVIRONMENT === "production" || globalThis.process?.env?.NODE_ENV === "production") {
      console.error("[Turnstile] CRITICAL: TURNSTILE_SECRET_KEY is missing in production! Failing closed.");
      return false;
    }
    console.warn("[Turnstile] TURNSTILE_SECRET_KEY is not configured — CAPTCHA verification is disabled. This is expected in local development but should be resolved in production.");
    return true;
  }
  if (!token) return false;

  // SEC-03: Allow E2E / local development bypass token
  // Fail-closed: only allow bypass token in known non-production environments
  const isProd = globalThis.process?.env?.ENVIRONMENT === "production" || globalThis.process?.env?.NODE_ENV === "production";
  const isDevOrTest = globalThis.process?.env?.ENVIRONMENT === "development" || globalThis.process?.env?.NODE_ENV === "development" || globalThis.process?.env?.NODE_ENV === "test";
  // Only accept bypass token in dev/test, never in production or preview
  if (token === "test-bypass-token" && !isProd && isDevOrTest) {
    console.warn("[Turnstile] Accepted test-bypass-token in development environment.");
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
  return persistentRateLimitMiddleware(limit, windowSeconds);
};

/**
 * Middleware: Persistent Rate Limit (D1 Backed)
 */
export const persistentRateLimitMiddleware = (limit = 15, windowSeconds = 60) => {
  return async (c: Context<AppEnv>, next: Next) => {
    // Only bypass if explicitly requested via DEV_BYPASS
    if (c.env.DEV_BYPASS === "true" || c.env.DEV_BYPASS === "1") {
      return await next();
    }
    const ip = c.req.header("CF-Connecting-IP") || "unknown";
    const ua = c.req.header("User-Agent") || "unknown";
    const db = c.get("db") as any;
    const allowed = await checkPersistentRateLimit(db, ip, ua, limit, windowSeconds, c.req.path);
    if (!allowed) {
      if (db) {
        c.executionCtx.waitUntil(
          db.insert(schema.auditLog).values({
            id: crypto.randomUUID(),
            action: "SECURITY_BLOCK",
            actor: ip,
            resourceType: "persistent_rate_limit",
            details: JSON.stringify({ reason: "D1 rate limit exceeded", path: c.req.path, ua, limit, windowSeconds })
          }).execute().catch(console.error)
        );
      }
      return c.json({ error: "Too many requests. Please try again later." }, 429);
    }
    await next();
  };
};

/**
 * Middleware: Origin Integrity
 * Checks Origin and Referer headers for non-GET requests to ensure they come from trusted domains.
 */
export const originIntegrityMiddleware = () => {
  return async (c: Context<AppEnv>, next: Next) => {
    // 0. Skip for local development/testing with DEV_BYPASS
    if (c.env.DEV_BYPASS === "true" || c.env.DEV_BYPASS === "1") {
      return await next();
    }

    // 1. Skip for GET/OPTIONS/HEAD (read-only or preflight)
    if (["GET", "OPTIONS", "HEAD"].includes(c.req.method)) {
      return await next();
    }

    // 2. Skip for Webhooks (external services)
    if (c.req.path.includes("/webhooks/")) {
      return await next();
    }

    const origin = c.req.header("Origin");
    const referer = c.req.header("Referer");
    const userAgent = c.req.header("User-Agent") || "";

    // 3. SEC-H01: Block headless bots / scripts that omit both Origin and Referer on state-changing requests
    if (!origin && !referer) {
      console.warn(`[Security] Origin Integrity: Blocked request missing both headers. Method: ${c.req.method}, Path: ${c.req.path}, UA: ${userAgent}`);
      return c.json({ error: "Security check failed: Origin integrity required." }, 403);
    }

    // 4. Validate Trusted Origins/Referers
    const isTrusted = (val: string | undefined) => {
      if (!val) return false;
      try {
        const url = new URL(val.startsWith("http") ? val : `https://${val}`);
        const domain = url.hostname;
        return (
          domain === "aresfirst.org" ||
          domain === "localhost" ||
          domain === "127.0.0.1" ||
          domain.endsWith(".aresfirst.org") ||
          domain.endsWith(".pages.dev")
        );
      } catch {
        return false;
      }
    };

    if (origin && !isTrusted(origin)) {
      console.warn(`[Security] Origin Integrity: Untrusted Origin blocked: ${origin}`);
      return c.json({ error: "Untrusted request origin." }, 403);
    }

    if (!origin && referer && !isTrusted(referer)) {
       console.warn(`[Security] Origin Integrity: Untrusted Referer blocked: ${referer}`);
       return c.json({ error: "Untrusted request source." }, 403);
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
      const db = c.get("db") as any;
      if (db) {
        c.executionCtx.waitUntil(
          db.insert(schema.auditLog).values({
            id: crypto.randomUUID(),
            action: "SECURITY_BLOCK",
            actor: ip,
            resourceType: "turnstile",
            details: JSON.stringify({ reason: "Invalid token or CAPTCHA failed", path: c.req.path })
          }).execute().catch(console.error)
        );
      }
      return c.json({ error: "Security verification failed. Please try again." }, 403);
    }
    await next();
  };
};

/**
 * Middleware: Content-Type Validation
 * Validates Content-Type header for POST/PUT/PATCH requests to prevent parsing errors.
 */
export const contentTypeValidationMiddleware = () => {
  return async (c: Context<AppEnv>, next: Next) => {
    if (["POST", "PUT", "PATCH"].includes(c.req.method)) {
      const contentType = c.req.header("Content-Type");
      if (contentType &&
          !contentType.includes("application/json") &&
          !contentType.includes("multipart/form-data") &&
          !contentType.includes("application/x-www-form-urlencoded") &&
          !contentType.includes("text/plain")) {
        return c.json({ error: "Unsupported content type" }, 415);
      }
    }
    await next();
  };
};
