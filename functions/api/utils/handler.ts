import type { RouteConfig, RouteHandler } from "@hono/zod-openapi";
import type { AppEnv } from "../middleware";

/**
 * Type-safe wrapper for Hono OpenAPI handlers.
 * Extracts parameter/query/body types from the RouteConfig and eliminates the need for `as any` or manual casting.
 */
export const typedHandler = <R extends RouteConfig>(
  handler: RouteHandler<R, AppEnv>
) => handler;
