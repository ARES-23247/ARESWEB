import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: ".wrangler/state/v3/d1/miniflare-D1DatabaseObject/b50f39d2832143fa7eaf6a5820bc2ecd2a7a0bfa314804344cf78d3ff9b5f198.sqlite",
  },
});
