import { useState } from 'react';
import { z } from 'zod';
import { logger } from '../utils/logger';

/**
 * SEC-WR-06: Hook for localStorage with Zod schema validation.
 * Provides runtime type safety for stored data to prevent type confusion
 * vulnerabilities and runtime errors from corrupted localStorage data.
 */
export function useExperimentState<T extends z.ZodType>(
  key: string,
  schema: T,
  initialValue: z.infer<T>
): [z.infer<T>, (value: z.infer<T> | ((val: z.infer<T>) => z.infer<T>)) => void] {
  // State to store our value
  // Pass initial state function to useState so logic is only executed once
  const [storedValue, setStoredValue] = useState<z.infer<T>>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      // Get from local storage by key
      const item = window.localStorage.getItem(key);
      if (!item) return initialValue;

      // SEC-WR-06: Validate stored data against schema before using
      const parsed = JSON.parse(item);
      const validated = schema.safeParse(parsed);
      if (validated.success) {
        return validated.data;
      }
      // Schema validation failed - data may be corrupted or tampered
      logger.warn(`localStorage key "${key}" failed schema validation, using initial value`);
      return initialValue;
    } catch (error) {
      // If error also return initialValue
      logger.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Return a wrapped version of useState's setter function that
  // persists the new value to localStorage.
  const setValue = (value: z.infer<T> | ((val: z.infer<T>) => z.infer<T>)) => {
    try {
      // Allow value to be a function so we have same API as useState
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;

      // SEC-WR-06: Validate value before storing
      const validated = schema.safeParse(valueToStore);
      if (!validated.success) {
        logger.error(`Failed to validate value for localStorage key "${key}":`, validated.error);
        return;
      }

      // Save state
      setStoredValue(validated.data);

      // Save to local storage
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(validated.data));
      }
    } catch (error) {
      logger.error(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue] as const;
}
