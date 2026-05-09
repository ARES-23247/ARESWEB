/**
 * Form Validation Utilities
 *
 * Helper functions for working with Zod schemas in forms.
 * Provides utilities to convert Zod errors into form-friendly formats.
 */

import { z } from 'zod';
import { fromError } from 'zod-validation-error';

/**
 * Formats a Zod error into a simple key-value object
 * Compatible with react-hook-form's setError format
 *
 * @example
 * ```ts
 * const result = taskSchema.safeParse(formData);
 * if (!result.success) {
 *   const errors = getFormErrors(result.error);
 *   // errors = { title: "Title is required", dueDate: "Invalid date" }
 * }
 * ```
 */
export function getFormErrors<T>(error: z.ZodError<T>): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const issue of error.issues) {
    // Handle nested paths (e.g., "user.email" -> "user.email")
    const key = issue.path.join('.') || 'form';
    errors[key] = issue.message;
  }

  return errors;
}

/**
 * Gets the first error message from a Zod error
 * Useful for showing a single error summary
 *
 * @example
 * ```ts
 * const result = taskSchema.safeParse(formData);
 * if (!result.success) {
 *   const message = getFirstErrorMessage(result.error);
 *   toast.error(message);
 * }
 * ```
 */
export function getFirstErrorMessage<T>(error: z.ZodError<T>): string {
  if (error.issues.length === 0) {
    return 'Validation failed';
  }

  return fromError(error).toString();
}

/**
 * Converts Zod errors to react-hook-form setError format
 *
 * @example
 * ```tsx
 * const { setError } = useForm();
 *
 * const onSubmit = (data) => {
 *   const result = taskSchema.safeParse(data);
 *   if (!result.success) {
 *     setFormErrors(setError, result.error);
 *   }
 * };
 * ```
 */
export function setFormErrors<T>(
  setError: (
    name: string,
    error: { type: string; message: string }
  ) => void,
  error: z.ZodError<T>
): void {
  for (const issue of error.issues) {
    const name = issue.path.join('.');
    setError(name, {
      type: 'validation',
      message: issue.message,
    });
  }
}

/**
 * Creates a zodResolver function for react-hook-form
 * This is a wrapper around the existing zodResolver from @hookform/resolvers
 * with additional error formatting
 *
 * @example
 * ```tsx
 * import { useForm } from 'react-hook-form';
 * import { createZodResolver } from '@/utils/formValidation';
 * import { taskSchema } from '@shared/routes/tasks';
 *
 * const { register, handleSubmit, formState: { errors } } = useForm({
 *   resolver: createZodResolver(taskSchema),
 * });
 * ```
 */
export function createZodResolver<T extends z.ZodType>(
  schema: T
): (data: unknown) => Promise<{ values: z.infer<T>; errors: {} } | { errors: Record<string, { message: string }>; values?: {} }> {
  return async (data: unknown) => {
    const result = await schema.safeParseAsync(data);

    if (result.success) {
      return {
        values: result.data,
        errors: {},
      };
    }

    const errors: Record<string, { message: string }> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join('.');
      errors[path] = {
        message: issue.message,
      };
    }

    return { errors };
  };
}

/**
 * Validates a single field against a schema
 * Useful for on-blur or field-level validation
 *
 * @example
 * ```tsx
 * <input
 *   {...register('title', {
 *     onBlur: (e) => {
 *       const error = validateField(taskSchema, { title: e.target.value }, 'title');
 *       if (error) setError('title', { type: 'validation', message: error });
 *     }
 *   })}
 * />
 * ```
 */
export function validateField<T extends z.ZodType>(
  schema: T,
  data: Partial<z.infer<T>>,
  fieldName: string
): string | null {
  // Create a partial schema for just this field
  const fieldSchema = schema.pick({ [fieldName]: true } as any);

  const result = fieldSchema.safeParse(data);

  if (result.success) {
    return null;
  }

  const fieldError = result.error.issues.find(
    (issue) => issue.path.join('.') === fieldName
  );

  return fieldError?.message || null;
}

/**
 * Type guard to check if validation result is an error
 *
 * @example
 * ```ts
 * const result = validateTask(data);
 * if (isValidationError(result)) {
 *   console.log(result.errors);
 * }
 * ```
 */
export function isValidationError<T>(
  result: { success: false; errors: Record<string, string> } | { success: true; data: T }
): result is { success: false; errors: Record<string, string> } {
  return !result.success;
}

/**
 * Combines multiple Zod schemas into a single validation
 * Useful for forms with multiple sections
 *
 * @example
 * ```ts
 * const combinedSchema = combineSchemas(
 *   personalInfoSchema,
 *   contactInfoSchema
 * );
 * ```
 */
export function combineSchemas<
  T1 extends z.ZodType,
  T2 extends z.ZodType
>(schema1: T1, schema2: T2): z.ZodIntersection<T1, T2> {
  return schema1.and(schema2);
}
