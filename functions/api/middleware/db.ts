import { Context, Next } from "hono";
import { AppEnv } from "./utils";
import { drizzle, DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../../../src/db/schema";

let cachedDb: DrizzleD1Database<typeof schema> | null = null;

export const dbMiddleware = async (c: Context<AppEnv>, next: Next) => {
  if (!cachedDb) {
    cachedDb = drizzle(c.env.DB, { schema });
  }
  c.set("db", cachedDb);
  await next();
};
