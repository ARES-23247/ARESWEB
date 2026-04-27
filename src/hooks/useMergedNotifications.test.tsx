/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMergedNotifications } from "./useMergedNotifications";
import { useDashboardNotifications } from "./useDashboardNotifications";
import { api } from "../api/client";

// Mock the API client
vi.mock("../api/client", () => ({
  api: {
    notifications: {
      getNotifications: {
        useQuery: vi.fn(),
      },
    },
  },
}));

// Mock useDashboardNotifications
vi.mock("./useDashboardNotifications", () => ({
  useDashboardNotifications: vi.fn(),
}));

describe("useMergedNotifications hook", () => {
  const mockSession = { authenticated: true, user: { id: "1" } } as any;
  const mockPermissions = { isSuperAdmin: true } as any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock returns
    (api.notifications.getNotifications.useQuery as any).mockReturnValue({
      data: { body: { notifications: [] } },
    });

    (useDashboardNotifications as any).mockReturnValue({
      pendingInquiries: [],
      pendingPosts: [],
      pendingEvents: [],
      pendingDocs: [],
    });
  });

  it("should initialize with empty notifications when no data is provided", () => {
    const { result } = renderHook(() => useMergedNotifications(mockSession, mockPermissions));

    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });

  it("should return unread count correctly for raw API notifications", () => {
    (api.notifications.getNotifications.useQuery as any).mockReturnValue({
      data: {
        body: {
          notifications: [
            { id: "1", title: "Test 1", message: "Msg 1", is_read: false },
            { id: "2", title: "Test 2", message: "Msg 2", is_read: true },
          ],
        },
      },
    });

    const { result } = renderHook(() => useMergedNotifications(mockSession, mockPermissions));

    expect(result.current.notifications).toHaveLength(2);
    expect(result.current.unreadCount).toBe(1); // Only 1 is unread
  });

  it("should filter out redundant DB notifications", () => {
    (api.notifications.getNotifications.useQuery as any).mockReturnValue({
      data: {
        body: {
          notifications: [
            { id: "1", title: "New Inquiry: Support", message: "Msg", is_read: false },
            { id: "2", title: "📝 Pending Blog Post", message: "Msg", is_read: false },
            { id: "3", title: "📝 Pending Document", message: "Msg", is_read: false },
            { id: "4", title: "📝 Doc Revision Pending", message: "Msg", is_read: false },
            { id: "5", title: "Valid Notification", message: "Msg", is_read: false },
          ],
        },
      },
    });

    const { result } = renderHook(() => useMergedNotifications(mockSession, mockPermissions));

    // Only 'Valid Notification' should pass the filter
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].title).toBe("Valid Notification");
  });

  it("should merge pending items into synthetic notifications", () => {
    (useDashboardNotifications as any).mockReturnValue({
      pendingInquiries: [{ id: "10", type: "support", name: "John" }],
      pendingPosts: [{ slug: "post-1", title: "My Post", author_nickname: "Alice" }],
      pendingEvents: [{ id: "20", title: "Cool Event" }],
      pendingDocs: [{ slug: "doc-1", title: "My Doc" }],
    });

    const { result } = renderHook(() => useMergedNotifications(mockSession, mockPermissions));

    const notifs = result.current.notifications;
    expect(notifs).toHaveLength(4);

    expect(notifs[0]).toMatchObject({
      id: "inquiry-10",
      title: "New Support Request",
      message: "From John",
      is_inquiry: true,
    });

    expect(notifs[1]).toMatchObject({
      id: "post-post-1",
      title: "New Pending Post",
      message: '"My Post" by Alice',
      is_inquiry: true,
    });

    expect(notifs[2]).toMatchObject({
      id: "event-20",
      title: "New Pending Event",
      message: '"Cool Event"',
      is_inquiry: true,
    });

    expect(notifs[3]).toMatchObject({
      id: "doc-doc-1",
      title: "New Pending Doc",
      message: '"My Doc"',
      is_inquiry: true,
    });

    // All synthetic notifications are unread by default
    expect(result.current.unreadCount).toBe(4);
  });
  
  it("should disable query if not signed in", () => {
    renderHook(() => useMergedNotifications(null, mockPermissions));
    
    // Check if useQuery was called with enabled: false
    expect(api.notifications.getNotifications.useQuery).toHaveBeenCalledWith(
      ["notifications"],
      {},
      expect.objectContaining({ enabled: false })
    );
  });
});



