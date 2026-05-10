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
          schema: z.string().openapi({
            description: "Sitemap XML content",
            example: '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">...</urlset>',
          }),
        },
      },
      description: "Sitemap XML",
    },
  },
});
