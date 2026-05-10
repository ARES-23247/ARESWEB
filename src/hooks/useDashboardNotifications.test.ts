/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../test/utils";
import { useDashboardNotifications } from "./useDashboardNotifications";
import { server } from "../test/mocks/server";
import { http, HttpResponse } from "msw";
import { waitFor } from "@testing-library/react";

describe("useDashboardNotifications Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch pending counts on mount when authorized", async () => {
    const mockSession: any = { 
      authenticated: true,
      user: { role: "admin", memberType: "mentor" }
    };
    const mockPermissions: any = { 
      isAuthorized: true, 
      canSeeInquiries: true 
    };

    server.use(
      http.get(/\/api\/notifications\/action-items/, () => {
        return HttpResponse.json({ 
          inquiries: [{ status: "pending" }],
          posts: [{ status: "pending", title: "dummy", slug: "dummy", date: null, snippet: null, thumbnail: null, author: null, publishedAt: null, seasonId: null, isDeleted: 0 }],
          events: [{ status: "pending", id: "dummy", title: "dummy", dateStart: "dummy", dateEnd: null, location: null, description: null, coverImage: null, category: "dummy", seasonId: null, isDeleted: 0 }],
          docs: [{ status: "pending", id: 1, title: "dummy", slug: "dummy", content: "dummy", ast: "dummy", createdAt: "dummy", isDeleted: 0 }]
        });
      })
    );

    const { result } = renderWithProviders(() => useDashboardNotifications(mockSession, mockPermissions));
    
    await waitFor(() => {
      expect(result.current.pendingInquiriesCount).toBe(1);
      expect(result.current.pendingPostsCount).toBe(1);
    });
  });

  it("should allow manager to see inquiries", async () => {
    const mockSession: any = { 
      authenticated: true,
      user: { role: "manager", memberType: "mentor" }
    };
    const mockPermissions: any = { 
      isAuthorized: true, 
      canSeeInquiries: true 
    };

    server.use(
      http.get(/\/api\/notifications\/action-items/, () => {
        return HttpResponse.json({ 
          inquiries: [{ status: "pending" }],
          posts: [],
          events: [],
          docs: []
        });
      })
    );

    const { result } = renderWithProviders(() => useDashboardNotifications(mockSession, mockPermissions));
    
    await waitFor(() => {
      expect(result.current.pendingInquiriesCount).toBe(1);
    });
  });

  it("should not fetch when not authorized", async () => {
    const mockSession: any = { 
      authenticated: true,
      user: { role: "unverified", memberType: "student" }
    };
    const mockPermissions: any = { 
      isAuthorized: false, 
      canSeeInquiries: false 
    };

    const { result } = renderWithProviders(() => useDashboardNotifications(mockSession, mockPermissions));
    
    // Values should remain at 0
    expect(result.current.pendingInquiriesCount).toBe(0);
    expect(result.current.pendingPostsCount).toBe(0);
  });

  it("should handle null results from endpoints", async () => {
    const mockSession: any = { 
      authenticated: true,
      user: { role: "admin" }
    };
    const mockPermissions: any = { isAuthorized: true, canSeeInquiries: true };

    server.use(
      http.get(/\/api\/notifications\/action-items/, () => {
        return HttpResponse.json({ 
          inquiries: [],
          posts: [],
          events: [],
          docs: null 
        });
      })
    );

    const { result } = renderWithProviders(() => useDashboardNotifications(mockSession, mockPermissions));
    
    await waitFor(() => {
      expect(result.current.pendingDocsCount).toBe(0);
    });
  });

  it("should cover arrow functions in filters", async () => {
    const mockSession: any = { authenticated: true, user: { role: "admin" } };
    const mockPermissions: any = { isAuthorized: true, canSeeInquiries: true };

    server.use(
      http.get(/\/api\/notifications\/action-items/, () => HttpResponse.json({ 
        inquiries: [{ status: "pending" }],
        posts: [{ status: "pending", title: "dummy", slug: "dummy", date: null, snippet: null, thumbnail: null, author: null, publishedAt: null, seasonId: null, isDeleted: 0 }],
        events: [{ status: "pending", id: "dummy", title: "dummy", dateStart: "dummy", dateEnd: null, location: null, description: null, coverImage: null, category: "dummy", seasonId: null, isDeleted: 0 }],
        docs: [{ status: "pending", id: 1, title: "dummy", slug: "dummy", content: "dummy", ast: "dummy", createdAt: "dummy", isDeleted: 0 }]
      }))
    );

    const { result } = renderWithProviders(() => useDashboardNotifications(mockSession, mockPermissions));
    
    await waitFor(() => {
      expect(result.current.pendingInquiriesCount).toBe(1);
      expect(result.current.pendingPostsCount).toBe(1);
      expect(result.current.pendingEventsCount).toBe(1);
      expect(result.current.pendingDocsCount).toBe(1);
    });
  });

  it("should handle null results from all endpoints", async () => {
    const mockSession: any = { authenticated: true, user: { role: "admin" } };
    const mockPermissions: any = { isAuthorized: true, canSeeInquiries: true };

    server.use(
      http.get(/\/api\/notifications\/action-items/, () => HttpResponse.json({ 
        inquiries: null,
        posts: null,
        events: null,
        docs: null
      }))
    );

    const { result } = renderWithProviders(() => useDashboardNotifications(mockSession, mockPermissions));
    
    await waitFor(() => {
      expect(result.current.pendingInquiriesCount).toBe(0);
      expect(result.current.pendingPostsCount).toBe(0);
      expect(result.current.pendingEventsCount).toBe(0);
      expect(result.current.pendingDocsCount).toBe(0);
    });
  });

  it("should handle non-200 responses (e.g. 500 server error) gracefully", async () => {
    const mockSession: any = { authenticated: true, user: { role: "admin" } };
    const mockPermissions: any = { isAuthorized: true, canSeeInquiries: true };

    server.use(
      http.get(/\/api\/notifications\/action-items/, () => HttpResponse.json({ error: "Internal Server Error" }, { status: 500 }))
    );

    const { result } = renderWithProviders(() => useDashboardNotifications(mockSession, mockPermissions));
    
    await waitFor(() => {
      expect(result.current.pendingInquiriesCount).toBe(0);
      expect(result.current.pendingPostsCount).toBe(0);
      expect(result.current.pendingEventsCount).toBe(0);
      expect(result.current.pendingDocsCount).toBe(0);
    });
  });
});

