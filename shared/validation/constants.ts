/**
 * ─────────────────────────────────────────────────────────────────────────────
 * VALIDATION CONSTRAINTS
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralized validation constants for use across zod schemas and middleware.
 * These constraints MUST be used consistently across the entire codebase.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { z } from "zod";

/**
 * Maximum length constraints for input fields
 * These match the MAX_INPUT_LENGTHS from functions/api/middleware/utils.ts
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
 * ─────────────────────────────────────────────────────────────────────────────
 * ZOD VALIDATION HELPERS
 * ─────────────────────────────────────────────────────────────────────────────
 * Pre-configured zod validators that use MAX_INPUT_LENGTHS constraints
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Creates a string validator with min/max length and appropriate error messages
 */
export function createStringValidator(
  maxLength: number,
  fieldName: string,
  minLength: number = 1
) {
  return z.string({
    required_error: `${fieldName} is required`,
    invalid_type_error: `${fieldName} must be a string`,
  })
    .min(minLength, `${fieldName} must be at least ${minLength} character${minLength === 1 ? "" : "s"}`)
    .max(maxLength, `${fieldName} cannot exceed ${maxLength} characters`);
}

/**
 * Creates an optional string validator with max length
 */
export function createOptionalStringValidator(
  maxLength: number,
  fieldName: string
) {
  return z.string()
    .max(maxLength, `${fieldName} cannot exceed ${maxLength} characters`)
    .optional();
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * COMMON FIELD VALIDATORS
 * ─────────────────────────────────────────────────────────────────────────────
 * Reusable validators for common field types
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Title field validator (e.g., post titles, event titles)
 */
export const titleField = createStringValidator(MAX_INPUT_LENGTHS.title, "Title");

/**
 * Optional title field validator
 */
export const optionalTitleField = createOptionalStringValidator(MAX_INPUT_LENGTHS.title, "Title");

/**
 * Name field validator (e.g., user names, sponsor names)
 */
export const nameField = createStringValidator(MAX_INPUT_LENGTHS.name, "Name");

/**
 * Optional name field validator
 */
export const optionalNameField = createOptionalStringValidator(MAX_INPUT_LENGTHS.name, "Name");

/**
 * Slug field validator
 */
export const slugField = createOptionalStringValidator(MAX_INPUT_LENGTHS.slug, "Slug");

/**
 * Email field validator
 */
export const emailField = z.string()
  .max(MAX_INPUT_LENGTHS.email, "Email cannot exceed 320 characters")
  .email("Invalid email format");

/**
 * Optional email field validator
 */
export const optionalEmailField = emailField.optional();

/**
 * Description field validator (long text)
 */
export const descriptionField = createOptionalStringValidator(MAX_INPUT_LENGTHS.description, "Description");

/**
 * Content field validator (very long text)
 */
export const contentField = createOptionalStringValidator(MAX_INPUT_LENGTHS.content, "Content");

/**
 * Comment field validator
 */
export const commentField = createStringValidator(MAX_INPUT_LENGTHS.comment, "Comment");

/**
 * Optional comment field validator
 */
export const optionalCommentField = createOptionalStringValidator(MAX_INPUT_LENGTHS.comment, "Comment");

/**
 * Code field validator (e.g., judge codes, discount codes)
 */
export const codeField = createStringValidator(MAX_INPUT_LENGTHS.code, "Code");

/**
 * Optional code field validator
 */
export const optionalCodeField = createOptionalStringValidator(MAX_INPUT_LENGTHS.code, "Code");

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CUSTOM VALIDATION HELPERS
 * ─────────────────────────────────────────────────────────────────────────────
 * Advanced validators using .refine() for complex validation logic
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Creates a date range validator for start/end date pairs
 */
export function createDateRangeValidator(startDateField: string = "date_start", endDateField: string = "date_end") {
  return z.object({
    [startDateField]: z.string().datetime("Invalid datetime format"),
    [endDateField]: z.string().datetime("Invalid datetime format"),
  }).refine(
    (data) => new Date(data[endDateField]) > new Date(data[startDateField]),
    {
      message: "End date must be after start date",
      path: [endDateField],
    }
  );
}

/**
 * Creates a validator that checks if a string is a valid URL
 */
export function createUrlValidator(maxLength: number = 2048, fieldName: string = "URL") {
  return z.string()
    .max(maxLength, `${fieldName} cannot exceed ${maxLength} characters`)
    .url("Invalid URL format");
}

/**
 * Optional URL field validator
 */
export function createOptionalUrlValidator(maxLength: number = 2048, fieldName: string = "URL") {
  return z.string()
    .max(maxLength, `${fieldName} cannot exceed ${maxLength} characters`)
    .url("Invalid URL format")
    .optional()
    .or(z.literal(""));
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * VALIDATION ERROR FORMATTING
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Formats zod validation errors into a simple key-value object
 * This replaces the need for manual validateLength() calls
 */
export function formatZodErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "value";
    errors[key] = issue.message;
  }
  return errors;
}
