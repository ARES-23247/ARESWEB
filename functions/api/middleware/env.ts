import { Context, Next } from "hono";
import { AppEnv } from "./utils";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export function getValidatedEnv(runtimeEnv: Record<string, unknown>) {
  return createEnv({
    server: {
      ENVIRONMENT: z.enum(["development", "production", "test"]).default("development").optional(),
      BETTER_AUTH_SECRET: z.string().min(1, "Better Auth Secret is required"),
      BETTER_AUTH_URL: z.string().url("Valid Better Auth URL is required"),
      GOOGLE_CLIENT_ID: z.string().min(1),
      GOOGLE_CLIENT_SECRET: z.string().min(1),
      GITHUB_CLIENT_ID: z.string().min(1),
      GITHUB_CLIENT_SECRET: z.string().min(1),
      ENCRYPTION_SECRET: z.string().min(1),
      ZULIP_CLIENT_ID: z.string().min(1),
      ZULIP_CLIENT_SECRET: z.string().min(1),
      DEV_BYPASS: z.string().optional(),
      LIVEBLOCKS_SECRET_KEY: z.string().min(1, "Liveblocks Secret is required"),
      CRON_SECRET: z.string().optional(),
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
