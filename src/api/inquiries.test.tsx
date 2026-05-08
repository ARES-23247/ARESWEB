import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as honoClient from "./honoClient";
import * as inquiriesApi from "./inquiries";

// Mock the honoClient module
vi.mock("./honoClient", () => ({
  client: {
    inquiries: {
      $post: vi.fn(),
      admin: {
        list: {
          $get: vi.fn(),
        },
        ":id": {
          status: {
            $patch: vi.fn(),
          },
          notes: {
            $patch: vi.fn(),
          },
          $delete: vi.fn(),
        },
      },
    },
  },
  unwrapResponse: vi.fn(),
}));

const mockClient = honoClient.client as unknown as {
  inquiries: {
    $post: ReturnType<typeof vi.fn>;
    admin: {
      list: { $get: ReturnType<typeof vi.fn> };
      ":id": {
        status: { $patch: ReturnType<typeof vi.fn> };
        notes: { $patch: ReturnType<typeof vi.fn> };
        $delete: ReturnType<typeof vi.fn>;
      };
    };
  };
};
const mockUnwrapResponse = honoClient.unwrapResponse as ReturnType<typeof vi.fn>;

// Type aliases for mutation parameters
type SubmitInquiryParams = Parameters<ReturnType<typeof inquiriesApi.useSubmitInquiry>['mutate']>[0];
type UpdateInquiryStatusParams = Parameters<ReturnType<typeof inquiriesApi.useUpdateInquiryStatus>['mutate']>[0];
type UpdateInquiryNotesParams = Parameters<ReturnType<typeof inquiriesApi.useUpdateInquiryNotes>['mutate']>[0];
type DeleteInquiryParams = Parameters<ReturnType<typeof inquiriesApi.useDeleteInquiry>['mutate']>[0];

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

describe("Inquiries API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useGetAdminInquiries", () => {
    it("should fetch admin inquiries successfully", async () => {
      const mockInquiries = [
        { id: "1", name: "John Doe", email: "john@example.com", status: "pending" },
        { id: "2", name: "Jane Smith", email: "jane@example.com", status: "contacted" },
      ];
      const mockResponse = { inquiries: mockInquiries };
      mockClient.inquiries.admin.list.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => inquiriesApi.useGetAdminInquiries(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
    });

    it("should pass query parameters", async () => {
      const mockResponse = { inquiries: [] };
      mockClient.inquiries.admin.list.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(
        () => inquiriesApi.useGetAdminInquiries({ limit: 20, offset: 40 }),
        { wrapper }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.inquiries.admin.list.$get).toHaveBeenCalledWith({
        query: { limit: 20, offset: 40 },
      });
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch inquiries");
      mockClient.inquiries.admin.list.$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => inquiriesApi.useGetAdminInquiries(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useSubmitInquiry", () => {
    it("should submit inquiry successfully", async () => {
      const mockResponse = { success: true, id: "new-inquiry-123" };
      const inquiryData = {
        name: "Test User",
        email: "test@example.com",
        type: "student",
        message: "I want to join the team",
      };
      mockClient.inquiries.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => inquiriesApi.useSubmitInquiry(), { wrapper });

      result.current.mutate(inquiryData as unknown as SubmitInquiryParams);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.inquiries.$post).toHaveBeenCalledWith({
        json: inquiryData,
      });
      expect(result.current.data?.id).toBe("new-inquiry-123");
    });

    it("should handle submission with warning", async () => {
      const mockResponse = { success: true, id: "123", warning: "Duplicate inquiry detected" };
      mockClient.inquiries.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => inquiriesApi.useSubmitInquiry(), { wrapper });

      result.current.mutate({ name: "Test", email: "test@test.com", type: "mentor", message: "Hi" } as unknown as SubmitInquiryParams);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.warning).toBe("Duplicate inquiry detected");
    });

    it("should invalidate admin inquiries cache on success", async () => {
      const queryClient = createQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const mockResponse = { success: true, id: "123" };
      mockClient.inquiries.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => inquiriesApi.useSubmitInquiry(), { wrapper: customWrapper });

      result.current.mutate({ name: "Test", email: "test@test.com", type: "student", message: "Test" } as unknown as SubmitInquiryParams);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin_inquiries"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin", "action-items"] });
    });
  });

  describe("useUpdateInquiryStatus", () => {
    it("should update inquiry status successfully", async () => {
      const mockResponse = { success: true, status: "contacted" };
      mockClient.inquiries.admin[":id"].status.$patch.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => inquiriesApi.useUpdateInquiryStatus(), { wrapper });

      result.current.mutate({ id: "inquiry-123", status: "contacted" } as UpdateInquiryStatusParams);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.inquiries.admin[":id"].status.$patch).toHaveBeenCalledWith({
        param: { id: "inquiry-123" },
        json: { status: "contacted" },
      });
    });

    it("should invalidate admin inquiries cache on success", async () => {
      const queryClient = createQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const mockResponse = { success: true };
      mockClient.inquiries.admin[":id"].status.$patch.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => inquiriesApi.useUpdateInquiryStatus(), { wrapper: customWrapper });

      result.current.mutate({ id: "123", status: "completed" } as UpdateInquiryStatusParams);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin_inquiries"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin", "action-items"] });
    });
  });

  describe("useUpdateInquiryNotes", () => {
    it("should update inquiry notes successfully", async () => {
      const mockResponse = { success: true };
      mockClient.inquiries.admin[":id"].notes.$patch.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => inquiriesApi.useUpdateInquiryNotes(), { wrapper });

      result.current.mutate({ id: "inquiry-123", notes: "Called and left voicemail" } as UpdateInquiryNotesParams);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.inquiries.admin[":id"].notes.$patch).toHaveBeenCalledWith({
        param: { id: "inquiry-123" },
        json: { notes: "Called and left voicemail" },
      });
    });

    it("should handle null notes", async () => {
      const mockResponse = { success: true };
      mockClient.inquiries.admin[":id"].notes.$patch.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => inquiriesApi.useUpdateInquiryNotes(), { wrapper });

      result.current.mutate({ id: "inquiry-123", notes: null } as UpdateInquiryNotesParams);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.inquiries.admin[":id"].notes.$patch).toHaveBeenCalledWith({
        param: { id: "inquiry-123" },
        json: { notes: null },
      });
    });
  });

  describe("useDeleteInquiry", () => {
    it("should delete inquiry successfully", async () => {
      const mockResponse = { success: true };
      mockClient.inquiries.admin[":id"].$delete.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => inquiriesApi.useDeleteInquiry(), { wrapper });

      result.current.mutate("inquiry-123" as DeleteInquiryParams);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.inquiries.admin[":id"].$delete).toHaveBeenCalledWith({
        param: { id: "inquiry-123" },
      });
    });

    it("should invalidate admin inquiries cache on success", async () => {
      const queryClient = createQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const mockResponse = { success: true };
      mockClient.inquiries.admin[":id"].$delete.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => inquiriesApi.useDeleteInquiry(), { wrapper: customWrapper });

      result.current.mutate("inquiry-123" as DeleteInquiryParams);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin_inquiries"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin", "action-items"] });
    });

    it("should handle delete errors", async () => {
      const mockError = new Error("Failed to delete inquiry");
      mockClient.inquiries.admin[":id"].$delete.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => inquiriesApi.useDeleteInquiry(), { wrapper });

      result.current.mutate("inquiry-123" as DeleteInquiryParams);

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });
});
