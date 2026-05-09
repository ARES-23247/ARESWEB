import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  tablesFilter: ["!*_fts_*"],
  // Database credentials for drizzle-kit commands and Studio
  // Points to the local D1 database created by Wrangler
  dbCredentials: {
    // Drizzle Studio will use this to connect to local D1
    url: process.env.DATABASE_URL || ".wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite",
  },
});
