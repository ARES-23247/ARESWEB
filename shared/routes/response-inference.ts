/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ROUTE RESPONSE TYPE INFERENCE UTILITIES
 * ─────────────────────────────────────────────────────────────────────────────
 * Automatically extract response types from OpenAPI route definitions,
 * eliminating the need for manual type extraction in every handler.
 *
 * Usage:
 *   import { type InferRouteSuccess, type InferRouteInputs } from '@shared/routes/response-inference';
 *   import { saveEventRoute } from '@shared/routes/events';
 *
 *   type SuccessResponse = InferRouteSuccess<typeof saveEventRoute>;
 *   type RouteInputs = InferRouteInputs<typeof saveEventRoute>;
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { RouteConfig } from '@hono/zod-openapi';
import type { z } from 'zod';

/**
 * Extract the success response type from a route definition.
 * Supports custom success codes (200, 201, 202, 204).
 *
 * @example
 * type GetEventsSuccess = InferRouteSuccess<typeof getEventsRoute>; // Defaults to 200
 * type CreateEventSuccess = InferRouteSuccess<typeof createEventRoute, 201>; // Use 201
 */
export type InferRouteSuccess<R extends RouteConfig> =
  (200 extends keyof R['responses'] ? R['responses'][200] : '200' extends keyof R['responses'] ? R['responses']['200'] : never) extends { content: { 'application/json': { schema: infer S } } }
    ? z.infer<S>
    : (201 extends keyof R['responses'] ? R['responses'][201] : '201' extends keyof R['responses'] ? R['responses']['201'] : never) extends { content: { 'application/json': { schema: infer S } } }
      ? z.infer<S>
      : (202 extends keyof R['responses'] ? R['responses'][202] : '202' extends keyof R['responses'] ? R['responses']['202'] : never) extends { content: { 'application/json': { schema: infer S } } }
        ? z.infer<S>
        : (204 extends keyof R['responses'] ? R['responses'][204] : '204' extends keyof R['responses'] ? R['responses']['204'] : never) extends { content: { 'application/json': { schema: infer S } } }
          ? z.infer<S>
          : never;

/**
 * Extract error response type from a route definition.
 *
 * @example
 * type ErrorResponse = InferRouteError<typeof getEventsRoute, 500>;
 */
export type InferRouteError<
  R extends RouteConfig,
  ErrorCode extends keyof R['responses'] = 500
> = R['responses'][ErrorCode] extends { content: { 'application/json': { schema: infer S } } }
  ? z.infer<S>
  : never;

/**
 * Extract all possible response types from a route.
 *
 * @example
 * type AllResponses = InferRouteAllResponses<typeof getEventsRoute>;
 */
export type InferRouteAllResponses<R extends RouteConfig> = {
  [K in keyof R['responses']]: R['responses'][K] extends { content: { 'application/json': { schema: infer S } } }
    ? z.infer<S>
    : never;
};

/**
 * Extract request input types from a route definition.
 *
 * @example
 * type RouteInputs = InferRouteInputs<typeof saveEventRoute>;
 * // { params: { id: string }, query: {}, body: { title: string, ... } }
 */
export type InferRouteInputs<R extends RouteConfig> = {
  params: R extends { request: { params: infer P } } ? P extends z.ZodTypeAny ? z.infer<P> : {} : {};
  query: R extends { request: { query: infer Q } } ? Q extends z.ZodTypeAny ? z.infer<Q> : {} : {};
  body: R extends { request: { body: { content: { 'application/json': { schema: infer B } } } } }
    ? B extends z.ZodTypeAny ? z.infer<B> : never
    : never;
};

/**
 * Type guard to check if a handler result is a success response.
 *
 * @example
 * if (isSuccessResponse(result, [200, 201])) {
 *   return c.json(result.body, result.status);
 * }
 */
export function isSuccessResponse<T>(
  result: { status: number; body: T },
  successCodes: number[] = [200, 201, 202, 204]
): result is { status: typeof successCodes[number]; body: T } {
  return successCodes.includes(result.status);
}

/**
 * Type guard to check if a handler result is an error response.
 *
 * @example
 * if (isErrorResponse(result, [400, 401, 404, 500])) {
 *   return c.json(result.body, result.status);
 * }
 */
export function isErrorResponse<T>(
  result: { status: number; body: T },
  errorCodes: number[] = [400, 401, 403, 404, 500]
): result is { status: typeof errorCodes[number]; body: T } {
  return errorCodes.includes(result.status);
}

/**
 * Extract the request body type from a route.
 *
 * @example
 * type SaveEventBody = InferRouteBody<typeof saveEventRoute>;
 */
export type InferRouteBody<R extends RouteConfig> = R['requestBody'] extends {
  content: { 'application/json': { schema: infer S } };
}
  ? z.infer<S>
  : never;

/**
 * Extract the path params type from a route.
 *
 * @example
 * type EventParams = InferRouteParams<typeof getEventRoute>; // { id: string }
 */
export type InferRouteParams<R extends RouteConfig> = R extends { request: { params: infer P } }
  ? P extends z.ZodTypeAny ? z.infer<P> : {}
  : {};

/**
 * Extract the query params type from a route.
 *
 * @example
 * type EventQuery = InferRouteQuery<typeof getEventsRoute>; // { limit?: number, q?: string }
 */
export type InferRouteQuery<R extends RouteConfig> = R extends { request: { query: infer Q } }
  ? Q extends z.ZodTypeAny ? z.infer<Q> : {}
  : {};

/**
 * Success status codes that indicate a successful operation.
 */
export const SUCCESS_STATUS_CODES = [200, 201, 202, 204] as const;
export type SuccessStatusCode = typeof SUCCESS_STATUS_CODES[number];

/**
 * Error status codes that indicate a failed operation.
 */
export const ERROR_STATUS_CODES = [400, 401, 403, 404, 409, 422, 429, 500] as const;
export type ErrorStatusCode = typeof ERROR_STATUS_CODES[number];

/**
 * Type-safe handler result wrapper.
 * Provides discriminated union for success/error states.
 *
 * @example
 * type HandlerResult<TSuccess, TError = { error: string }> =
 *   | { success: true; status: SuccessStatusCode; body: TSuccess }
 *   | { success: false; status: ErrorStatusCode; body: TError };
 */
export type HandlerResult<TSuccess, TError = { error: string }> =
  | { success: true; status: SuccessStatusCode; body: TSuccess }
  | { success: false; status: ErrorStatusCode; body: TError };

/**
 * Create a success result.
 *
 * @example
 * return success({ id: '123', title: 'Event' });
 * return success({ id: '123' }, 201);
 */
export function success<T>(body: T, status: SuccessStatusCode = 200): HandlerResult<T> {
  return { success: true, status, body };
}

/**
 * Create an error result.
 *
 * @example
 * return error({ error: 'Not found' }, 404);
 * return error({ error: 'Validation failed', details: ['title is required'] }, 400);
 */
export function error<T = { error: string }>(body: T, status: ErrorStatusCode = 500): HandlerResult<never, T> {
  return { success: false, status, body };
}

/**
 * Narrow a handler result to success type.
 *
 * @example
 * if (isSuccess(result)) {
 *   // result.body is typed as TSuccess
 *   return c.json(result.body, result.status);
 * }
 */
export function isSuccess<TSuccess, TError>(
  result: HandlerResult<TSuccess, TError>
): result is Extract<HandlerResult<TSuccess, TError>, { success: true }> {
  return result.success === true;
}

/**
 * Narrow a handler result to error type.
 *
 * @example
 * if (isError(result)) {
 *   // result.body is typed as TError
 *   return c.json(result.body, result.status);
 * }
 */
export function isError<TSuccess, TError>(
  result: HandlerResult<TSuccess, TError>
): result is Extract<HandlerResult<TSuccess, TError>, { success: false }> {
  return result.success === false;
}

/**
 * Extract the success body type from a HandlerResult.
 *
 * @example
 * type SuccessBody = HandlerSuccessBody<HandlerResult<Event, Error>>; // Event
 */
export type HandlerSuccessBody<T extends HandlerResult<any, any>> = T extends { success: true; body: infer B }
  ? B
  : never;

/**
 * Extract the error body type from a HandlerResult.
 *
 * @example
 * type ErrorBody = HandlerErrorBody<HandlerResult<Event, Error>>; // Error
 */
export type HandlerErrorBody<T extends HandlerResult<any, any>> = T extends { success: false; body: infer E }
  ? E
  : never;

/**
 * Create a type-safe response handler from a route definition.
 * Automatically infers success/error types and provides typed helper methods.
 *
 * @example
 * const handler = createResponseHandler<typeof getEventsRoute>();
 * // handler.success(body) -> typed as GetEventsSuccess
 * // handler.error(message, status) -> typed as error response
 */
export function createResponseHandler<R extends RouteConfig>(
  _route: R
): ResponseHandler<R> {
  return {
    success: (body: InferRouteSuccess<R>, status?: number) => ({ status: status ?? 200, body }),
    error: (body: InferRouteError<R>, status: number = 500) => ({ status, body }),
  } as ResponseHandler<R>;
}

/**
 * Response handler type with typed success/error methods.
 */
export type ResponseHandler<R extends RouteConfig> = {
  success: (body: InferRouteSuccess<R>, status?: number) => { status: number; body: InferRouteSuccess<R> };
  error: (body: InferRouteError<R>, status?: number) => { status: number; body: InferRouteError<R> };
};

/**
 * Extract the HTTP method from a route.
 *
 * @example
 * type GetEventsMethod = RouteMethod<typeof getEventsRoute>; // 'get'
 */
export type RouteMethod<R extends RouteConfig> = R['method'];

/**
 * Extract the path from a route.
 *
 * @example
 * type GetEventsPath = RoutePath<typeof getEventsRoute>; // '/'
 */
export type RoutePath<R extends RouteConfig> = R['path'];
