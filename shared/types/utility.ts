/**
 * Utility types for common TypeScript patterns.
 * Simple reusable types to prevent over-genericizing elsewhere.
 */

/**
 * Extracts the union type of all values in an object.
 *
 * @example
 * type Role = ValueOf<{ admin: 'admin'; user: 'user' }>; // 'admin' | 'user'
 */
export type ValueOf<T> = T[keyof T];

/**
 * Makes a type optional (nullable or undefined).
 *
 * @example
 * type OptionalString = Optional<string>; // string | null | undefined
 */
export type Optional<T> = T | null | undefined;

/**
 * Makes a type nullable (null only).
 *
 * @example
 * type NullableString = Nullable<string>; // string | null
 */
export type Nullable<T> = T | null;

/**
 * Prettifies a type for better IDE readability.
 * Expands intersected types into a single flat object type.
 *
 * @example
 * type Flat = Prettify<{ a: string } & { b: number }>; // { a: string; b: number }
 */
export type Prettify<T> = { [K in keyof T]: T[K] } & {};
