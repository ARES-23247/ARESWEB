/**
 * ─────────────────────────────────────────────────────────────────────────────
 * DRIZZLE TO OPENAPI SCHEMA TRANSFORMS
 * ─────────────────────────────────────────────────────────────────────────────
 * Auto-generates OpenAPI-ready response schemas from Drizzle select schemas.
 * Ensures Drizzle is the single source of truth for API contracts.
 *
 * IMPORTANT: Use this instead of manually defining response schemas like
 * "eventResponseSchema". The schema should ALWAYS derive from Drizzle.
 *
 * Usage:
 *   import { createResponseSchema } from '@shared/db/schema-openapi';
 *   import { selectEventSchema } from '@shared/db/schema-zod';
 *
 *   // Auto-generate with OpenAPI metadata
 *   export const eventResponseSchema = createResponseSchema(selectEventSchema, {
 *     title: 'Event Response',
 *     example: { id: '123', title: 'Kickoff Meeting' }
 *   });
 *
 *   // For nested relations (pick only needed fields)
 *   export const eventSummarySchema = createResponseSchema(
 *     selectEventSchema.pick({ id: true, title: true, dateStart: true }),
 *     { title: 'Event Summary' }
 *   );
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { z } from 'zod';
import type { ZodTypeAny, ZodObject } from 'zod';

/**
 * OpenAPI metadata for schema documentation
 */
interface OpenAPIMeta {
  title?: string;
  description?: string;
  example?: Record<string, unknown>;
  excludeFields?: string[];
}

/**
 * Drizzle uses snake_case, but API responses should use camelCase.
 * This provides a default mapping for common fields.
 */
const _CAMEL_CASE_ALIASES: Record<string, string> = {
  dateStart: 'dateStart',
  dateEnd: 'dateEnd',
  coverImage: 'coverImage',
  tbaEventKey: 'tbaEventKey',
  isPotluck: 'isPotluck',
  isVolunteer: 'isVolunteer',
  seasonId: 'seasonId',
  meetingNotes: 'meetingNotes',
  isDeleted: 'isDeleted',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  gcalEventId: 'gcalEventId',
  recurringGroupId: 'recurringGroupId',
  recurringException: 'recurringException',
  originalStartTime: 'originalStartTime',
  parentEventId: 'parentEventId',
  recurrenceRule: 'recurrenceRule',
  updateMode: 'updateMode',
  deleteMode: 'deleteMode',
  cfEmail: 'cfEmail',
  zulipStream: 'zulipStream',
  zulipTopic: 'zulipTopic',
  isDraft: 'isDraft',
  isPortfolio: 'isPortfolio',
  publishedAt: 'publishedAt',
  showOnAbout: 'showOnAbout',
  dietaryRestrictions: 'dietaryRestrictions',
  prepHours: 'prepHours',
  isOwn: 'isOwn',
  locationAddress: 'locationAddress',
};

/**
 * Create an OpenAPI-ready response schema from a Drizzle Zod schema.
 *
 * @param baseSchema - The select/insert schema from Drizzle
 * @param meta - OpenAPI metadata and field exclusions
 * @returns A Zod schema with OpenAPI metadata attached
 *
 * @example
 * export const eventResponseSchema = createResponseSchema(selectEventSchema, {
 *   title: 'Event',
 *   excludeFields: ['gcalEventId', 'revisionOf'], // Internal fields
 *   example: { id: '123', title: 'Meeting', dateStart: '2025-01-15T10:00:00Z' }
 * });
 */
export function createResponseSchema<T extends ZodTypeAny>(
  baseSchema: T,
  meta: OpenAPIMeta = {}
): T {
  let schema: ZodTypeAny = baseSchema;

  // Handle ZodObject schemas (most common)
  if (isZodObject(schema)) {
    const baseShape = schema.shape;
    const newShape: Record<string, ZodTypeAny> = {};

    // Process each field
    for (const [key, value] of Object.entries(baseShape)) {
      // Skip excluded fields
      if (meta.excludeFields?.includes(key)) {
        continue;
      }

      let fieldSchema = value as ZodTypeAny;

      // Add OpenAPI metadata if provided
      if (meta.title || meta.description || meta.example) {
        const fieldMeta = {
          description: meta.description,
        };

        // Add example for specific field if provided
        if (meta.example && key in meta.example) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (fieldMeta as any).example = (meta.example as Record<string, unknown>)[key];
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fieldSchema = (value as any).describe?.(meta.description) ?? value;
      }

      newShape[key] = fieldSchema;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema = z.object(newShape) as z.ZodObject<any>;
  }

  // Add top-level OpenAPI metadata
  if (meta.title || meta.description) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema = (schema as any).describe?.(meta.description || meta.title) ?? schema;
  }

  return schema as unknown as T;
}

/**
 * Create a paginated response schema from any item schema.
 *
 * @param itemSchema - Schema for individual items
 * @param meta - Optional metadata
 * @returns Schema with { items: T[], total?: number, nextCursor?: string }
 *
 * @example
 * export const paginatedEventsSchema = createPaginatedSchema(eventResponseSchema, {
 *   title: 'Paginated Events'
 * });
 */
export function createPaginatedSchema<T extends ZodTypeAny>(
  itemSchema: T,
  meta: OpenAPIMeta = {}
) {
  const paginatedSchema = z.object({
    items: z.array(itemSchema),
    total: z.number().optional().openapi({
      description: 'Total count of items (when not using cursor pagination)',
    }),
    nextCursor: z.string().nullable().optional().openapi({
      description: 'Cursor for next page (for cursor-based pagination)',
    }),
    hasMore: z.boolean().optional().openapi({
      description: 'Whether more items exist',
    }),
  });

  if (meta.title) {
    return paginatedSchema.describe(meta.title) as unknown as typeof paginatedSchema;
  }

  return paginatedSchema;
}

/**
 * Create a schema that includes relations (nested objects).
 * Use when your API returns data with JOINed relations.
 *
 * @param baseSchema - The primary entity schema
 * @param relations - Map of relation name to schema
 * @param meta - Optional metadata
 *
 * @example
 * export const eventWithSignupsSchema = createRelationSchema(
 *   selectEventSchema,
 *   {
 *     signups: z.array(selectEventSignupSchema),
 *     location: selectLocationSchema.pick({ name: true, address: true }).nullish(),
 *   }
 * );
 */
export function createRelationSchema<T extends ZodTypeAny>(
  baseSchema: T,
  relations: Record<string, ZodTypeAny>,
  meta: OpenAPIMeta = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): z.ZodObject<any> {
  if (!isZodObject(baseSchema)) {
    throw new Error('createRelationSchema requires a ZodObject as baseSchema');
  }

  const baseShape = baseSchema.shape;
  const relationSchema = z.object({
    ...Object.fromEntries(
      Object.entries(baseShape).map(([k, v]) => [k, v as ZodTypeAny])
    ),
    ...relations,
  });

  if (meta.title) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return relationSchema.describe(meta.title) as any;
  }

  return relationSchema;
}

/**
 * Helper to check if a schema is a ZodObject
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isZodObject(schema: ZodTypeAny): schema is ZodObject<any> {
  return 'shape' in schema && typeof schema.shape === 'object';
}

/**
 * Common response wrappers
 */
export const responseWrappers = {
  /**
   * Single item response: { item: T }
   */
  item: <T extends ZodTypeAny>(itemSchema: T) =>
    z.object({
      item: itemSchema,
    }),

  /**
   * Success response: { success: true, [key: string]: unknown }
   */
  success: () =>
    z.object({
      success: z.boolean(),
    }),

  /**
   * ID response: { id: string }
   */
  id: () =>
    z.object({
      id: z.string().openapi({ example: '123' }),
    }),

  /**
   * Created response: { success: true, id: string }
   */
  created: () =>
    z.object({
      success: z.boolean().openapi({ example: true }),
      id: z.string().optional().openapi({ example: '123' }),
      warning: z.string().optional(),
    }),
};

export function toCamelCaseResponse<T extends ZodTypeAny>(
  schema: T
): T {
  // Drizzle ORM handles snake_case to camelCase mapping natively at the query level.
  // This legacy function is now an identity pass-through to preserve types without breaking runtime.
  return schema;
}

/**
 * Convert snake_case to camelCase
 */
function _toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Create a Hono route handler with full type inference from the route definition.
 * This is the RECOMMENDED way to write handlers - no manual type assertions needed.
 *
 * @example
 * import { createHandler } from '@shared/db/schema-openapi';
 * import { getEventsRoute } from '@shared/routes/events';
 * import { eventHandlers } from './handlers';
 *
 * eventsRouter.openapi(
 *   getEventsRoute,
 *   createHandler(getEventsRoute, async (c, input) => {
 *     // input.query is fully typed from route definition
 *     const result = await eventHandlers.getEvents(input);
 *     if (result.status === 200) return c.json(result.body, 200);
 *     throw new ApiError(result.body.error, result.status);
 *   })
 * );
 */
export function createHandler<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Route extends { request: { params?: any; query?: any; body?: any } },
  TInput = {
    params: Route['request']['params'] extends z.ZodTypeAny
      ? z.infer<Route['request']['params']>
      : {};
    query: Route['request']['query'] extends z.ZodTypeAny
      ? z.infer<Route['request']['query']>
      : {};
    body: Route['request'] extends { body: { content: { 'application/json': { schema: infer S } } } }
      ? S extends z.ZodTypeAny ? z.infer<S> : never
      : never;
  }
>(
  _route: Route,
  handlerFn: (
    c: import('hono').Context,
    input: TInput
  ) => Promise<{ status: number; body: unknown } | Response>
): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return handlerFn as any;
}
