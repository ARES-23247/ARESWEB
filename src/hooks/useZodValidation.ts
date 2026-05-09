/**
 * Zod Validation Hook
 *
 * Provides runtime validation using Zod schemas with formatted error messages.
 * Leverages the same schemas used on the backend for type-safe validation.
 */

import { z } from 'zod';
import { fromError } from 'zod-validation-error';

/**
 * Validation result for successful parsing
 */
interface ValidationSuccess<T> {
  success: true;
  data: T;
}

/**
 * Validation result for failed parsing
 */
interface ValidationFailure {
  success: false;
  errors: Record<string, string>;
  errorMessage: string;
}

/**
 * Result type for validation
 */
export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

/**
 * Hook for validating data against a Zod schema
 *
 * @example
 * ```tsx
 * const { validate } = useZodValidation(taskSchema);
 * const result = validate(formData);
 * if (!result.success) {
 *   // result.errors is a record of field -> error message
 * }
 * ```
 */
export function useZodValidation<T extends z.ZodType>(schema: T) {
  const validate = (data: unknown): ValidationResult<z.infer<T>> => {
    const result = schema.safeParse(data);

    if (!result.success) {
      const validationError = fromError(result.error);
      const errors: Record<string, string> = {};

      // Format Zod issues into a simple key-value object
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || 'value';
        errors[key] = issue.message;
      }

      return {
        success: false,
        errors,
        errorMessage: validationError.toString(),
      };
    }

    return {
      success: true,
      data: result.data,
    };
  };

  /**
   * Validates a single field against the schema
   * Useful for on-blur validation
   */
  const validateField = (
    data: unknown,
    fieldName: string
  ): ValidationResult<z.infer<T>> => {
    const result = schema.safeParse(data);

    if (!result.success) {
      // Find issues for this specific field
      const fieldIssues = result.error.issues.filter(
        (issue) => issue.path.join('.') === fieldName
      );

      if (fieldIssues.length > 0) {
        return {
          success: false,
          errors: { [fieldName]: fieldIssues[0].message },
          errorMessage: fieldIssues[0].message,
        };
      }

      // No error for this specific field
      return {
        success: true,
        data: data as z.infer<T>,
      };
    }

    return {
      success: true,
      data: result.data,
    };
  };

  return { validate, validateField };
}

/**
 * Hook for async validation (e.g., checking uniqueness against API)
 *
 * @example
 * ```tsx
 * const { validateAsync } = useZodValidationAsync(taskSchema);
 * const result = await validateAsync(formData, async (data) => {
 *   // Check if title is unique
 *   const exists = await checkTitleExists(data.title);
 *   if (exists) {
 *     return { success: false, errors: { title: 'Title already exists' } };
 *   }
 *   return { success: true, data };
 * });
 * ```
 */
export function useZodValidationAsync<T extends z.ZodType>(schema: T) {
  const validateAsync = async (
    data: unknown,
    customValidator?: (data: z.infer<T>) => Promise<ValidationResult<z.infer<T>>>
  ): Promise<ValidationResult<z.infer<T>>> => {
    // First, validate against the schema
    const result = schema.safeParse(data);

    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || 'value';
        errors[key] = issue.message;
      }

      return {
        success: false,
        errors,
        errorMessage: fromError(result.error).toString(),
      };
    }

    // Then run custom validation if provided
    if (customValidator) {
      return customValidator(result.data);
    }

    return {
      success: true,
      data: result.data,
    };
  };

  return { validateAsync };
}
