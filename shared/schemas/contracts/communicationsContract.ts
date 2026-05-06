import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { standardErrors } from "./common";

const c = initContract();

export const communicationsContract = c.router({
  sendMassEmail: {
    method: "POST",
    path: "/mass-email",
    body: z.object({
      subject: z.string().min(1, "Subject is required"),
      htmlContent: z.string().min(1, "Content is required"),
    }),
    responses: {
      ...standardErrors,
      200: z.object({
        success: z.boolean(),
        message: z.string(),
        recipientCount: z.number().optional(),
      }),
    },
    summary: "Send mass email to active Zulip members via Resend",
  },
  getStats: {
    method: "GET",
    path: "/stats",
    responses: {
      ...standardErrors,
      200: z.object({
        activeUsers: z.number(),
      }),
    },
    summary: "Get count of active users for mass email preview",
  },
});
export type CommunicationsContract = typeof communicationsContract;
