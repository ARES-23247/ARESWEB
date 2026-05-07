import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "../routes/common";

// Convert standardErrors to OpenAPI responses format
const openApiErrorResponses = {
  400: { content: { "application/json": { schema: standardErrors[400] } }, description: "Bad Request" },
  401: { content: { "application/json": { schema: standardErrors[401] } }, description: "Unauthorized" },
  403: { content: { "application/json": { schema: standardErrors[403] } }, description: "Forbidden" },
  404: { content: { "application/json": { schema: standardErrors[404] } }, description: "Not Found" },
  500: { content: { "application/json": { schema: standardErrors[500] } }, description: "Internal Server Error" },
  429: { content: { "application/json": { schema: standardErrors[429] } }, description: "Too Many Requests" },
};

// Schemas
const DocResponseSchema = z.object({
  slug: z.string(),
  title: z.string().nullable(),
  category: z.string().nullable(),
  sort_order: z.number().nullable(),
  description: z.string().nullable(),
  is_portfolio: z.number().nullable(),
  is_executive_summary: z.number().nullable(),
  zulip_stream: z.string().nullable().optional(),
  zulip_topic: z.string().nullable().optional(),
  is_deleted: z.number().nullable(),
  status: z.string().nullable(),
  revision_of: z.string().nullable(),
  display_in_areslib: z.number().nullable(),
  display_in_math_corner: z.number().nullable(),
  display_in_science_corner: z.number().nullable(),
  original_author_nickname: z.string().optional(),
  original_author_avatar: z.string().optional(),
});

const DocDetailResponseSchema = DocResponseSchema.extend({
  content: z.string().nullable(),
  updated_at: z.string().optional(),
});

const ContributorSchema = z.object({
  nickname: z.string().nullable(),
  avatar: z.string().nullable(),
});

const SearchResultSchema = z.object({
  slug: z.string(),
  title: z.string(),
  category: z.string(),
  description: z.string().nullable(),
  snippet: z.string(),
});

const DocHistorySchema = z.object({
  id: z.number(),
  slug: z.string(),
  title: z.string().nullable(),
  category: z.string().nullable(),
  description: z.string().nullable(),
  content: z.string().nullable().optional(),
  author_email: z.string().nullable(),
  created_at: z.string(),
});

const DocSchema = z.object({
  slug: z.string(),
  title: z.string().min(1).max(255),
  category: z.string().min(1).max(255),
  sortOrder: z.number().int().default(10),
  description: z.string().max(5000).optional(),
  content: z.string().min(1).max(200000),
  isPortfolio: z.boolean().default(false),
  isExecutiveSummary: z.boolean().default(false),
  isDraft: z.boolean().optional(),
  displayInAreslib: z.boolean().default(false),
  displayInMathCorner: z.boolean().default(false),
  displayInScienceCorner: z.boolean().default(false),
});

// Routes
export const getDocsRoute = createRoute({
  method: "get",
  path: "/",
  responses: {
    ...openApiErrorResponses,
    200: {
      content: {
        "application/json": {
          schema: z.object({ docs: z.array(DocResponseSchema) }),
        },
      },
      description: "List all public docs",
    },
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
    ...openApiErrorResponses,
    200: {
      content: {
        "application/json": {
          schema: z.object({ results: z.array(SearchResultSchema) }),
        },
      },
      description: "Search docs by query",
    },
  },
});

export const adminListRoute = createRoute({
  method: "get",
  path: "/admin/list",
  responses: {
    ...openApiErrorResponses,
    200: {
      content: {
        "application/json": {
          schema: z.object({ docs: z.array(DocResponseSchema) }),
        },
      },
      description: "List all docs (admin view)",
    },
  },
});

export const adminDetailRoute = createRoute({
  method: "get",
  path: "/admin/{slug}/detail",
  request: {
    params: z.object({
      slug: z.string(),
    }),
  },
  responses: {
    ...openApiErrorResponses,
    200: {
      content: {
        "application/json": {
          schema: z.object({ doc: DocDetailResponseSchema }),
        },
      },
      description: "Get doc detail (admin view)",
    },
  },
});

export const getDocRoute = createRoute({
  method: "get",
  path: "/{slug}",
  request: {
    params: z.object({
      slug: z.string(),
    }),
  },
  responses: {
    ...openApiErrorResponses,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            doc: DocDetailResponseSchema,
            contributors: z.array(ContributorSchema),
          }),
        },
      },
      description: "Get single doc with contributors",
    },
  },
});

export const deleteDocRoute = createRoute({
  method: "delete",
  path: "/admin/{slug}",
  request: {
    params: z.object({
      slug: z.string(),
    }),
  },
  responses: {
    ...openApiErrorResponses,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Delete doc (soft delete)",
    },
  },
});

export const saveDocRoute = createRoute({
  method: "post",
  path: "/admin/save",
  request: {
    body: {
      content: {
        "application/json": {
          schema: DocSchema,
        },
      },
    },
  },
  responses: {
    ...openApiErrorResponses,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean(), slug: z.string() }),
        },
      },
      description: "Save or update doc",
    },
  },
});

export const updateSortRoute = createRoute({
  method: "patch",
  path: "/admin/{slug}/sort",
  request: {
    params: z.object({
      slug: z.string(),
    }),
    body: {
      content: {
        "application/json": {
          schema: z.object({ sortOrder: z.number() }),
        },
      },
    },
  },
  responses: {
    ...openApiErrorResponses,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Update doc sort order",
    },
  },
});

export const submitFeedbackRoute = createRoute({
  method: "post",
  path: "/{slug}/feedback",
  request: {
    params: z.object({
      slug: z.string(),
    }),
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
    400: openApiErrorResponses[400],
    403: openApiErrorResponses[403],
    429: openApiErrorResponses[429],
    500: openApiErrorResponses[500],
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Submit doc feedback",
    },
  },
});

export const getHistoryRoute = createRoute({
  method: "get",
  path: "/admin/{slug}/history",
  request: {
    params: z.object({
      slug: z.string(),
    }),
  },
  responses: {
    ...openApiErrorResponses,
    200: {
      content: {
        "application/json": {
          schema: z.object({ history: z.array(DocHistorySchema) }),
        },
      },
      description: "Get doc history",
    },
  },
});

export const restoreHistoryRoute = createRoute({
  method: "patch",
  path: "/admin/{slug}/history/{id}/restore",
  request: {
    params: z.object({
      slug: z.string(),
      id: z.coerce.number(),
    }),
  },
  responses: {
    ...openApiErrorResponses,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Restore doc from history",
    },
  },
});

export const approveDocRoute = createRoute({
  method: "post",
  path: "/admin/{slug}/approve",
  request: {
    params: z.object({
      slug: z.string(),
    }),
  },
  responses: {
    ...openApiErrorResponses,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Approve doc",
    },
  },
});

export const rejectDocRoute = createRoute({
  method: "post",
  path: "/admin/{slug}/reject",
  request: {
    params: z.object({
      slug: z.string(),
    }),
    body: {
      content: {
        "application/json": {
          schema: z.object({ reason: z.string().optional() }),
        },
      },
    },
  },
  responses: {
    ...openApiErrorResponses,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Reject doc",
    },
  },
});

export const undeleteDocRoute = createRoute({
  method: "post",
  path: "/admin/{slug}/undelete",
  request: {
    params: z.object({
      slug: z.string(),
    }),
  },
  responses: {
    ...openApiErrorResponses,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Undelete doc",
    },
  },
});

export const purgeDocRoute = createRoute({
  method: "post",
  path: "/admin/{slug}/purge",
  request: {
    params: z.object({
      slug: z.string(),
    }),
  },
  responses: {
    ...openApiErrorResponses,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Permanently delete doc",
    },
  },
});

export const exportAllDocsRoute = createRoute({
  method: "get",
  path: "/admin/export",
  responses: {
    ...openApiErrorResponses,
    200: {
      content: {
        "application/json": {
          schema: z.object({ docs: z.array(DocDetailResponseSchema) }),
        },
      },
      description: "Export all docs as JSON",
    },
  },
});

export const exportSingleDocRoute = createRoute({
  method: "get",
  path: "/admin/{slug}/export",
  request: {
    params: z.object({
      slug: z.string(),
    }),
  },
  responses: {
    ...openApiErrorResponses,
    200: {
      content: {
        "text/plain": {
          schema: z.string(),
        },
      },
      description: "Export single doc as Markdown",
    },
  },
});
