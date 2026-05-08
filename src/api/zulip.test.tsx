import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as honoClient from "./honoClient";
import * as zulipApi from "./zulip";

// Mock the honoClient module
vi.mock("./honoClient", () => ({
  client: {
    zulip: {
      presence: {
        $get: vi.fn(),
      },
      message: {
        $post: vi.fn(),
      },
      topic: {
        $get: vi.fn(),
      },
      invites: {
        audit: {
          $get: vi.fn(),
        },
        send: {
          $post: vi.fn(),
        },
      },
    },
  },
  unwrapResponse: vi.fn(),
}));

const mockClient = honoClient.client as any;
const mockUnwrapResponse = honoClient.unwrapResponse as ReturnType<typeof vi.fn>;

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>
);

describe("Zulip API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useGetPresence", () => {
    it("should fetch Zulip presence successfully", async () => {
      const mockPresence = {
        "user@example.com": { status: "active", timestamp: 1234567890 },
      };
      const mockResponse = {
        success: true,
        presence: mockPresence,
        userNames: { "user@example.com": "Test User" },
      };
      mockClient.zulip.presence.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => zulipApi.useGetPresence(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockClient.zulip.presence.$get).toHaveBeenCalled();
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch presence");
      mockClient.zulip.presence.$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => zulipApi.useGetPresence(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });

    it("should handle empty presence data", async () => {
      const mockResponse = {
        success: true,
        presence: {},
        userNames: {},
      };
      mockClient.zulip.presence.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => zulipApi.useGetPresence(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.presence).toEqual({});
    });
  });

  describe("useSendMessage", () => {
    it("should send message successfully", async () => {
      const mockResponse = { success: true };
      mockClient.zulip.message.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => zulipApi.useSendMessage(), { wrapper });

      result.current.mutate({
        stream: "general",
        topic: "Test Topic",
        content: "Test message",
      } as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.zulip.message.$post).toHaveBeenCalledWith({
        json: {
          stream: "general",
          topic: "Test Topic",
          content: "Test message",
        },
      });
    });

    it("should handle sending errors", async () => {
      const mockError = new Error("Failed to send message");
      mockClient.zulip.message.$post.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => zulipApi.useSendMessage(), { wrapper });

      result.current.mutate({
        stream: "general",
        topic: "Test Topic",
        content: "Test message",
      } as any);

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });

    it("should invalidate zulip queries on success", async () => {
      const queryClient = createQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const mockResponse = { success: true };
      mockClient.zulip.message.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => zulipApi.useSendMessage(), { wrapper: customWrapper });

      result.current.mutate({
        stream: "general",
        topic: "Test Topic",
        content: "Test message",
      } as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["zulip"] });
    });
  });

  describe("useGetTopicMessages", () => {
    it("should fetch topic messages successfully", async () => {
      const mockMessages = [
        { id: "1", content: "Message 1" },
        { id: "2", content: "Message 2" },
      ];
      const mockResponse = { success: true, messages: mockMessages };
      mockClient.zulip.topic.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(
        () => zulipApi.useGetTopicMessages({ stream: "general", topic: "Test Topic" }),
        { wrapper }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockClient.zulip.topic.$get).toHaveBeenCalledWith({
        query: { stream: "general", topic: "Test Topic" },
      });
    });

    it("should be disabled when stream or topic is empty", async () => {
      const { result: result1 } = renderHook(
        () => zulipApi.useGetTopicMessages({ stream: "", topic: "Test Topic" }),
        { wrapper }
      );
      const { result: result2 } = renderHook(
        () => zulipApi.useGetTopicMessages({ stream: "general", topic: "" }),
        { wrapper }
      );

      expect(result1.current.fetchStatus).toBe("idle");
      expect(result2.current.fetchStatus).toBe("idle");
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch messages");
      mockClient.zulip.topic.$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(
        () => zulipApi.useGetTopicMessages({ stream: "general", topic: "Test Topic" }),
        { wrapper }
      );

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });
  });

  describe("useAuditMissingUsers", () => {
    it("should audit missing users successfully", async () => {
      const mockResponse = {
        success: true,
        missingEmails: ["user1@example.com", "user2@example.com"],
        debug: {
          totalZulipUsers: 10,
          totalAresUsers: 12,
          sampleZulipEmails: ["zulip@example.com"],
          sampleMissingEmails: ["user1@example.com"],
        },
      };
      mockClient.zulip.invites.audit.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => zulipApi.useAuditMissingUsers(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockClient.zulip.invites.audit.$get).toHaveBeenCalled();
    });

    it("should handle no missing users", async () => {
      const mockResponse = {
        success: true,
        missingEmails: [],
        debug: {
          totalZulipUsers: 10,
          totalAresUsers: 10,
          sampleZulipEmails: ["zulip@example.com"],
          sampleMissingEmails: [],
        },
      };
      mockClient.zulip.invites.audit.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => zulipApi.useAuditMissingUsers(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.missingEmails).toEqual([]);
    });
  });

  describe("useInviteUsers", () => {
    it("should invite users successfully", async () => {
      const mockResponse = { success: true, invitedCount: 5 };
      mockClient.zulip.invites.send.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => zulipApi.useInviteUsers(), { wrapper });

      result.current.mutate({ emails: ["user1@example.com", "user2@example.com"] } as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.zulip.invites.send.$post).toHaveBeenCalledWith({
        json: { emails: ["user1@example.com", "user2@example.com"] },
      });
    });

    it("should handle invite errors", async () => {
      const mockError = new Error("Failed to invite users");
      mockClient.zulip.invites.send.$post.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => zulipApi.useInviteUsers(), { wrapper });

      result.current.mutate({ emails: ["user1@example.com"] } as any);

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });

    it("should invalidate zulip queries on success", async () => {
      const queryClient = createQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const mockResponse = { success: true, invitedCount: 2 };
      mockClient.zulip.invites.send.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => zulipApi.useInviteUsers(), { wrapper: customWrapper });

      result.current.mutate({ emails: ["user1@example.com"] } as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["zulip"] });
    });
  });
});
