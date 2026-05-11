/**
 * Hono API handler types and context utilities.
 * Provides type-safe context and handler input/output contracts.
 */

import type { Context } from "hono";
import type {
  AppEnv as MiddlewareAppEnv,
} from "../../functions/api/middleware/utils";

/**
 * Branded Hono context type with ARES Bindings and Variables.
 * Re-exports AppEnv from middleware to avoid circular dependencies.
 */
export type { AppEnv as MiddlewareAppEnv } from "../../functions/api/middleware/utils";

export type AppEnv = MiddlewareAppEnv;

/**
 * Hono context with ARES-specific environment bindings.
 */
export type HonoContext = Context<AppEnv>;

/**
 * Standard handler input structure with typed body and params.
 *
 * Useful for non-OpenAPI Hono middleware and custom handlers.
 */
export type HandlerInput<
  TBody = unknown,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic type parameters for dynamic records
  TParams extends Record<string, any> = Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic type parameters for dynamic records
  TQuery extends Record<string, any> = Record<string, any>
> = {
  body: TBody;
  query: TQuery;
  params: TParams;
};

/**
 * Standard handler output structure with status and typed body.
 */
export type HandlerOutput<TBody = unknown> = {
  status: number;
  body: TBody;
};

import { z } from "zod";

/**
 * Custom Zod type extractor for OpenAPI route inference.
 */
type InferZodOrType<T> = T extends z.ZodTypeAny
  ? z.infer<T>
  : T extends { _type: infer U }
    ? U
    : T;

/**
 * Custom ServerInferRequest for OpenAPI route type inference.
 * Extracts params, body, query, and headers types from OpenAPI route definitions.
 */
export type ServerInferRequest<T> = {
  params: T extends { pathParams: infer P } ? InferZodOrType<P> : never;
  body: T extends { body: infer B } ? InferZodOrType<B> : never;
  query: T extends { query: infer Q } ? InferZodOrType<Q> : never;
  headers: T extends { headers: infer H } ? InferZodOrType<H> : never;
};

/**
 * Extract the body type for a specific status code from an OpenAPI route definition.
 */
export type RouteResponseBody<T, Status extends number = 200> = T extends {
  responses: { [K in Status]: { content: { "application/json": { schema: infer S } } } };
}
  ? S extends z.ZodTypeAny
    ? z.infer<S>
    : never
  : never;

/**
 * Custom RouteResponse type for OpenAPI route inference.
 * Extracts the 200 response JSON body type from an OpenAPI route definition.
 * Kept for backward compatibility with existing code that expects just the body.
 */
export type RouteResponse<T> = RouteResponseBody<T, 200>;

/**
 * Full response type for an OpenAPI route handler, including status and body.
 * Supports all status codes defined in the route responses.
 */
export type ApiResponse<T> = T extends { responses: infer R }
  ? {
      [K in keyof R & number]: {
        status: K;
        body: R[K] extends { content: { "application/json": { schema: infer S } } }
          ? S extends z.ZodTypeAny
            ? z.infer<S>
            : never
          : never;
      };
    }[keyof R & number]
  : never;
