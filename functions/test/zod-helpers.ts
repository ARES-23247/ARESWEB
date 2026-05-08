import { z } from "zod";

/**
 * Helper to extract the schema type from a route's response content
 * Extracts the schema from T["responses"][Status]["content"]["application/json"]["schema"]
 */
type ExtractSchema<T> = T extends { content: { "application/json": { schema: infer S } } } ? S : never;

/**
 * Helper to infer the response type from an OpenAPI route definition
 * Usage: type RouteResponse = InferRouteResponse<typeof listTasksRoute, 200>
 */
export type InferRouteResponse<
  T extends { responses: Record<number, unknown> },
  Status extends number
> = z.infer<ExtractSchema<T["responses"][Status]>>;

/**
 * Helper to infer the request body type from an OpenAPI route definition
 */
export type InferRouteBody<T> = T extends { request: { body: { content: { "application/json": { schema: infer S } } } } }
  ? z.infer<S>
  : never;

/**
 * Helper to infer the query params type from an OpenAPI route definition
 */
export type InferRouteQuery<T> = T extends { request: { query: infer S } } ? z.infer<S> : never;

/**
 * Helper to infer request body from route and validate/parse it
 */
export function parseBodyMock<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  return schema.parse(data);
}

/**
 * Create a typed mock response for a route
 */
export function mockRouteResponse<
  T extends { responses: Record<number, unknown> },
  Status extends number,
  R = z.infer<ExtractSchema<T["responses"][Status]>>
>(route: T, status: Status, data: R): R {
  return data;
}
