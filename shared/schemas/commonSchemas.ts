/**
 * Common Zod Schema Builders
 *
 * IN-08: Reusable schema builders that leverage MAX_INPUT_LENGTHS
 * and other common validation patterns.
 *
 * These helpers create consistent Zod schemas with proper error messages.
 */

import { z } from "zod";

/**
 * Maximum input lengths (should match functions/api/middleware/utils.ts)
 */
export const MAX_INPUT_LENGTHS = {
  title: 500,
  comment: 5000,
  description: 50000,
  content: 500000,
  name: 200,
  email: 320,
  address: 1000,
  slug: 200,
  code: 50,
  generic: 10000,
} as const;

/**
 * Create a string schema with max length validation.
 *
 * @param maxLength - Maximum allowed length
 * @param fieldName - Field name for error message (defaults to "Field")
 * @param optional - Whether the field is optional
 */
export function createMaxLengthSchema(
  maxLength: number,
  fieldName: string = "Field",
  optional: boolean = false
) {
  const schema = z.string().max(maxLength, `${fieldName} exceeds maximum length of ${maxLength} characters`);
  return optional ? schema.optional() : schema;
}

/**
 * Create a required string schema with min and max length validation.
 *
 * @param minLength - Minimum required length
 * @param maxLength - Maximum allowed length
 * @param fieldName - Field name for error message
 */
export function createLengthSchema(
  minLength: number,
  maxLength: number,
  fieldName: string = "Field"
) {
  return z.string()
    .min(minLength, `${fieldName} must be at least ${minLength} characters`)
    .max(maxLength, `${fieldName} exceeds maximum length of ${maxLength} characters`);
}

/**
 * Create a required string schema with min length and max default.
 *
 * @param minLength - Minimum required length (default 1)
 * @param maxLength - Maximum allowed length (default MAX_INPUT_LENGTHS.generic)
 * @param fieldName - Field name for error message
 */
export function createRequiredStringSchema(
  minLength: number = 1,
  maxLength: number = MAX_INPUT_LENGTHS.generic,
  fieldName: string = "Field"
) {
  return z.string()
    .min(minLength, `${fieldName} is required`)
    .max(maxLength, `${fieldName} exceeds maximum length of ${maxLength} characters`);
}

/**
 * Create an optional string schema with max length.
 *
 * @param maxLength - Maximum allowed length
 * @param fieldName - Field name for error message
 */
export function createOptionalStringSchema(
  maxLength: number = MAX_INPUT_LENGTHS.generic,
  fieldName: string = "Field"
) {
  return z.string()
    .max(maxLength, `${fieldName} exceeds maximum length of ${maxLength} characters`)
    .optional();
}

/**
 * Create a nullable string schema with max length.
 *
 * @param maxLength - Maximum allowed length
 * @param fieldName - Field name for error message
 */
export function createNullableStringSchema(
  maxLength: number = MAX_INPUT_LENGTHS.generic,
  fieldName: string = "Field"
) {
  return z.string()
    .max(maxLength, `${fieldName} exceeds maximum length of ${maxLength} characters`)
    .nullable();
}

/**
 * Pre-configured schemas for common field types.
 */
export const commonSchemas = {
  /** Title field (required, max 500 chars) */
  title: createRequiredStringSchema(1, MAX_INPUT_LENGTHS.title, "Title"),

  /** Name field (required, max 200 chars) */
  name: createRequiredStringSchema(1, MAX_INPUT_LENGTHS.name, "Name"),

  /** Optional name field (max 200 chars) */
  optionalName: createOptionalStringSchema(MAX_INPUT_LENGTHS.name, "Name"),

  /** Email field (required, max 320 chars) */
  email: z.string()
    .min(1, "Email is required")
    .email("Please enter a valid email address (e.g., user@example.com)")
    .max(MAX_INPUT_LENGTHS.email, "Email is too long"),

  /** Optional email field */
  optionalEmail: z.string()
    .email("Please enter a valid email address (e.g., user@example.com)")
    .max(MAX_INPUT_LENGTHS.email, "Email is too long")
    .optional()
    .nullable(),

  /** Slug field (required, max 200 chars) */
  slug: z.string()
    .min(1, "Slug is required")
    .max(MAX_INPUT_LENGTHS.slug, "Slug exceeds maximum length")
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),

  /** Comment/content field (required, max 5000 chars) */
  comment: createRequiredStringSchema(1, MAX_INPUT_LENGTHS.comment, "Comment"),

  /** Description field (optional, max 50000 chars) */
  description: createOptionalStringSchema(MAX_INPUT_LENGTHS.description, "Description"),

  /** Long content field (optional, max 500000 chars) */
  longContent: createOptionalStringSchema(MAX_INPUT_LENGTHS.content, "Content"),

  /** Generic short text field (optional, max 10000 chars) */
  genericText: createOptionalStringSchema(MAX_INPUT_LENGTHS.generic, "Text"),

  /** UUID string */
  uuid: z.string().uuid("Invalid UUID format"),

  /** Optional UUID */
  optionalUuid: z.string().uuid("Invalid UUID format").optional().nullable(),
};

/**
 * ISO 8601 date string schema.
 */
export const isoDateSchema = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: "Invalid ISO 8601 date format" }
);

/**
 * Optional ISO 8601 date string schema.
 */
export const optionalIsoDateSchema = isoDateSchema.optional().nullable();
