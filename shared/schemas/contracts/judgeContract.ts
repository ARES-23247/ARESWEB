import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

export const judgeAccessCodeSchema = z.object({
  id: z.string(),
  code: z.string(),
  label: z.string(),
  created_at: z.string(),
  expires_at: z.string().nullable(),
});

export const judgeContract = c.router({
  login: {
    method: "POST",
    path: "/login",
    body: z.object({
      code: z.string(),
      turnstileToken: z.string().optional(),
    }),
    responses: {
      200: z.object({
        success: z.boolean(),
        label: z.string().optional(),
        error: z.string().optional(),
      }),
      400: z.object({ error: z.string() }),
      403: z.object({ error: z.string() }),
      429: z.object({ error: z.string() }),
      500: z.object({ error: z.string() }),
    },
    summary: "Verify judge access code",
  },
  portfolio: {
    method: "GET",
    path: "/portfolio",
    headers: z.object({
      Authorization: z.string().optional(),
      "x-judge-code": z.string().optional(),
    }),
    responses: {
      200: z.any(), // Complex payload
      401: z.object({ error: z.string() }),
      403: z.object({ error: z.string() }),
      429: z.object({ error: z.string() }),
      500: z.object({ error: z.string() }),
    },
    summary: "Get all portfolio content",
  },
  listCodes: {
    method: "GET",
    path: "/admin/codes",
    responses: {
      200: z.object({
        codes: z.array(judgeAccessCodeSchema),
      }),
      401: z.object({ error: z.string() }),
      500: z.object({ error: z.string() }),
    },
    summary: "List all access codes (admin)",
  },
  createCode: {
    method: "POST",
    path: "/admin/codes",
    body: z.object({
      label: z.string().optional(),
      expiresAt: z.string().optional(),
    }),
    responses: {
      200: z.object({
        success: z.boolean(),
        code: z.string(),
        id: z.string(),
      }),
      401: z.object({ error: z.string() }),
      500: z.object({ error: z.string() }),
    },
    summary: "Create a new access code (admin)",
  },
  deleteCode: {
    method: "DELETE",
    path: "/admin/codes/:id",
    pathParams: z.object({
      id: z.string(),
    }),
    body: c.noBody(),
    responses: {
      200: z.object({
        success: z.boolean(),
      }),
      401: z.object({ error: z.string() }),
      500: z.object({ error: z.string() }),
    },
    summary: "Delete an access code (admin)",
  },
});
