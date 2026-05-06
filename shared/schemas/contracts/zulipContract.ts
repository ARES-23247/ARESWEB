import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { standardErrors } from "./common";

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
      ...standardErrors,
      200: z.object({
        success: z.boolean(),
        presence: zulipPresenceSchema,
        userNames: z.record(z.string(), z.string()).optional(),
      }),
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
      ...standardErrors,
      200: z.object({ success: z.boolean() }),
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
      ...standardErrors,
      200: z.object({ success: z.boolean(), messages: z.array(z.unknown()) }),
    },
    summary: "Get messages for a specific Zulip topic",
  },
  auditMissingUsers: {
    method: "GET",
    path: "/invites/audit",
    responses: {
      ...standardErrors,
      200: z.object({ 
        success: z.boolean(), 
        missingEmails: z.array(z.string()),
        debug: z.object({
          totalZulipUsers: z.number(),
          totalAresUsers: z.number(),
          sampleZulipEmails: z.array(z.string()),
          sampleMissingEmails: z.array(z.string()),
        })
      }),
    },
    summary: "Audit ARESWEB database against Zulip directory to find missing users",
  },
  inviteUsers: {
    method: "POST",
    path: "/invites/send",
    body: z.object({
      emails: z.array(z.string()),
    }),
    responses: {
      ...standardErrors,
      200: z.object({ success: z.boolean(), invitedCount: z.number() }),
    },
    summary: "Send Zulip invitations to the specified emails",
  },
});
export type ZulipContract = typeof zulipContract;
