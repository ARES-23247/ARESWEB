/**
 * JSON Column Validation Schemas
 *
 * IN-10: Explicit validation for JSON columns stored as strings.
 *
 * SQLite stores JSON as TEXT columns. These schemas ensure that
 * string values are valid JSON before storage.
 */

import { z } from "zod";

/**
 * Parse and validate a JSON string, transforming the result.
 * Returns z.NEVER if parsing fails, which makes Zod mark the validation as failed.
 *
 * @param itemSchema - The schema to validate the parsed JSON against
 */
export function createJsonStringSchema<T extends z.ZodType>(itemSchema: T) {
  return z.string().transform((val, ctx) => {
    try {
      const parsed = JSON.parse(val);
      return itemSchema.parse(parsed);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid JSON format",
      });
      return z.NEVER;
    }
  });
}

/**
 * Create a schema for a JSON array stored as a string.
 *
 * @param itemSchema - Schema for array items
 */
export function createJsonArraySchema<T extends z.ZodType>(itemSchema: T) {
  return z.string().transform((val, ctx) => {
    try {
      const parsed = JSON.parse(val);
      return z.array(itemSchema).parse(parsed);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid JSON array format",
      });
      return z.NEVER;
    }
  });
}

/**
 * Create a schema for a JSON object stored as a string.
 *
 * @param valueSchema - Schema for object values
 */
export function createJsonObjectSchema<T extends z.ZodType>(
  keySchema: z.ZodType = z.string(),
  valueSchema: T
) {
  return z.string().transform((val, ctx) => {
    try {
      const parsed = JSON.parse(val);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return z.record(keySchema as any, valueSchema).parse(parsed);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid JSON object format",
      });
      return z.NEVER;
    }
  });
}

/**
 * Optional version of createJsonArraySchema.
 */
export function createOptionalJsonArraySchema<T extends z.ZodType>(itemSchema: T) {
  return createJsonArraySchema(itemSchema).optional().nullable();
}

/**
 * Optional version of createJsonObjectSchema.
 */
export function createOptionalJsonObjectSchema<T extends z.ZodType>(
  keySchema: z.ZodType = z.string(),
  valueSchema: T
) {
  return createJsonObjectSchema(keySchema, valueSchema).optional().nullable();
}

/**
 * Common JSON column schemas for the application.
 */

/** String array stored as JSON (e.g., subteams, tags) */
export const stringArrayJsonSchema = createJsonArraySchema(z.string());

/** Optional string array stored as JSON */
export const optionalStringArrayJsonSchema = createOptionalJsonArraySchema(z.string());

/** Number array stored as JSON (e.g., numeric IDs) */
export const numberArrayJsonSchema = createJsonArraySchema(z.number());

/** Object with string values stored as JSON */
export const stringObjectJsonSchema = createJsonObjectSchema(z.string(), z.string());

/** Optional object with string values stored as JSON */
export const optionalStringObjectJsonSchema = createOptionalJsonObjectSchema(z.string(), z.string());

/**
 * Helper to serialize a value to JSON string for storage.
 */
export function toJsonString<T>(value: T | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return JSON.stringify(value);
}

/**
 * Helper to parse a JSON string to a typed value.
 * Returns null if parsing fails or input is null/undefined.
 */
export function parseJsonString<T>(jsonString: string | null | undefined): T | null {
  if (!jsonString) return null;
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return null;
  }
}
