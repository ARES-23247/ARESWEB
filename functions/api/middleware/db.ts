import { Context, Next } from "hono";
import { AppEnv } from "./utils";
import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";
import { DB } from "../../../src/schemas/database";

let cachedDb: Kysely<DB> | null = null;

export const dbMiddleware = async (c: Context<AppEnv>, next: Next) => {
  if (!cachedDb) {
    cachedDb = new Kysely<DB>({
      dialect: new D1Dialect({ database: c.env.DB })
    });
  }
  c.set("db", cachedDb);
  await next();
};
