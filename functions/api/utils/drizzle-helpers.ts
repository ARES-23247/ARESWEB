/**
 * Drizzle ORM Helper Utilities
 *
 * Eliminates boilerplate in API routes by providing composable functions
 * for common CRUD operations with built-in error handling and audit logging.
 */

import type { Context } from "hono";
import type { AppEnv } from "../middleware/utils";
import { eq, and, type SQL, type Table } from "drizzle-orm";
import type {
  SQLiteTableWithColumns,
  SQLiteColumn,
  GeneratedAlways,
} from "drizzle-orm/sqlite-core";
import { getDb } from "../middleware";
import { ApiError } from "../middleware/errorHandler";
import type { Qemu former } from "drizzle-orm/sqlite-core/dialect";

// ============================================================================
// Types
// ============================================================================

type DbContext = Context<AppEnv>;

type SelectResult<T extends SQLiteTableWithColumns<any>> = T["$inferSelect"];

type InsertResult<T extends SQLiteTableWithColumns<any>> = T["$inferInsert"];

type ExtractIdColumn<T> = T extends { id: infer C } ? C : never;

// ============================================================================
// Core Query Helpers
// ============================================================================

/**
 * Find a single record by ID or throw 404.
 * Handles the common pattern of selecting by ID and checking if empty.
 *
 * @example
 * const video = await findOne(db, schema.videos, id);
 */
export async function findOne<T extends SQLiteTableWithColumns<any>>(
  db: DbContext,
  table: T,
  id: string,
  options?: {
    where?: SQL<any>;
    notFoundMessage?: string;
  }
): Promise<SelectResult<T>> {
  const { where, notFoundMessage } = options ?? {};

  // Get the ID column name
  const idColumn = table.id as SQLiteColumn<
    GeneratedAlways<string> | string,
    object,
    object
  >;

  const condition = where ? and(where, eq(idColumn, id)) : eq(idColumn, id);

  const result = await getDb(db)
    .select()
    .from(table)
    .where(condition)
    .execute();

  if (result.length === 0) {
    throw new ApiError(
      notFoundMessage ?? `${table[Symbol.for("drizzle:Name")] as string} not found`,
      404,
      "NOT_FOUND"
    );
  }

  return result[0] as SelectResult<T>;
}

/**
 * Find records matching a condition, returning null if not found.
 * Alternative to findOne that doesn't throw.
 */
export async function findOrNull<T extends SQLiteTableWithColumns<any>>(
  db: DbContext,
  table: T,
  options?: {
    where?: SQL<any>;
    orderBy?: SQL<any>;
    limit?: number;
  }
): Promise<SelectResult<T> | null> {
  const { where, orderBy, limit } = options ?? {};

  let query = getDb(db).select().from(table);

  if (where) {
    query = query.where(where);
  }
  if (orderBy) {
    query = query.orderBy(orderBy);
  }
  if (limit) {
    query = query.limit(limit);
  }

  const result = await query.execute();
  return result.length > 0 ? (result[0] as SelectResult<T>) : null;
}

/**
 * Find multiple records with optional filtering and ordering.
 */
export async function findMany<T extends SQLiteTableWithColumns<any>>(
  db: DbContext,
  table: T,
  options?: {
    where?: SQL<any>;
    orderBy?: SQL<any> | SQL<any>[];
    limit?: number;
    offset?: number;
  }
): Promise<SelectResult<T>[]> {
  const { where, orderBy, limit, offset } = options ?? {};

  let query = getDb(db).select().from(table);

  if (where) {
    query = query.where(where);
  }
  if (orderBy) {
    query = query.orderBy(orderBy);
  }
  if (limit !== undefined) {
    query = query.limit(limit);
  }
  if (offset !== undefined) {
    query = query.offset(offset);
  }

  return query.execute() as Promise<SelectResult<T>[]>;
}

/**
 * Count records matching a condition.
 */
export async function count<T extends SQLiteTableWithColumns<any>>(
  db: DbContext,
  table: T,
  where?: SQL<any>
): Promise<number> {
  const idColumn = table.id as SQLiteColumn<
    GeneratedAlways<string> | string,
    object,
    object
  >;

  const result = where
    ? await getDb(db)
        .select({ count: idColumn })
        .from(table)
        .where(where)
        .execute()
    : await getDb(db).select({ count: idColumn }).from(table).execute();

  return result.length;
}

// ============================================================================
// Mutation Helpers
// ============================================================================

/**
 * Insert a single record and return it.
 * Handles ID generation, insertion, and re-fetching.
 */
export async function insertOne<T extends SQLiteTableWithColumns<any>>(
  db: DbContext,
  table: T,
  data: InsertResult<T>,
  options?: {
    idPrefix?: string;
    returning?: boolean;
  }
): Promise<SelectResult<T>> {
  const { idPrefix = "", returning = true } = options ?? {};

  const idColumn = table.id as SQLiteColumn<
    GeneratedAlways<string> | string,
    object,
    object
  >;

  const id = data.id ?? `${idPrefix}${crypto.randomUUID?.() ?? ""}`;

  await getDb(db)
    .insert(table)
    .values({ ...data, id } as any)
    .execute();

  if (returning) {
    return findOne(db, table, id as string);
  }

  return { ...data, id } as SelectResult<T>;
}

/**
 * Update a single record by ID and return it.
 * Handles existence check, update, and re-fetching.
 */
export async function updateOne<T extends SQLiteTableWithColumns<any>>(
  db: DbContext,
  table: T,
  id: string,
  data: Partial<InsertResult<T>>,
  options?: {
    where?: SQL<any>;
    notFoundMessage?: string;
  }
): Promise<SelectResult<T>> {
  const { where, notFoundMessage } = options ?? {};

  // Verify exists first
  await findOne(db, table, id, { where, notFoundMessage });

  const idColumn = table.id as SQLiteColumn<
    GeneratedAlways<string> | string,
    object,
    object
  >;

  const condition = where ? and(where, eq(idColumn, id)) : eq(idColumn, id);

  await getDb(db).update(table).set(data as any).where(condition).execute();

  return findOne(db, table, id, { where });
}

/**
 * Upsert a record (insert or update) and return it.
 */
export async function upsertOne<T extends SQLiteTableWithColumns<any>>(
  db: DbContext,
  table: T,
  data: InsertResult<T> & { id: string },
  options?: {
    conflictTarget?: SQL<any>;
    updateColumns?: (keyof InsertResult<T>)[];
  }
): Promise<SelectResult<T>> {
  const { conflictTarget, updateColumns } = options ?? {};

  const idColumn = table.id as SQLiteColumn<
    GeneratedAlways<string> | string,
    object,
    object
  >;

  const target = conflictTarget ?? idColumn;

  await getDb(db)
    .insert(table)
    .values(data as any)
    .onConflictDoUpdate({
      target,
      set: updateColumns
        ? Object.fromEntries(
            updateColumns.map((col) => [col, (data as any)[col]])
          )
        : data as any,
    })
    .run();

  return findOne(db, table, data.id);
}

/**
 * Delete a record by ID.
 * Verifies existence before deletion.
 */
export async function deleteOne(
  db: DbContext,
  table: SQLiteTableWithColumns<any>,
  id: string,
  options?: {
    where?: SQL<any>;
    notFoundMessage?: string;
  }
): Promise<void> {
  const { where, notFoundMessage } = options ?? {};

  // Verify exists first and get the record for potential audit logging
  const existing = await findOne(db, table, id, { where, notFoundMessage });

  const idColumn = table.id as SQLiteColumn<
    GeneratedAlways<string> | string,
    object,
    object
  >;

  const condition = where ? and(where, eq(idColumn, id)) : eq(idColumn, id);

  await getDb(db).delete(table).where(condition).run();

  // Return existing for audit logging
  return existing as any;
}

/**
 * Delete a record by ID and return the deleted record.
 */
export async function deleteOneAndReturn<T extends SQLiteTableWithColumns<any>>(
  db: DbContext,
  table: T,
  id: string,
  options?: {
    where?: SQL<any>;
    notFoundMessage?: string;
  }
): Promise<SelectResult<T>> {
  const { where, notFoundMessage } = options ?? {};

  // Get the record first before deleting
  const existing = await findOne(db, table, id, { where, notFoundMessage });

  const idColumn = table.id as SQLiteColumn<
    GeneratedAlways<string> | string,
    object,
    object
  >;

  const condition = where ? and(where, eq(idColumn, id)) : eq(idColumn, id);

  await getDb(db).delete(table).where(condition).run();

  return existing;
}

// ============================================================================
// Audit Helpers
// ============================================================================

/**
 * Log an audit action safely, handling both Pages and Workers environments.
 */
export function logAudit(
  c: Context<AppEnv>,
  action: string,
  entityType: string,
  entityId: string | null,
  description: string
): void {
  const { logAuditAction } = require("../middleware");
  if (c.executionCtx) {
    c.executionCtx.waitUntil(
      logAuditAction(c, action, entityType, entityId, description)
    );
  }
}

// ============================================================================
// Soft Delete Helpers
// ============================================================================

/**
 * Soft delete a record by setting isDeleted flag.
 */
export async function softDeleteOne(
  db: DbContext,
  table: SQLiteTableWithColumns<any> & { isDeleted: SQLiteColumn<any> },
  id: string
): Promise<void> {
  const idColumn = table.id as SQLiteColumn<
    GeneratedAlways<string> | string,
    object,
    object
  >;

  await getDb(db)
    .update(table)
    .set({ isDeleted: 1, updatedAt: new Date().toISOString() } as any)
    .where(eq(idColumn, id))
    .run();
}

/**
 * Find non-deleted records (isDeleted = 0 or null).
 */
export async function findActive<T extends SQLiteTableWithColumns<any> & {
  isDeleted: SQLiteColumn<any>;
}>(
  db: DbContext,
  table: T,
  options?: Parameters<typeof findMany<T>>[2]
): Promise<SelectResult<T>[]> {
  const { isNull } = await import("drizzle-orm");

  const where = and(
    options?.where,
    isNull(table.isDeleted)
  ) as SQL<any>;

  return findMany(db, table, { ...options, where });
}

// ============================================================================
// Serializer Helpers
// ============================================================================

/**
 * Create a serializer function that transforms DB records to API responses.
 * Handles common patterns like null coercion, URL generation, etc.
 */
export function createSerializer<T extends Record<string, any>, R = T>(
  transform: (input: T) => R
): (input: T) => R {
  return transform;
}

/**
 * Common serialization utilities.
 */
export const serializers = {
  /** Coerce undefined/null to null */
  nullish: <T>(value: T | null | undefined): T | null =>
    value ?? null,

  /** Format date as ISO string */
  date: (date: string | Date | null | undefined): string | null => {
    if (!date) return null;
    return typeof date === "string" ? date : new Date(date).toISOString();
  },

  /** Generate URL from R2 key */
  mediaUrl: (key: string | null | undefined): string | null =>
    key ? `/api/media/${key}` : null,

  /** Combine multiple serializers */
  combine: <T, R>(
    ...fns: Array<(input: T) => Partial<R>>
  ): (input: T) => R => {
    return (input) => {
      const result = {} as R;
      for (const fn of fns) {
        Object.assign(result, fn(input));
      }
      return result;
    };
  },
};
