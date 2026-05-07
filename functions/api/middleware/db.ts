import { Context, Next } from "hono";
import { AppEnv } from "./utils";
import { drizzle, DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../../../src/db/schema";
import * as relations from "../../../src/db/relations";

let cachedDb: DrizzleD1Database<typeof schema & typeof relations> | null = null;

export const dbMiddleware = async (c: Context<AppEnv>, next: Next) => {
  if (!cachedDb) {
    cachedDb = drizzle(c.env.DB, { schema: { ...schema, ...relations } });
  }
  c.set("db", cachedDb);
  await next();
};
