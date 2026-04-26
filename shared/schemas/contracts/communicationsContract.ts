import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

export const communicationsContract = c.router({
  sendMassEmail: {
    method: "POST",
    path: "/api/communications/mass-email",
    body: z.object({
      subject: z.string().min(1, "Subject is required"),
      htmlContent: z.string().min(1, "Content is required"),
    }),
    responses: {
      200: z.object({
        success: z.boolean(),
        message: z.string(),
        recipientCount: z.number().optional(),
      }),
      400: z.object({
        success: z.literal(false),
        error: z.string(),
      }),
      500: z.object({
        success: z.literal(false),
        error: z.string(),
      }),
    },
    summary: "Send mass email to active Zulip members via Resend",
  },
  getStats: {
    method: "GET",
    path: "/api/communications/stats",
    responses: {
      200: z.object({
        activeUsers: z.number(),
      }),
      500: z.object({
        success: z.literal(false),
        error: z.string(),
      }),
    },
    summary: "Get count of active users for mass email preview",
  },
});
