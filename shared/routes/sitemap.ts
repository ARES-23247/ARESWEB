import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";

export const getSitemapRoute = createRoute({
  method: "get",
  path: "/sitemap.xml",
  tags: ["seo"],
  summary: "Get dynamic sitemap",
  responses: {
    200: {
      content: {
        "application/xml": {
          schema: z.string(),
        },
      },
      description: "Sitemap XML",
    },
  },
});
