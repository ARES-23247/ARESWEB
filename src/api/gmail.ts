import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { client, unwrapResponse } from "./honoClient";
import { toast } from "sonner";

export type GmailMessage = {
  id: string;
  threadId: string;
  snippet: string;
  labelIds: string[];
  payload?: {
    headers?: Array<{ name: string; value: string }>;
    body?: { data?: string };
  };
  internalDate: string;
};

export type GmailThread = {
  id: string;
  historyId: string;
  messages: GmailMessage[];
};

export type GmailLabel = {
  id: string;
  name: string;
  type?: "system" | "user";
};

export type ListMessagesResponse = {
  messages?: GmailMessage[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
};

export type SendMessageInput = {
  to: string[];
  subject: string;
  body: string;
  cc?: string[];
  bcc?: string[];
  threadId?: string;
};

export function useGmailAuthStatus() {
  return useQuery({
    queryKey: ["gmail", "authStatus"],
    queryFn: async () => {
      const res = await client.gmail.status.$get();
      return unwrapResponse<{ isAuthenticated: boolean; memberType?: "student" | "mentor" | "coach" }>(res);
    },
  });
}

export function useGmailMessages(params: {
  labelIds?: string;
  maxResults?: number;
  pageToken?: string;
  q?: string;
}, enabled = true) {
  return useQuery({
    queryKey: ["gmail", "messages", params],
    queryFn: async () => {
      const res = await client.gmail.messages.$get({
        query: {
          labelIds: params.labelIds ?? "INBOX",
          maxResults: params.maxResults ?? 20,
          pageToken: params.pageToken,
          q: params.q,
        },
      });
      return unwrapResponse<ListMessagesResponse>(res);
    },
    enabled,
  });
}

export function useGmailThread(id: string) {
  return useQuery({
    queryKey: ["gmail", "thread", id],
    queryFn: async () => {
      const res = await client.gmail.threads[":id"].$get({
        param: { id },
      });
      return unwrapResponse<GmailThread>(res);
    },
    enabled: !!id,
  });
}

export function useGmailLabels() {
  return useQuery({
    queryKey: ["gmail", "labels"],
    queryFn: async () => {
      const res = await client.gmail.labels.$get();
      return unwrapResponse<{ labels: GmailLabel[] }>(res);
    },
  });
}

export function useSendGmailMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: SendMessageInput) => {
      const res = await client.gmail.messages.send.$post({
        json: data,
      });
      return unwrapResponse<{ id: string; threadId: string }>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gmail", "messages"] });
      toast.success("Email sent successfully");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to send email");
    },
  });
}
