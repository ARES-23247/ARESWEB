/**
 * Zulip API - Team Chat Integration
 *
 * Types imported from backend route definitions in @shared/routes/zulip.ts
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { z } from "zod";
import { client, unwrapResponse, withMutationCallbacks } from "./honoClient";
import { zulipPresenceSchema } from "@shared/routes/zulip";

// Infer TypeScript types from Zod schemas
export type ZulipPresence = z.infer<typeof zulipPresenceSchema>;

export interface ZulipMessage {
  id: number;
  sender_full_name: string;
  avatar_url: string;
  content: string;
  timestamp: number;
  sender_email: string;
}


// ============================================
// Zulip Presence & Messaging
// ============================================

/**
 * GET /api/zulip/presence - Get team presence data
 */
export function useGetPresence(
  options?: Omit<UseQueryOptions<{ success: boolean; presence: ZulipPresence; userNames?: Record<string, string>; userAvatars?: Record<string, string> }>, "queryKey" | "queryFn">
) {
  return useQuery<{ success: boolean; presence: ZulipPresence; userNames?: Record<string, string>; userAvatars?: Record<string, string> }>({
    queryKey: ["zulip", "presence"],
    queryFn: async () => {
      const response = await client.zulip.presence.$get();
      return unwrapResponse<{ success: boolean; presence: ZulipPresence; userNames?: Record<string, string>; userAvatars?: Record<string, string> }>(response);
    },
    ...options,
  });
}

/**
 * POST /api/zulip/message - Send message to stream
 */
export function useSendMessage(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, { stream: string; topic: string; content: string }>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, { stream: string; topic: string; content: string }>({
    mutationFn: async (data) => {
      const response = await client.zulip.message.$post({ json: data });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["zulip"] });
      }
    })
  });
}

/**
 * GET /api/zulip/topic - Get messages for a topic
 */
export function useGetTopicMessages(
  query: { stream: string; topic: string },
  options?: Omit<UseQueryOptions<{ success: boolean; messages: ZulipMessage[] }>, "queryKey" | "queryFn" | "enabled">
) {
  return useQuery<{ success: boolean; messages: ZulipMessage[] }>({
    queryKey: ["zulip", "topic", query.stream, query.topic],
    queryFn: async () => {
      const response = await client.zulip.topic.$get({ query });
      return unwrapResponse<{ success: boolean; messages: ZulipMessage[] }>(response);
    },
    enabled: !!(query.stream && query.topic),
    ...options,
  });
}


// ============================================
// Zulip User Management (Admin)
// ============================================

/**
 * GET /api/zulip/invites/audit - Audit missing Zulip users
 */
export function useAuditMissingUsers(
  options?: Omit<UseQueryOptions<{ success: boolean; missingEmails: string[]; debug: { totalZulipUsers: number; totalAresUsers: number; sampleZulipEmails: string[]; sampleMissingEmails: string[] } }>, "queryKey" | "queryFn">
) {
  return useQuery<{ success: boolean; missingEmails: string[]; debug: { totalZulipUsers: number; totalAresUsers: number; sampleZulipEmails: string[]; sampleMissingEmails: string[] } }>({
    queryKey: ["zulip", "invites", "audit"],
    queryFn: async () => {
      const response = await client.zulip.invites.audit.$get();
      return unwrapResponse<{ success: boolean; missingEmails: string[]; debug: { totalZulipUsers: number; totalAresUsers: number; sampleZulipEmails: string[]; sampleMissingEmails: string[] } }>(response);
    },
    ...options,
  });
}

/**
 * POST /api/zulip/invites/send - Invite users to Zulip
 */
export function useInviteUsers(
  options?: Omit<UseMutationOptions<{ success: boolean; invitedCount: number }, Error, { emails: string[] }>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean; invitedCount: number }, Error, { emails: string[] }>({
    mutationFn: async (data) => {
      const response = await client.zulip.invites.send.$post({ json: data });
      return unwrapResponse<{ success: boolean; invitedCount: number }>(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["zulip"] });
      }
    })
  });
}
