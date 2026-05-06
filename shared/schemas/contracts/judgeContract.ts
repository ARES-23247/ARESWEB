import { createRoute, z } from "@hono/zod-openapi";
import { openApiStandardErrors } from "./common";

export const judgeAccessCodeSchema = z.object({
  id: z.string(),
  code: z.string(),
  label: z.string(),
  created_at: z.string(),
  expires_at: z.string().nullable(),
});

export const judgeLoginRoute = createRoute({
  method: "post",
  path: "/login",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            code: z.string(),
            turnstileToken: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Verify judge access code",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            label: z.string().optional(),
            error: z.string().optional(),
          }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});

export const judgePortfolioRoute = createRoute({
  method: "get",
  path: "/portfolio",
  request: {
    headers: z.object({
      Authorization: z.string().optional(),
      "x-judge-code": z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: "Get all portfolio content",
      content: { "application/json": { schema: z.any() } }, // Complex payload
    },
    ...openApiStandardErrors,
  },
});

export const listJudgeCodesRoute = createRoute({
  method: "get",
  path: "/admin/codes",
  responses: {
    200: {
      description: "List all access codes (admin)",
      content: {
        "application/json": {
          schema: z.object({
            codes: z.array(judgeAccessCodeSchema),
          }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});

export const createJudgeCodeRoute = createRoute({
  method: "post",
  path: "/admin/codes",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            label: z.string().optional(),
            expiresAt: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Create a new access code (admin)",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            code: z.string(),
            id: z.string(),
          }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});

export const deleteJudgeCodeRoute = createRoute({
  method: "delete",
  path: "/admin/codes/{id}",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: "Delete an access code (admin)",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});
