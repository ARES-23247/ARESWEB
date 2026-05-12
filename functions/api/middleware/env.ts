import { Context, Next } from "hono";
import { AppEnv } from "./utils";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export function getValidatedEnv(runtimeEnv: Record<string, unknown>) {
  const isProd = runtimeEnv.ENVIRONMENT === "production";
  
  return createEnv({
    server: {
      ENVIRONMENT: z.enum(["development", "production", "test"]).default("development").optional(),
      BETTER_AUTH_SECRET: isProd ? z.string().min(1, "Better Auth Secret is required") : z.string().optional().default("test-secret"),
      BETTER_AUTH_URL: isProd ? z.string().url("Valid Better Auth URL is required") : z.string().optional().default("http://localhost:5173"),
      GOOGLE_CLIENT_ID: isProd ? z.string().min(1) : z.string().optional().default(""),
      GOOGLE_CLIENT_SECRET: isProd ? z.string().min(1) : z.string().optional().default(""),
      GITHUB_CLIENT_ID: isProd ? z.string().min(1) : z.string().optional().default(""),
      GITHUB_CLIENT_SECRET: isProd ? z.string().min(1) : z.string().optional().default(""),
      ENCRYPTION_SECRET: isProd ? z.string().min(1) : z.string().optional().default("test-encryption-secret-with-32-chars-long"),
      ZULIP_CLIENT_ID: isProd ? z.string().min(1) : z.string().optional().default(""),
      ZULIP_CLIENT_SECRET: isProd ? z.string().min(1) : z.string().optional().default(""),
      TURNSTILE_SECRET_KEY: z.string().optional(),
      DEV_BYPASS: z.string().optional(),
      CRON_SECRET: z.string().optional(),
      SENTRY_DSN: z.string().optional(),
      YOUTUBE_API_KEY: z.string().optional(),
      YOUTUBE_CLIENT_ID: z.string().optional(),
      YOUTUBE_CLIENT_SECRET: z.string().optional(),
    },
    clientPrefix: "PUBLIC_",
    client: {},
    runtimeEnv: runtimeEnv as Record<string, string | number | boolean | undefined>,
    skipValidation: !!runtimeEnv.SKIP_ENV_VALIDATION || ((globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV === "test"),
    emptyStringAsUndefined: true,
  });
}

let cachedEnv: AppEnv["Bindings"] | null = null;

export const envMiddleware = async (c: Context<AppEnv>, next: Next) => {
  try {
    if (!cachedEnv) {
      cachedEnv = getValidatedEnv(c.env as unknown as Record<string, unknown>) as unknown as AppEnv["Bindings"];
    }
    // SEC-D02: Attach validated env to context for type-safe access
    c.set("env", cachedEnv);
  } catch (err) {
    console.error("Environment Validation Error:", err);
    
    // In production, missing secrets are a fatal configuration error.
    // We block execution to prevent undefined behavior or security bypasses.
    if (c.env?.ENVIRONMENT === "production") {
      return c.json({ 
        error: "Configuration Error", 
        message: "The server is missing required environment variables." 
      }, 500);
    }
  }
  await next();
};
