import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { standardErrors } from "./common";

const c = initContract();

export const inquirySchema = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string(),
  email: z.string(),
  metadata: z.string().nullable().optional(), // JSON string from DB
  status: z.string(),
  created_at: z.string(),
  zulip_message_id: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const inquiryInputSchema = z.object({
  type: z.enum(["sponsor", "student", "mentor", "outreach", "support"]),
  name: z.string().min(1),
  email: z.string().min(1, "Email is required").email("Please enter a valid email address (e.g., user@example.com)").max(320, "Email is too long"),
  metadata: z.record(z.string(), z.unknown()).optional(),
  turnstileToken: z.string().optional(),
});

export const inquiryContract = c.router({
  list: {
    method: "GET",
    path: "/admin/list",
    query: z.object({
      limit: z.coerce.number().optional(),
      offset: z.coerce.number().optional(),
    }),
    responses: {
      ...standardErrors,
      200: z.object({
        inquiries: z.array(inquirySchema),
      }),
    },
    summary: "List all inquiries",
  },
  submit: {
    method: "POST",
    path: "/",
    body: inquiryInputSchema,
    responses: {
      ...standardErrors,
      200: z.object({
        success: z.boolean(),
        id: z.string(),
        warning: z.string().optional(),
      }),
      207: z.object({
        success: z.boolean(),
        id: z.string(),
        warning: z.string().optional(),
      }),
    },
    summary: "Submit a new inquiry",
  },
  updateStatus: {
    method: "PATCH",
    path: "/admin/:id/status",
    pathParams: z.object({
      id: z.string(),
    }),
    body: z.object({
      status: z.enum(["pending", "approved", "resolved", "rejected"]),
    }),
    responses: {
      ...standardErrors,
      200: z.object({
        success: z.boolean(),
        status: z
          .enum(["pending", "approved", "resolved", "rejected"])
          .optional(),
      }),
    },
    summary: "Update inquiry status",
  },
  updateNotes: {
    method: "PATCH",
    path: "/admin/:id/notes",
    pathParams: z.object({
      id: z.string(),
    }),
    body: z.object({
      notes: z.string().nullable(),
    }),
    responses: {
      ...standardErrors,
      200: z.object({
        success: z.boolean(),
      }),
    },
    summary: "Update inquiry notes",
  },
  delete: {
    method: "DELETE",
    path: "/admin/:id",
    pathParams: z.object({
      id: z.string(),
    }),
    body: c.noBody(),
    responses: {
      ...standardErrors,
      200: z.object({
        success: z.boolean(),
      }),
    },
    summary: "Delete an inquiry",
  },
});
export type InquiryContract = typeof inquiryContract;
