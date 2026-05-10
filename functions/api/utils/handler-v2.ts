import type { Context } from "hono";
import type { RouteConfig, RouteHandler } from "@hono/zod-openapi";
import type { z } from "zod";
import type { AppEnv } from "../middleware";
import { ApiError } from "../middleware/errorHandler";
import { InferRouteSuccess, InferRouteError } from "../../../shared/routes/response-inference";

/**
 * Extract input types from a route configuration.
 */
export type RouteInputs<R extends RouteConfig> = {
  params: R extends { request: { params: infer P } }
    ? P extends z.ZodTypeAny ? z.infer<P> : {}
    : {};
  query: R extends { request: { query: infer Q } }
    ? Q extends z.ZodTypeAny ? z.infer<Q> : {}
    : {};
  body: R extends { request: { body: { content: { "application/json": { schema: infer B } } } } }
    ? B extends z.ZodTypeAny ? z.infer<B> : never
    : never;
};

/**
 * The standard result for an autoResponseHandler.
 */
export type HandlerResult<R extends RouteConfig> = {
  status: number;
  body: InferRouteSuccess<R> | InferRouteError<R>;
} | Response;

/**
 * Helper to return a success response.
 */
export const success = <R extends RouteConfig>(body: InferRouteSuccess<R>, status: number = 200): HandlerResult<R> => ({
  status,
  body,
});

/**
 * Helper to return an error response.
 */
export const error = <R extends RouteConfig>(body: InferRouteError<R>, status: number = 500): HandlerResult<R> => ({
  status,
  body,
});

/**
 * Curried handler that automatically extracts validated inputs and standardizes the response flow.
 */
export function autoResponseHandler<R extends RouteConfig>(route: R) {
  return (
    callback: (
      c: Context<AppEnv>,
      inputs: RouteInputs<R>
    ) => Promise<HandlerResult<R>>
  ): RouteHandler<R, AppEnv> => {
    return (async (c: Context<AppEnv>) => {
      try {
        const inputs = extractInputs<R>(c);
        const result = await callback(c as any, inputs as any);

        if (result instanceof Response) {
          return result;
        }

        return c.json(result.body, result.status as any);
      } catch (err) {
        if (err instanceof ApiError) {
          return c.json({ error: err.message }, err.status as any);
        }
        console.error(`[API Error] ${c.req.method} ${c.req.path}:`, err);
        return c.json({ error: err instanceof Error ? err.message : "Internal Server Error" }, 500);
      }
    }) as unknown as RouteHandler<R, AppEnv>;
  };
}

/**
 * Extract validated inputs from the Hono context.
 */
function extractInputs<R extends RouteConfig>(c: Context<AppEnv>): RouteInputs<R> {
  const inputs: any = {
    params: {},
    query: {},
    body: undefined,
  };

  try {
    inputs.params = (c.req as any).valid("param");
  } catch (e) {}

  try {
    inputs.query = (c.req as any).valid("query");
  } catch (e) {}

  try {
    inputs.body = (c.req as any).valid("json");
  } catch (e) {}

  return inputs as RouteInputs<R>;
}
