import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

export const zulipPresenceSchema = z.record(
  z.string(),
  z.object({
    active: z
      .object({
        status: z.string(),
        timestamp: z.number(),
      })
      .optional(),
    idle: z
      .object({
        status: z.string(),
        timestamp: z.number(),
      })
      .optional(),
  }),
);

export const zulipContract = c.router({
  getPresence: {
    method: "GET",
    path: "/presence",
    responses: {
      200: z.object({
        success: z.boolean(),
        presence: zulipPresenceSchema,
        userNames: z.record(z.string(), z.string()).optional(),
      }),
      500: z.object({ success: z.boolean(), error: z.string() }),
    },
    summary: "Get Zulip team presence",
  },
  sendMessage: {
    method: "POST",
    path: "/message",
    body: z.object({
      stream: z.string(),
      topic: z.string(),
      content: z.string(),
    }),
    responses: {
      200: z.object({ success: z.boolean() }),
      500: z.object({ success: z.boolean(), error: z.string() }),
    },
    summary: "Send a Zulip message",
  },
  getTopicMessages: {
    method: "GET",
    path: "/topic",
    query: z.object({
      stream: z.string(),
      topic: z.string(),
    }),
    responses: {
      200: z.object({ success: z.boolean(), messages: z.any() }),
      403: z.object({ success: z.boolean(), error: z.string() }),
      500: z.object({ success: z.boolean(), error: z.string() }),
    },
    summary: "Get messages for a specific Zulip topic",
  },
});
