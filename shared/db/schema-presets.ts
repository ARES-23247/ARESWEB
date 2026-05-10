/**
 * ─────────────────────────────────────────────────────────────────────────────
 * COMMON SCHEMA FIELD PRESETS
 * ─────────────────────────────────────────────────────────────────────────────
 * Reusable field validation presets to reduce duplication in schema definitions.
 * Provides commonly used field types with consistent validation across all schemas.
 *
 * Usage:
 *   import { fieldPresets } from '@shared/db/schema-presets';
 *   import { extendSchema } from '@shared/db/schema-extensions';
 *
 *   export const eventSchema = extendSchema(insertEventSchema)
 *     .applyPresets({
 *       title: fieldPresets.requiredString(255, "Event title is required"),
 *       location: fieldPresets.optionalString(255),
 *       isDraft: fieldPresets.booleanDefault(),
 *     })
 *     .build();
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { z } from 'zod';

/**
 * ISO 8601 date string validator
 */
const isoDateValidator = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: "Invalid ISO 8601 date format" }
);

/**
 * Common validation presets for schema fields
 */
export const fieldPresets = {
  /**
   * Required string field with min/max length
   * @param max - Maximum length (default: 255)
   * @param errorMsg - Custom error message for required validation
   */
  requiredString: (max = 255, errorMsg?: string) =>
    z.string().min(1, errorMsg || "Field is required").max(max),

  /**
   * Optional string field with max length
   * @param max - Maximum length (default: 255)
   */
  optionalString: (max = 255) =>
    z.string().max(max).optional(),

  /**
   * String field that can be empty string or optional
   * @param max - Maximum length (default: 255)
   */
  emptyStringOrOptional: (max = 255) =>
    z.string().max(max).optional().or(z.literal("")),

  /**
   * Required ISO 8601 date string
   * @param errorMsg - Custom error message
   */
  requiredDate: (errorMsg?: string) =>
    isoDateValidator.min(1, errorMsg || "Date is required"),

  /**
   * Optional ISO 8601 date string
   */
  optionalDate: () =>
    isoDateValidator.optional(),

  /**
   * Boolean field with default value
   * @param defaultValue - Default boolean value (default: false)
   */
  booleanDefault: (defaultValue = false) =>
    z.boolean().default(defaultValue),

  /**
   * Optional boolean field
   */
  optionalBoolean: () =>
    z.boolean().optional(),

  /**
   * Number field with default value (useful for smallint/integer flags)
   * @param defaultValue - Default number value (default: 0)
   */
  numberDefault: (defaultValue = 0) =>
    z.number().default(defaultValue),

  /**
   * Optional ID field (string or empty string)
   */
  optionalId: () =>
    z.string().optional().or(z.literal("")),

  /**
   * Required enum field with default value
   * @param values - Enum values
   * @param defaultVal - Default value
   */
  category: <T extends readonly [string, ...string[]]>(
    values: T,
    defaultVal: T[number]
  ) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return z.enum(values).default(defaultVal as any);
  },

  /**
   * Optional enum field
   * @param values - Enum values
   */
  optionalCategory: <T extends readonly [string, ...string[]]>(values: T) =>
    z.enum(values).optional(),

  /**
   * URL field validation (optional)
   * @param max - Maximum length (default: 255)
   */
  optionalUrl: (max = 255) =>
    z.string().url("Must be a valid URL").max(max).optional().nullable().or(z.literal("")),

  /**
   * Slug field (lowercase letters, numbers, and hyphens)
   */
  slug: () =>
    z.string()
      .min(1, "Slug is required")
      .max(255, "Slug is too long")
      .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),

  /**
   * Optional slug field
   */
  optionalSlug: () =>
    z.string()
      .max(255)
      .regex(/^[a-z0-9-]*$/, "Slug must contain only lowercase letters, numbers, and hyphens")
      .optional(),

  /**
   * Social media links record (platform name -> boolean)
   */
  socialsRecord: () =>
    z.record(z.string().max(255), z.boolean()).optional(),

  /**
   * Recurrence rule (RRULE) field for recurring events
   */
  recurrenceRule: () =>
    z.string().max(1000).optional().or(z.literal("")),

  /**
   * Season ID field that handles string/number union and empty string
   * Transforms empty string to undefined, otherwise converts to number
   */
  seasonId: () =>
    z.union([z.string(), z.number()])
      .transform(v => v === "" ? undefined : Number(v))
      .optional(),

  /**
   * Text field for long content (descriptions, notes, etc.)
   * @param max - Maximum length (default: 5000)
   */
  longText: (max = 5000) =>
    z.string().max(max).optional(),

  /**
   * Sanitized HTML content field (for rich text editors)
   * @param max - Maximum length (default: 200000)
   * @param sanitizer - Optional sanitization function
   */
  sanitizedHtml: (max = 200000, sanitizer?: (val: string) => string) => {
    const base = z.string().max(max).optional();
    if (sanitizer) {
      return base.transform((val) => {
        if (!val) return val;
        return sanitizer(val);
      });
    }
    return base;
  },
} as const;

/**
 * Type for field presets
 */
export type FieldPresets = typeof fieldPresets;
