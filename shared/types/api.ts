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
 * @deprecated Use AppRouteInput from ts-rest-hono for ts-rest handlers.
 * This type is still useful for non-ts-rest Hono middleware.
 * @see Migration guide in Phase 29 summary.
 */
export type HandlerInput<
  TBody = unknown,
  TParams extends Record<string, string> = Record<string, string>,
> = {
  body: TBody;
  query: Record<string, string>;
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
 * Custom Zod type extractor to bypass @ts-rest/core incompatibilities with zod v4 internals.
 */
type InferZodOrType<T> = T extends z.ZodTypeAny 
  ? z.infer<T> 
  : T extends { _type: infer U } 
    ? U 
    : T;

/**
 * Custom ServerInferRequest to provide strict typing without hitting ts-rest AppRoute limits.
 * Replaces import { ServerInferRequest } from "@ts-rest/core".
 */
export type ServerInferRequest<T> = {
  params: T extends { pathParams: infer P } ? InferZodOrType<P> : never;
  body: T extends { body: infer B } ? InferZodOrType<B> : never;
  query: T extends { query: infer Q } ? InferZodOrType<Q> : never;
  headers: T extends { headers: infer H } ? InferZodOrType<H> : never;
};
