import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as honoClient from "./honoClient";
import * as communicationsApi from "./communications";

// Mock the honoClient module
vi.mock("./honoClient", () => ({
  client: {
    communications: {
      admin: {
        "mass-email": {
          $post: vi.fn(),
        },
        stats: {
          $get: vi.fn(),
        },
      },
    },
  },
  unwrapResponse: vi.fn(),
}));

// Mock types for the Hono client
interface MockCommunicationsClient {
  admin: {
    "mass-email": {
      $post: ReturnType<typeof vi.fn>;
    };
    stats: {
      $get: ReturnType<typeof vi.fn>;
    };
  };
}

interface MockClient {
  communications: MockCommunicationsClient;
}

const mockClient = honoClient.client as MockClient;
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

describe("Communications API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useSendMassEmail", () => {
    it("should send mass email successfully", async () => {
      const mockResponse = { success: true, recipientCount: 150 };
      const emailData = {
        subject: "Team Update",
        htmlContent: "<p>Hello team!</p>",
      };
      mockClient.communications.admin["mass-email"].$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => communicationsApi.useSendMassEmail(), { wrapper });

      result.current.mutate(emailData);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.communications.admin["mass-email"].$post).toHaveBeenCalledWith({
        json: emailData,
      });
      expect(result.current.data?.recipientCount).toBe(150);
    });

    it("should handle email with message", async () => {
      const mockResponse = { success: true, message: "Email queued for delivery" };
      mockClient.communications.admin["mass-email"].$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => communicationsApi.useSendMassEmail(), { wrapper });

      result.current.mutate({ subject: "Test", htmlContent: "<p>Test</p>" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.message).toBe("Email queued for delivery");
    });

    it("should handle send errors", async () => {
      const mockResponse = { success: false, error: "Failed to send email" };
      mockClient.communications.admin["mass-email"].$post.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(new Error(mockResponse.error));

      const { result } = renderHook(() => communicationsApi.useSendMassEmail(), { wrapper });

      result.current.mutate({ subject: "Test", htmlContent: "Content" });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useGetMassEmailStats", () => {
    it("should fetch mass email stats successfully", async () => {
      const mockStats = { activeUsers: 42 };
      mockClient.communications.admin.stats.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockStats);

      const { result } = renderHook(() => communicationsApi.useGetMassEmailStats(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockStats);
      expect(result.current.data?.activeUsers).toBe(42);
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch stats");
      mockClient.communications.admin.stats.$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => communicationsApi.useGetMassEmailStats(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });

    it("should handle zero active users", async () => {
      const mockStats = { activeUsers: 0 };
      mockClient.communications.admin.stats.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockStats);

      const { result } = renderHook(() => communicationsApi.useGetMassEmailStats(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.activeUsers).toBe(0);
    });
  });
});
