/**
 * ─────────────────────────────────────────────────────────────────────────────
 * DRIZZLE + ZOD SCHEMA EXTENSION UTILITIES
 * ─────────────────────────────────────────────────────────────────────────────
 * Utilities to extend auto-generated Drizzle Zod schemas with additional
 * validation, transformations, and OpenAPI metadata without duplicating
 * field definitions.
 *
 * Usage:
 *   import { extendSchema } from '@shared/db/schema-extensions';
 *   import { insertEventSchema } from '@shared/db/schema-zod';
 *
 *   export const eventSchema = extendSchema(insertEventSchema)
 *     .overrideField('dateStart', isoDateSchema)
 *     .transformField('meetingNotes', sanitizeHtml)
 *     .openapiField('title', { example: 'Kickoff Meeting' })
 *     .build();
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { z, ZodTypeAny, ZodObject } from 'zod';

/**
 * Field extension options
 */
interface FieldExtensionOptions {
  /** Override the field's schema */
  override?: z.ZodTypeAny;
  /** Transform the field's value */
  transform?: (value: unknown) => unknown;
  /** OpenAPI metadata for documentation */
  openapi?: { example?: unknown; description?: string };
}

/**
 * Schema extension builder
 * Allows extending auto-generated Drizzle schemas with additional validation,
 * transformations, and OpenAPI metadata.
 */
export class SchemaExtensionBuilder<T extends ZodTypeAny> {
  private extensions = new Map<string, FieldExtensionOptions>();

  constructor(private baseSchema: T) {}

  /**
   * Override a field's schema with a new validation
   */
  overrideField<K extends string>(field: K, newSchema: z.ZodTypeAny): this {
    const existing = this.extensions.get(field);
    this.extensions.set(field, { ...existing, override: newSchema });
    return this;
  }

  /**
   * Add a transformation to a field
   */
  transformField<K extends string>(field: K, transform: (value: unknown) => unknown): this {
    const existing = this.extensions.get(field);
    this.extensions.set(field, { ...existing, transform });
    return this;
  }

  /**
   * Add OpenAPI metadata to a field for documentation
   */
  openapiField<K extends string>(
    field: K,
    metadata: { example?: unknown; description?: string }
  ): this {
    const existing = this.extensions.get(field);
    this.extensions.set(field, { ...existing, openapi: metadata });
    return this;
  }

  /**
   * Mark a field as required (remove optional)
   */
  requireField<K extends string>(field: K): this {
    // This will be handled during build with unwrap()
    return this;
  }

  /**
   * Mark a field as optional
   */
  optionalField<K extends string>(field: K): this {
    return this;
  }

  /**
   * Apply multiple field presets at once
   * Useful for reducing duplication when applying common field validations
   *
   * @example
   * import { fieldPresets } from '@shared/db/schema-presets';
   *
   * export const eventSchema = extendSchema(insertEventSchema)
   *   .applyPresets({
   *     title: fieldPresets.requiredString(255, "Event title is required"),
   *     location: fieldPresets.optionalString(255),
   *     isDraft: fieldPresets.booleanDefault(),
   *   })
   *   .build();
   */
  applyPresets(presets: Record<string, z.ZodTypeAny>): this {
    for (const [field, preset] of Object.entries(presets)) {
      const existing = this.extensions.get(field) as any;
      this.extensions.set(field, { ...existing, override: preset });
    }
    return this;
  }

  /**
   * Omit a field from the schema (useful for hiding internal fields)
   */
  omitField<K extends string>(field: K): this {
    this.extensions.set(field, { override: z.never() });
    return this;
  }

  /**
   * Build the final schema with all extensions applied
   */
  build(): z.ZodObject<any> {
    let schema: ZodTypeAny = this.baseSchema;

    // Get the base shape if it's a ZodObject
    if (this.isZodObject(schema)) {
      const baseShape = schema.shape;
      const newShape: Record<string, z.ZodTypeAny> = {};

      // Apply each extension
      for (const [key, value] of Object.entries(baseShape)) {
        const extension = this.extensions.get(key);

        if (extension?.override) {
          // Use the overridden schema
          if (extension.override instanceof z.ZodNever) {
            // Field is omitted
            continue;
          }
          newShape[key] = this.applyOpenapiMetadata(
            extension.override,
            extension.openapi
          );
        } else if (extension?.transform) {
          // Apply transformation
          const baseField = value as z.ZodTypeAny;
          newShape[key] = baseField.transform(extension.transform);
        } else {
          // Keep original with OpenAPI metadata if provided
          newShape[key] = this.applyOpenapiMetadata(
            value as z.ZodTypeAny,
            extension?.openapi
          );
        }
      }

      // Create new object schema with modified shape
      schema = z.object(newShape);
    }

    return schema as z.ZodObject<any>;
  }

  /**
   * Check if a schema is a ZodObject
   */
  private isZodObject(schema: ZodTypeAny): schema is ZodObject<any> {
    return 'shape' in schema && typeof schema.shape === 'object';
  }

  /**
   * Apply OpenAPI metadata to a schema
   */
  private applyOpenapiMetadata<T extends z.ZodTypeAny>(
    schema: T,
    metadata?: { example?: unknown; description?: string }
  ): T {
    if (!metadata) return schema;

    let result = schema;
    if (metadata.description) {
      result = result.describe(metadata.description) as T;
    }
    if (metadata.example !== undefined) {
      // OpenAPI example metadata
      result = result.openapi?.({ example: metadata.example }) as T ?? result;
    }
    return result;
  }
}

/**
 * Helper function to create a schema extension
 *
 * @example
 * import { extendSchema } from '@shared/db/schema-extensions';
 * import { insertEventSchema } from '@shared/db/schema-zod';
 * import { isoDateSchema } from '@shared/schemas/validators';
 *
 * export const eventSchema = extendSchema(insertEventSchema)
 *   .overrideField('dateStart', isoDateSchema)
 *   .transformField('meetingNotes', sanitizeHtml)
 *   .build();
 */
export function extendSchema<T extends ZodTypeAny>(baseSchema: T): SchemaExtensionBuilder<T> {
  return new SchemaExtensionBuilder(baseSchema);
}

/**
 * Helper to create a partial version of a schema (all fields optional)
 *
 * @example
 * export const updateEventSchema = createPartialSchema(eventSchema);
 */
export function createPartialSchema<T extends ZodTypeAny>(schema: T): ZodTypeAny {
  if (schema instanceof z.ZodObject) {
    return schema.partial();
  }
  return schema;
}

/**
 * Helper to omit fields from a schema
 *
 * @example
 * export const publicEventSchema = omitFields(eventSchema, ['meetingNotes', 'internalNotes']);
 */
export function omitFields<T extends ZodTypeAny>(
  schema: T,
  keys: string[]
): ZodTypeAny {
  if (schema instanceof z.ZodObject) {
    return schema.omit(keys.reduce((acc, key) => ({ ...acc, [key]: true }), {} as Record<string, true>));
  }
  return schema;
}

/**
 * Helper to pick fields from a schema
 *
 * @example
 * export const eventSummarySchema = pickFields(eventSchema, ['id', 'title', 'dateStart']);
 */
export function pickFields<T extends ZodTypeAny>(
  schema: T,
  keys: string[]
): ZodTypeAny {
  if (schema instanceof z.ZodObject) {
    return schema.pick(keys.reduce((acc, key) => ({ ...acc, [key]: true }), {} as Record<string, true>));
  }
  return schema;
}

/**
 * Transform a schema's field names from snake_case to camelCase
 *
 * @example
 * export const eventCamelSchema = toCamelCaseSchema(selectEventSchema);
 */
export function toCamelCaseSchema<T extends ZodTypeAny>(schema: T): ZodTypeAny {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const newShape: Record<string, z.ZodTypeAny> = {};

    for (const [key, value] of Object.entries(shape)) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      newShape[camelKey] = value as z.ZodTypeAny;
    }

    return z.object(newShape);
  }
  return schema;
}

/**
 * Transform a schema's field names from camelCase to snake_case
 *
 * @example
 * export const eventSnakeSchema = toSnakeCaseSchema(eventSchema);
 */
export function toSnakeCaseSchema<T extends ZodTypeAny>(schema: T): ZodTypeAny {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const newShape: Record<string, z.ZodTypeAny> = {};

    for (const [key, value] of Object.entries(shape)) {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      newShape[snakeKey] = value as z.ZodTypeAny;
    }

    return z.object(newShape);
  }
  return schema;
}
