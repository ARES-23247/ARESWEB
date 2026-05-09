import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";

/**
 * Type alias for the Drizzle database with schema.
 * Use this to type database contexts instead of `any`.
 */
export type DrizzleDB = DrizzleD1Database<typeof schema>;
