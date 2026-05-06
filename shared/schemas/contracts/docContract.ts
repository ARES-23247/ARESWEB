import { createRoute, z } from "@hono/zod-openapi";
import { openApiStandardErrors } from "./common";
import { docSchema } from "../docSchema";

export const docResponseSchema = z.object({
  slug: z.string(),
  title: z.string().nullish(),
  category: z.string().nullish(),
  sort_order: z.number().nullish(),
  description: z.string().nullish(),
  is_portfolio: z.number().nullish(),
  is_executive_summary: z.number().nullish(),
  zulip_stream: z.string().nullable().optional(),
  zulip_topic: z.string().nullable().optional(),
  is_deleted: z.number().nullish(),
  status: z.string().nullish(),
  revision_of: z.string().nullish(),
  display_in_areslib: z.number().nullish(),
  display_in_math_corner: z.number().nullish(),
  display_in_science_corner: z.number().nullish(),
  original_author_nickname: z.string().optional(),
  original_author_avatar: z.string().optional(),
});

export const docDetailResponseSchema = docResponseSchema.extend({
  content: z.string().nullable(),
  updated_at: z.string().optional(),
});

export const docHistorySchema = z.object({
  id: z.coerce.number(),
  slug: z.string(),
  title: z.string().nullable(),
  category: z.string().nullable(),
  description: z.string().nullable(),
  content: z.string().nullable().optional(),
  author_email: z.string().nullable(),
  created_at: z.string(),
});

export const getDocsRoute = createRoute({
  method: "get",
  path: "/",
  responses: {
    200: {
      description: "List all public docs",
      content: { "application/json": { schema: z.object({ docs: z.array(docResponseSchema) }) } },
    },
    ...openApiStandardErrors,
  },
});

export const searchDocsRoute = createRoute({
  method: "get",
  path: "/search",
  request: {
    query: z.object({
      q: z.string(),
    }),
  },
  responses: {
    200: {
      description: "Search docs",
      content: {
        "application/json": {
          schema: z.object({
            results: z.array(
              z.object({
                slug: z.string(),
                title: z.string(),
                category: z.string(),
                description: z.string().nullable(),
                snippet: z.string(),
              }),
            ),
          }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});

export const adminListDocsRoute = createRoute({
  method: "get",
  path: "/admin/list",
  responses: {
    200: {
      description: "List all docs (admin)",
      content: { "application/json": { schema: z.object({ docs: z.array(docResponseSchema) }) } },
    },
    ...openApiStandardErrors,
  },
});

export const adminDetailDocRoute = createRoute({
  method: "get",
  path: "/admin/{slug}/detail",
  request: {
    params: z.object({ slug: z.string() }),
  },
  responses: {
    200: {
      description: "Get single doc detail (admin)",
      content: { "application/json": { schema: z.object({ doc: docDetailResponseSchema }) } },
    },
    ...openApiStandardErrors,
  },
});

export const getDocRoute = createRoute({
  method: "get",
  path: "/{slug}",
  request: {
    params: z.object({ slug: z.string() }),
  },
  responses: {
    200: {
      description: "Get single doc with contributors",
      content: {
        "application/json": {
          schema: z.object({
            doc: docDetailResponseSchema,
            contributors: z.array(
              z.object({
                nickname: z.string().nullable(),
                avatar: z.string().nullable(),
              }),
            ),
          }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});

export const deleteDocRoute = createRoute({
  method: "delete",
  path: "/admin/{slug}",
  request: {
    params: z.object({ slug: z.string() }),
  },
  responses: {
    200: {
      description: "Delete a doc",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const saveDocRoute = createRoute({
  method: "post",
  path: "/admin/save",
  request: {
    body: {
      content: { "application/json": { schema: docSchema } },
    },
  },
  responses: {
    200: {
      description: "Create or update a doc",
      content: { "application/json": { schema: z.object({ success: z.boolean(), slug: z.string() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const updateSortRoute = createRoute({
  method: "patch",
  path: "/admin/{slug}/sort",
  request: {
    params: z.object({ slug: z.string() }),
    body: {
      content: { "application/json": { schema: z.object({ sortOrder: z.number() }) } },
    },
  },
  responses: {
    200: {
      description: "Update doc sort order",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const submitFeedbackRoute = createRoute({
  method: "post",
  path: "/{slug}/feedback",
  request: {
    params: z.object({ slug: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            isHelpful: z.boolean(),
            comment: z.string().optional(),
            turnstileToken: z.string(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Submit doc feedback",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const getHistoryRoute = createRoute({
  method: "get",
  path: "/admin/{slug}/history",
  request: {
    params: z.object({ slug: z.string() }),
  },
  responses: {
    200: {
      description: "Get doc history",
      content: { "application/json": { schema: z.object({ history: z.array(docHistorySchema) }) } },
    },
    ...openApiStandardErrors,
  },
});

export const restoreHistoryRoute = createRoute({
  method: "patch",
  path: "/admin/{slug}/history/{id}/restore",
  request: {
    params: z.object({ slug: z.string(), id: z.string() }),
  },
  responses: {
    200: {
      description: "Restore doc from history",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const approveDocRoute = createRoute({
  method: "post",
  path: "/admin/{slug}/approve",
  request: {
    params: z.object({ slug: z.string() }),
  },
  responses: {
    200: {
      description: "Approve a doc",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const rejectDocRoute = createRoute({
  method: "post",
  path: "/admin/{slug}/reject",
  request: {
    params: z.object({ slug: z.string() }),
    body: {
      content: { "application/json": { schema: z.object({ reason: z.string().optional() }) } },
    },
  },
  responses: {
    200: {
      description: "Reject a doc",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const undeleteDocRoute = createRoute({
  method: "post",
  path: "/admin/{slug}/undelete",
  request: {
    params: z.object({ slug: z.string() }),
  },
  responses: {
    200: {
      description: "Undelete a doc",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const purgeDocRoute = createRoute({
  method: "post",
  path: "/admin/{slug}/purge",
  request: {
    params: z.object({ slug: z.string() }),
  },
  responses: {
    200: {
      description: "Purge a doc",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});
