/**
 * Boolean Schema Helpers
 *
 * IN-06: Consistent boolean type handling for SQLite compatibility.
 *
 * SQLite stores booleans as 0 or 1, but TypeScript uses true/false.
 * These schemas handle both representations consistently.
 */

import { z } from "zod";

/**
 * Schema that accepts both boolean and number (0/1) representations,
 * normalizing to boolean in TypeScript.
 *
 * Use this for fields that come from SQLite databases where booleans
 * are stored as integers.
 */
export const sqliteBooleanSchema = z.union([
  z.boolean(),
  z.number().int().min(0).max(1),
]).transform((val) => val === true || val === 1);

/**
 * Nullable version of sqliteBooleanSchema.
 * Accepts boolean, 0/1, or null.
 */
export const nullableSqliteBooleanSchema = z.union([
  z.boolean(),
  z.number().int().min(0).max(1),
  z.null(),
]).transform((val) => val === null ? null : (val === true || val === 1));

/**
 * Optional version of sqliteBooleanSchema.
 * Accepts boolean, 0/1, or undefined.
 */
export const optionalSqliteBooleanSchema = z.union([
  z.boolean(),
  z.number().int().min(0).max(1),
  z.undefined(),
]).transform((val) => val === undefined ? undefined : (val === true || val === 1));

/**
 * Combined nullable and optional schema.
 * Accepts boolean, 0/1, null, or undefined.
 */
export const nullishSqliteBooleanSchema = z.union([
  z.boolean(),
  z.number().int().min(0).max(1),
  z.null(),
  z.undefined(),
]).transform((val) => val === null || val === undefined ? null : (val === true || val === 1));

/**
 * Helper to convert a boolean to SQLite integer representation.
 */
export function booleanToSqlite(val: boolean | null): number | null {
  return val === null ? null : (val ? 1 : 0);
}

/**
 * Helper to convert SQLite integer to boolean.
 */
export function sqliteToBoolean(val: number | null): boolean | null {
  return val === null ? null : (val === 1);
}
