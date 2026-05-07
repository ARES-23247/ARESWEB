import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";
import * as relations from "./relations";

/**
 * Type alias for the Drizzle database with schema and relations.
 * Use this to type database contexts instead of `any`.
 */
export type DrizzleDB = DrizzleD1Database<typeof schema & typeof relations>;
