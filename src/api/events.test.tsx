import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as honoClient from "./honoClient";
import * as eventsApi from "./events";

// Mock the honoClient module
vi.mock("./honoClient", () => ({
  client: {
    events: {
      $get: vi.fn(),
      ":id": {
        $get: vi.fn(),
        signups: {
          $get: vi.fn(),
          $post: vi.fn(),
          $delete: vi.fn(),
          me: {
            attendance: {
              $patch: vi.fn(),
            },
          },
        },
      },
      "calendar-settings": {
        $get: vi.fn(),
      },
      admin: {
        list: {
          $get: vi.fn(),
        },
        ":id": {
          $get: vi.fn(),
          $patch: vi.fn(),
          $delete: vi.fn(),
          approve: {
            $post: vi.fn(),
          },
          reject: {
            $post: vi.fn(),
          },
          restore: {
            $post: vi.fn(),
          },
          purge: {
            $delete: vi.fn(),
          },
          repush: {
            $post: vi.fn(),
          },
          signups: {
            ":userId": {
              attendance: {
                $patch: vi.fn(),
              },
            },
          },
        },
        save: {
          $post: vi.fn(),
        },
        sync: {
          $post: vi.fn(),
        },
        "repair-calendar": {
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

describe("Events API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useGetEvents", () => {
    it("should fetch public events successfully", async () => {
      const mockEvents = [
        { id: "1", title: "Event 1", start_date: "2024-01-01" },
        { id: "2", title: "Event 2", start_date: "2024-01-02" },
      ];
      const mockResponse = { events: mockEvents };
      mockClient.events.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => eventsApi.useGetEvents(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
    });

    it("should pass query parameters", async () => {
      const mockResponse = { events: [] };
      mockClient.events.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => eventsApi.useGetEvents({ q: "test", limit: 10 }), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.events.$get).toHaveBeenCalledWith({ query: { q: "test", limit: 10 } });
    });
  });

  describe("useGetEvent", () => {
    it("should fetch single event successfully", async () => {
      const mockEvent = { id: "123", title: "Test Event", start_date: "2024-01-01" };
      const mockResponse = { event: mockEvent };
      mockClient.events[":id"].$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => eventsApi.useGetEvent("123"), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockClient.events[":id"].$get).toHaveBeenCalledWith({ param: { id: "123" } });
    });

    it("should be disabled when id is empty", async () => {
      const { result } = renderHook(() => eventsApi.useGetEvent(""), { wrapper });
      expect(result.current.fetchStatus).toBe("idle");
    });
  });

  describe("useGetCalendarSettings", () => {
    it("should fetch calendar settings successfully", async () => {
      const mockSettings = {
        calendarIdInternal: "internal@test.com",
        calendarIdOutreach: "outreach@test.com",
        calendarIdExternal: "external@test.com",
      };
      mockClient.events["calendar-settings"].$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockSettings);

      const { result } = renderHook(() => eventsApi.useGetCalendarSettings(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockSettings);
    });
  });

  describe("useGetEventSignups", () => {
    it("should fetch event signups successfully", async () => {
      const mockSignups = [
        { id: "1", user_id: "user1", notes: "Test notes" },
        { id: "2", user_id: "user2", notes: "" },
      ];
      const mockResponse = {
        signups: mockSignups,
        dietary_summary: { "Vegetarian": 2 },
        authenticated: true,
        role: "admin",
        member_type: "student",
        can_manage: true,
      };
      mockClient.events[":id"].signups.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => eventsApi.useGetEventSignups("123"), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
    });
  });

  describe("useSubmitEventSignup", () => {
    it("should submit event signup successfully", async () => {
      const mockResponse = { success: true };
      mockClient.events[":id"].signups.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => eventsApi.useSubmitEventSignup(), { wrapper });

      result.current.mutate({
        eventId: "123",
        body: { bringing: "Chips", notes: "No nuts", prep_hours: 1 },
      } as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.events[":id"].signups.$post).toHaveBeenCalledWith({
        param: { id: "123" },
        json: { bringing: "Chips", notes: "No nuts", prep_hours: 1 },
      });
    });

    it("should handle signup errors", async () => {
      const mockError = new Error("Signup failed");
      mockClient.events[":id"].signups.$post.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => eventsApi.useSubmitEventSignup(), { wrapper });

      result.current.mutate({ eventId: "123", body: {} } as any);

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useDeleteMyEventSignup", () => {
    it("should delete my signup successfully", async () => {
      const mockResponse = { success: true };
      mockClient.events[":id"].signups.$delete.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => eventsApi.useDeleteMyEventSignup(), { wrapper });

      result.current.mutate("123" as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.events[":id"].signups.$delete).toHaveBeenCalledWith({
        param: { id: "123" },
      });
    });
  });

  describe("useUpdateMyEventAttendance", () => {
    it("should update my attendance successfully", async () => {
      const mockResponse = { success: true };
      mockClient.events[":id"].signups.me.attendance.$patch.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => eventsApi.useUpdateMyEventAttendance(), { wrapper });

      result.current.mutate({ eventId: "123", attended: true } as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.events[":id"].signups.me.attendance.$patch).toHaveBeenCalledWith({
        param: { id: "123" },
        json: { attended: true },
      });
    });
  });

  describe("useGetAdminEvents", () => {
    it("should fetch admin events successfully", async () => {
      const mockEvents = [{ id: "1", title: "Admin Event" }];
      const mockResponse = {
        events: mockEvents,
        lastSyncedAt: "2024-01-01T00:00:00Z",
        nextCursor: "cursor123",
      };
      mockClient.events.admin.list.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => eventsApi.useGetAdminEvents(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
    });
  });

  describe("useSaveEvent", () => {
    it("should save event successfully", async () => {
      const mockResponse = { success: true, id: "new-event-123", warning: "" };
      const eventData = {
        title: "New Event",
        start_date: "2024-01-01",
        end_date: "2024-01-02",
      } as never;
      mockClient.events.admin.save.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => eventsApi.useSaveEvent(), { wrapper });

      result.current.mutate(eventData as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.events.admin.save.$post).toHaveBeenCalledWith({
        json: eventData,
      });
    });

    it("should handle save with warning", async () => {
      const mockResponse = { success: true, id: "123", warning: "Event already exists" };
      mockClient.events.admin.save.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => eventsApi.useSaveEvent(), { wrapper });

      result.current.mutate({ title: "Test" } as never as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.warning).toBe("Event already exists");
    });
  });

  describe("useUpdateEvent", () => {
    it("should update event successfully", async () => {
      const mockResponse = { success: true, id: "123" };
      mockClient.events.admin[":id"].$patch.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => eventsApi.useUpdateEvent(), { wrapper });

      result.current.mutate({ id: "123", body: { title: "Updated Title" } } as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.events.admin[":id"].$patch).toHaveBeenCalledWith({
        param: { id: "123" },
        json: { title: "Updated Title" },
      });
    });
  });

  describe("useDeleteEvent", () => {
    it("should delete event successfully", async () => {
      const mockResponse = { success: true };
      mockClient.events.admin[":id"].$delete.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => eventsApi.useDeleteEvent(), { wrapper });

      result.current.mutate({ id: "123" } as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.events.admin[":id"].$delete).toHaveBeenCalledWith({
        param: { id: "123" },
        json: {},
      });
    });

    it("should support following delete mode", async () => {
      const mockResponse = { success: true };
      mockClient.events.admin[":id"].$delete.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => eventsApi.useDeleteEvent(), { wrapper });

      result.current.mutate({ id: "123", deleteMode: "following" } as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.events.admin[":id"].$delete).toHaveBeenCalledWith({
        param: { id: "123" },
        json: { deleteMode: "following" },
      });
    });
  });

  describe("useSyncEvents", () => {
    it("should sync events successfully", async () => {
      const mockResponse = { success: true, count: 5 };
      mockClient.events.admin.sync.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => eventsApi.useSyncEvents(), { wrapper });

      result.current.mutate();

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.events.admin.sync.$post).toHaveBeenCalledWith();
    });
  });

  describe("useApproveEvent", () => {
    it("should approve event successfully", async () => {
      const mockResponse = { success: true };
      mockClient.events.admin[":id"].approve.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => eventsApi.useApproveEvent(), { wrapper });

      result.current.mutate("123" as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.events.admin[":id"].approve.$post).toHaveBeenCalledWith({
        param: { id: "123" },
      });
    });
  });

  describe("useRejectEvent", () => {
    it("should reject event successfully", async () => {
      const mockResponse = { success: true };
      mockClient.events.admin[":id"].reject.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => eventsApi.useRejectEvent(), { wrapper });

      result.current.mutate({ id: "123", reason: "Duplicate event" } as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.events.admin[":id"].reject.$post).toHaveBeenCalledWith({
        param: { id: "123" },
        json: { reason: "Duplicate event" },
      });
    });
  });

  describe("useUpdateUserEventAttendance", () => {
    it("should update user attendance successfully", async () => {
      const mockResponse = { success: true };
      mockClient.events.admin[":id"].signups[":userId"].attendance.$patch.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => eventsApi.useUpdateUserEventAttendance(), { wrapper });

      result.current.mutate({ eventId: "123", userId: "user456", attended: true } as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.events.admin[":id"].signups[":userId"].attendance.$patch).toHaveBeenCalledWith({
        param: { id: "123", userId: "user456" },
        json: { attended: true },
      });
    });
  });
});
