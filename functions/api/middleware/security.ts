import { Context, Next } from "hono";
import { AppEnv } from "./utils";
import { Kysely, sql } from "kysely";
import { DB } from "../../../shared/schemas/database";

// ── Rate Limiting (Cloudflare KV) ────────────────────────
export async function checkRateLimit(kv: KVNamespace | undefined, ip: string, userAgent: string, limit = 100, windowSeconds = 60): Promise<boolean> {
  if (!kv) return true; // Fall open if KV is not bound
  
  const entropyKey = `${ip}:${userAgent.substring(0, 100)}`;
  const currentCountStr = await kv.get(entropyKey);
  let currentCount = currentCountStr ? parseInt(currentCountStr, 10) : 0;
  
  currentCount += 1;
  
  // Set expiration if it's the first request, otherwise KV handles TTL natively
  if (currentCount === 1) {
    await kv.put(entropyKey, currentCount.toString(), { expirationTtl: windowSeconds });
  } else {
    // Note: KV doesn't support atomic increments or extending TTL on write without reading first.
    // Overwriting the key resets the TTL, which extends the window, but we accept this as a tradeoff for KV.
    await kv.put(entropyKey, currentCount.toString());
  }

  return currentCount <= limit;
}

// ── Write-Endpoint Rate Limiting (Persistent D1) ────────────────────────────

/**
 * Enhanced Persistent Rate Limit Check
 */
export async function checkPersistentRateLimit(db: Kysely<DB>, ip: string, userAgent: string, limit: number, windowSeconds: number): Promise<boolean> {
  if (!db) return true; // Fall open if middleware wasn't attached
  
  const now = Math.floor(Date.now() / 1000);
  // Composite key for D1 storage
  const compositeKey = `${ip}:${userAgent.substring(0, 64)}`;

  try {
    // Cleanup old records occasionally to avoid table bloat
    if (Math.random() < 0.05) {
      db.deleteFrom("ARES_KV").where("expires_at", "<", now).execute().catch(console.error);
    }

    const result = await db.insertInto("ARES_KV")
      .values({ ip: compositeKey, count: 1, expires_at: now + windowSeconds })
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
    if (globalThis.process?.env?.ENVIRONMENT === "production" || globalThis.process?.env?.NODE_ENV === "production") {
      console.error("[Turnstile] CRITICAL: TURNSTILE_SECRET_KEY is missing in production! Failing closed.");
      return false;
    }
    console.warn("[Turnstile] TURNSTILE_SECRET_KEY is not configured — CAPTCHA verification is disabled. This is expected in local development but should be resolved in production.");
    return true;
  }
  if (!token) return false;

  // SEC-03: Allow E2E / local development bypass token
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
    const ua = c.req.header("User-Agent") || "unknown";
    
    // Use the ARES_KV KV namespace bound in wrangler.toml
    const allowed = await checkRateLimit(c.env.ARES_KV, `mw:${ip}`, ua, limit, windowSeconds);
    if (!allowed) {
      const db = c.get("db") as Kysely<DB>;
      if (db) {
        c.executionCtx.waitUntil(
          db.insertInto("audit_log").values({
            id: crypto.randomUUID(),
            action: "SECURITY_BLOCK",
            actor: ip,
            resource_type: "rate_limit",
            details: JSON.stringify({ reason: "KV rate limit exceeded", path: c.req.path, ua })
          }).execute().catch(console.error)
        );
      }
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
    const ua = c.req.header("User-Agent") || "unknown";
    const db = c.get("db");
    const allowed = await checkPersistentRateLimit(db, ip, ua, limit, windowSeconds);
    if (!allowed) {
      if (db) {
        c.executionCtx.waitUntil(
          db.insertInto("audit_log").values({
            id: crypto.randomUUID(),
            action: "SECURITY_BLOCK",
            actor: ip,
            resource_type: "persistent_rate_limit",
            details: JSON.stringify({ reason: "D1 rate limit exceeded", path: c.req.path, ua })
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
      const db = c.get("db") as Kysely<DB>;
      if (db) {
        c.executionCtx.waitUntil(
          db.insertInto("audit_log").values({
            id: crypto.randomUUID(),
            action: "SECURITY_BLOCK",
            actor: ip,
            resource_type: "turnstile",
            details: JSON.stringify({ reason: "Invalid token or CAPTCHA failed", path: c.req.path })
          }).execute().catch(console.error)
        );
      }
      return c.json({ error: "Security verification failed. Please try again." }, 403);
    }
    await next();
  };
};
