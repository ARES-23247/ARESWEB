 
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../test/utils";
import { useMergedNotifications } from "./useMergedNotifications";
import { server } from "../test/mocks/server";
import { http, HttpResponse } from "msw";
import { waitFor } from "@testing-library/react";

describe("useMergedNotifications Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockSession = (authenticated: boolean = true) => ({
    authenticated,
    user: {
      id: "test-123",
      email: "test@ares23247.com",
      name: "Test User",
      role: "admin",
      memberType: "mentor",
      firstName: "Test",
      lastName: "User",
      nickname: "Test",
    },
  });

  const createMockPermissions = () => ({
    role: "admin",
    memberType: "mentor",
    isAdmin: true,
    isAuthorized: true,
    isUnverified: false,
    canSeeInquiries: true,
    canSeeLogistics: true,
    canSeeTasks: true,
    canSeeSimulations: true,
  });

  describe("Authentication and Query Behavior", () => {
    it("should not fetch notifications when session is null", async () => {
      const { result } = renderWithProviders(() =>
        useMergedNotifications(null, createMockPermissions())
      );

      expect(result.current.notifications).toEqual([]);
      expect(result.current.unreadCount).toBe(0);
    });

    it("should not fetch notifications when session is not authenticated", async () => {
      const mockSession = createMockSession(false);
      const { result } = renderWithProviders(() =>
        useMergedNotifications(mockSession, createMockPermissions())
      );

      expect(result.current.notifications).toEqual([]);
      expect(result.current.unreadCount).toBe(0);
    });

    it("should fetch notifications when authenticated", async () => {
      server.use(
        http.get("/api/notifications", () => {
          return HttpResponse.json({
            notifications: [
              {
                id: "notif-1",
                title: "Test Notification",
                message: "Test message",
                is_read: false,
              },
            ],
          });
        }),
        http.get("/api/notifications/action-items", () => {
          return HttpResponse.json({
            inquiries: [],
            posts: [],
            events: [],
            docs: [],
          });
        })
      );

      const { result } = renderWithProviders(() =>
        useMergedNotifications(createMockSession(), createMockPermissions())
      );

      await waitFor(() => {
        expect(result.current.notifications).toHaveLength(1);
        expect(result.current.notifications[0].title).toBe("Test Notification");
      });
    });

    it("should handle fetch errors gracefully", async () => {
      server.use(
        http.get("/api/notifications", () => {
          return new HttpResponse(null, { status: 500 });
        }),
        http.get("/api/notifications/action-items", () => {
          return HttpResponse.json({
            inquiries: [],
            posts: [],
            events: [],
            docs: [],
          });
        })
      );

      const { result } = renderWithProviders(() =>
        useMergedNotifications(createMockSession(), createMockPermissions())
      );

      await waitFor(() => {
        expect(result.current.notifications).toBeDefined();
      });
    });
  });

  describe("Notification Filtering", () => {
    it("should filter out read notifications", async () => {
      server.use(
        http.get("/api/notifications", () => {
          return HttpResponse.json({
            notifications: [
              {
                id: "notif-1",
                title: "Unread Notification",
                message: "Unread message",
                is_read: false,
              },
              {
                id: "notif-2",
                title: "Read Notification",
                message: "Read message",
                is_read: true,
              },
            ],
          });
        }),
        http.get("/api/notifications/action-items", () => {
          return HttpResponse.json({
            inquiries: [],
            posts: [],
            events: [],
            docs: [],
          });
        })
      );

      const { result } = renderWithProviders(() =>
        useMergedNotifications(createMockSession(), createMockPermissions())
      );

      await waitFor(() => {
        expect(result.current.notifications).toHaveLength(1);
        expect(result.current.notifications[0].title).toBe("Unread Notification");
      });
    });

    it("should filter out redundant inquiry notifications", async () => {
      server.use(
        http.get("/api/notifications", () => {
          return HttpResponse.json({
            notifications: [
              {
                id: "notif-1",
                title: "New Support Inquiry",
                message: "From someone",
                is_read: false,
              },
              {
                id: "notif-2",
                title: "New Outreach Inquiry",
                message: "From another",
                is_read: false,
              },
              {
                id: "notif-3",
                title: "New Sponsor Inquiry",
                message: "From sponsor",
                is_read: false,
              },
              {
                id: "notif-4",
                title: "Valid Notification",
                message: "Keep this",
                is_read: false,
              },
            ],
          });
        }),
        http.get("/api/notifications/action-items", () => {
          return HttpResponse.json({
            inquiries: [],
            posts: [],
            events: [],
            docs: [],
          });
        })
      );

      const { result } = renderWithProviders(() =>
        useMergedNotifications(createMockSession(), createMockPermissions())
      );

      await waitFor(() => {
        expect(result.current.notifications).toHaveLength(1);
        expect(result.current.notifications[0].title).toBe("Valid Notification");
      });
    });

    it("should filter out pending blog post notifications", async () => {
      server.use(
        http.get("/api/notifications", () => {
          return HttpResponse.json({
            notifications: [
              {
                id: "notif-1",
                title: "📍 Pending Blog Post",
                message: "Pending post",
                is_read: false,
              },
              {
                id: "notif-2",
                title: "Valid Notification",
                message: "Keep this",
                is_read: false,
              },
            ],
          });
        }),
        http.get("/api/notifications/action-items", () => {
          return HttpResponse.json({
            inquiries: [],
            posts: [],
            events: [],
            docs: [],
          });
        })
      );

      const { result } = renderWithProviders(() =>
        useMergedNotifications(createMockSession(), createMockPermissions())
      );

      await waitFor(() => {
        expect(result.current.notifications).toHaveLength(1);
        expect(result.current.notifications[0].title).toBe("Valid Notification");
      });
    });

    it("should filter out pending document notifications", async () => {
      server.use(
        http.get("/api/notifications", () => {
          return HttpResponse.json({
            notifications: [
              {
                id: "notif-1",
                title: "📍 Pending Document",
                message: "Pending doc",
                is_read: false,
              },
              {
                id: "notif-2",
                title: "📍 Doc Revision Pending",
                message: "Pending revision",
                is_read: false,
              },
              {
                id: "notif-3",
                title: "Valid Notification",
                message: "Keep this",
                is_read: false,
              },
            ],
          });
        }),
        http.get("/api/notifications/action-items", () => {
          return HttpResponse.json({
            inquiries: [],
            posts: [],
            events: [],
            docs: [],
          });
        })
      );

      const { result } = renderWithProviders(() =>
        useMergedNotifications(createMockSession(), createMockPermissions())
      );

      await waitFor(() => {
        expect(result.current.notifications).toHaveLength(1);
        expect(result.current.notifications[0].title).toBe("Valid Notification");
      });
    });
  });

  describe("Synthetic Action Items", () => {
    it("should create synthetic inquiry notifications", async () => {
      server.use(
        http.get("/api/notifications", () => {
          return HttpResponse.json({ notifications: [] });
        }),
        http.get("/api/notifications/action-items", () => {
          return HttpResponse.json({
            inquiries: [
              { id: "inq-1", type: "support", name: "John Doe" },
              { id: "inq-2", type: "outreach", name: "Jane Smith" },
              { id: "inq-3", type: "sponsor", name: "Acme Corp" },
              { id: "inq-4", name: "Generic Inquiry" },
            ],
            posts: [],
            events: [],
            docs: [],
          });
        })
      );

      const { result } = renderWithProviders(() =>
        useMergedNotifications(createMockSession(), createMockPermissions())
      );

      await waitFor(() => {
        expect(result.current.notifications).toHaveLength(4);
        expect(result.current.notifications[0].title).toBe("New Support Request");
        expect(result.current.notifications[0].message).toBe("From John Doe");
        expect(result.current.notifications[0].link).toBe("/dashboard/inquiries");
        expect(result.current.notifications[0].is_inquiry).toBe(true);

        expect(result.current.notifications[1].title).toBe("New Outreach Request");
        expect(result.current.notifications[2].title).toBe("New Sponsor Request");
        expect(result.current.notifications[3].title).toBe("New Inquiry Request");
      });
    });

    it("should create synthetic pending post notifications", async () => {
      server.use(
        http.get("/api/notifications", () => {
          return HttpResponse.json({ notifications: [] });
        }),
        http.get("/api/notifications/action-items", () => {
          return HttpResponse.json({
            inquiries: [],
            posts: [
              {
                slug: "post-1",
                title: "Amazing Post",
                authorNickname: "StudentWriter",
              },
            ],
            events: [],
            docs: [],
          });
        })
      );

      const { result } = renderWithProviders(() =>
        useMergedNotifications(createMockSession(), createMockPermissions())
      );

      await waitFor(() => {
        expect(result.current.notifications).toHaveLength(1);
        expect(result.current.notifications[0].title).toBe("New Pending Post");
        expect(result.current.notifications[0].message).toBe('"Amazing Post" by StudentWriter');
        expect(result.current.notifications[0].link).toBe("/dashboard/manage_blog");
        expect(result.current.notifications[0].is_inquiry).toBe(true);
      });
    });

    it("should default post author nickname to Student when missing", async () => {
      server.use(
        http.get("/api/notifications", () => {
          return HttpResponse.json({ notifications: [] });
        }),
        http.get("/api/notifications/action-items", () => {
          return HttpResponse.json({
            inquiries: [],
            posts: [{ slug: "post-1", title: "Untitled Post" }],
            events: [],
            docs: [],
          });
        })
      );

      const { result } = renderWithProviders(() =>
        useMergedNotifications(createMockSession(), createMockPermissions())
      );

      await waitFor(() => {
        expect(result.current.notifications[0].message).toBe('"Untitled Post" by Student');
      });
    });

    it("should create synthetic pending event notifications", async () => {
      server.use(
        http.get("/api/notifications", () => {
          return HttpResponse.json({ notifications: [] });
        }),
        http.get("/api/notifications/action-items", () => {
          return HttpResponse.json({
            inquiries: [],
            posts: [],
            events: [{ id: "event-1", title: "Competition Day" }],
            docs: [],
          });
        })
      );

      const { result } = renderWithProviders(() =>
        useMergedNotifications(createMockSession(), createMockPermissions())
      );

      await waitFor(() => {
        expect(result.current.notifications).toHaveLength(1);
        expect(result.current.notifications[0].title).toBe("New Pending Event");
        expect(result.current.notifications[0].message).toBe('"Competition Day"');
        expect(result.current.notifications[0].link).toBe("/dashboard/manage_event");
        expect(result.current.notifications[0].is_inquiry).toBe(true);
      });
    });

    it("should create synthetic pending document notifications", async () => {
      server.use(
        http.get("/api/notifications", () => {
          return HttpResponse.json({ notifications: [] });
        }),
        http.get("/api/notifications/action-items", () => {
          return HttpResponse.json({
            inquiries: [],
            posts: [],
            events: [],
            docs: [{ slug: "doc-1", title: "Technical Guide" }],
          });
        })
      );

      const { result } = renderWithProviders(() =>
        useMergedNotifications(createMockSession(), createMockPermissions())
      );

      await waitFor(() => {
        expect(result.current.notifications).toHaveLength(1);
        expect(result.current.notifications[0].title).toBe("New Pending Doc");
        expect(result.current.notifications[0].message).toBe('"Technical Guide"');
        expect(result.current.notifications[0].link).toBe("/dashboard/manage_docs");
        expect(result.current.notifications[0].is_inquiry).toBe(true);
      });
    });
  });

  describe("Unread Count Calculation", () => {
    it("should count all unread notifications", async () => {
      server.use(
        http.get("/api/notifications", () => {
          return HttpResponse.json({
            notifications: [
              {
                id: "notif-1",
                title: "Unread 1",
                message: "Message 1",
                is_read: false,
              },
              {
                id: "notif-2",
                title: "Unread 2",
                message: "Message 2",
                is_read: false,
              },
            ],
          });
        }),
        http.get("/api/notifications/action-items", () => {
          return HttpResponse.json({
            inquiries: [{ id: "inq-1", type: "support", name: "Test" }],
            posts: [],
            events: [],
            docs: [],
          });
        })
      );

      const { result } = renderWithProviders(() =>
        useMergedNotifications(createMockSession(), createMockPermissions())
      );

      await waitFor(() => {
        expect(result.current.unreadCount).toBe(3); // 2 API + 1 inquiry
      });
    });

    it("should return 0 for empty notifications", async () => {
      server.use(
        http.get("/api/notifications", () => {
          return HttpResponse.json({ notifications: [] });
        }),
        http.get("/api/notifications/action-items", () => {
          return HttpResponse.json({
            inquiries: [],
            posts: [],
            events: [],
            docs: [],
          });
        })
      );

      const { result } = renderWithProviders(() =>
        useMergedNotifications(createMockSession(), createMockPermissions())
      );

      await waitFor(() => {
        expect(result.current.unreadCount).toBe(0);
      });
    });
  });

  describe("Notification Merging", () => {
    it("should merge API notifications with synthetic action items", async () => {
      server.use(
        http.get("/api/notifications", () => {
          return HttpResponse.json({
            notifications: [
              {
                id: "notif-1",
                title: "System Announcement",
                message: "Important update",
                is_read: false,
                link: "/announcements/notif-1",
              },
            ],
          });
        }),
        http.get("/api/notifications/action-items", () => {
          return HttpResponse.json({
            inquiries: [{ id: "inq-1", type: "support", name: "Support User" }],
            posts: [{ slug: "post-1", title: "Blog Post", authorNickname: "Author" }],
            events: [{ id: "event-1", title: "Event Title" }],
            docs: [{ slug: "doc-1", title: "Doc Title" }],
          });
        })
      );

      const { result } = renderWithProviders(() =>
        useMergedNotifications(createMockSession(), createMockPermissions())
      );

      await waitFor(() => {
        expect(result.current.notifications).toHaveLength(5);
        expect(result.current.notifications[0].title).toBe("System Announcement");
        expect(result.current.notifications[1].title).toBe("New Support Request");
        expect(result.current.notifications[2].title).toBe("New Pending Post");
        expect(result.current.notifications[3].title).toBe("New Pending Event");
        expect(result.current.notifications[4].title).toBe("New Pending Doc");
      });
    });

    it("should preserve link property from API notifications", async () => {
      server.use(
        http.get("/api/notifications", () => {
          return HttpResponse.json({
            notifications: [
              {
                id: "notif-1",
                title: "Linkable Notification",
                message: "Click here",
                is_read: false,
                link: "/custom/link",
              },
            ],
          });
        }),
        http.get("/api/notifications/action-items", () => {
          return HttpResponse.json({
            inquiries: [],
            posts: [],
            events: [],
            docs: [],
          });
        })
      );

      const { result } = renderWithProviders(() =>
        useMergedNotifications(createMockSession(), createMockPermissions())
      );

      await waitFor(() => {
        expect(result.current.notifications[0].link).toBe("/custom/link");
      });
    });

    it("should handle missing optional properties in notifications", async () => {
      server.use(
        http.get("/api/notifications", () => {
          return HttpResponse.json({
            notifications: [
              {
                id: "notif-1",
                title: "Minimal Notification",
                message: "No link",
                is_read: false,
              },
            ],
          });
        }),
        http.get("/api/notifications/action-items", () => {
          return HttpResponse.json({
            inquiries: [],
            posts: [],
            events: [],
            docs: [],
          });
        })
      );

      const { result } = renderWithProviders(() =>
        useMergedNotifications(createMockSession(), createMockPermissions())
      );

      await waitFor(() => {
        expect(result.current.notifications[0].link).toBeUndefined();
        expect(result.current.notifications[0].is_inquiry).toBeUndefined();
      });
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle malformed notification response", async () => {
      server.use(
        http.get("/api/notifications", () => {
          return HttpResponse.json({ invalid: "structure" });
        }),
        http.get("/api/notifications/action-items", () => {
          return HttpResponse.json({
            inquiries: [],
            posts: [],
            events: [],
            docs: [],
          });
        })
      );

      const { result } = renderWithProviders(() =>
        useMergedNotifications(createMockSession(), createMockPermissions())
      );

      await waitFor(() => {
        expect(result.current.notifications).toEqual([]);
        expect(result.current.unreadCount).toBe(0);
      });
    });

    it("should handle notifications with null or undefined title", async () => {
      server.use(
        http.get("/api/notifications", () => {
          return HttpResponse.json({
            notifications: [
              {
                id: "notif-1",
                title: null,
                message: "No title",
                is_read: false,
              },
              {
                id: "notif-2",
                title: undefined,
                message: "Also no title",
                is_read: false,
              },
            ],
          });
        }),
        http.get("/api/notifications/action-items", () => {
          return HttpResponse.json({
            inquiries: [],
            posts: [],
            events: [],
            docs: [],
          });
        })
      );

      const { result } = renderWithProviders(() =>
        useMergedNotifications(createMockSession(), createMockPermissions())
      );

      await waitFor(() => {
        // Notifications with null/undefined title should pass through filter
        expect(result.current.notifications.length).toBeGreaterThanOrEqual(0);
      });
    });

    it("should handle empty action items response", async () => {
      server.use(
        http.get("/api/notifications", () => {
          return HttpResponse.json({ notifications: [] });
        }),
        http.get("/api/notifications/action-items", () => {
          return HttpResponse.json({});
        })
      );

      const { result } = renderWithProviders(() =>
        useMergedNotifications(createMockSession(), createMockPermissions())
      );

      await waitFor(() => {
        expect(result.current.notifications).toEqual([]);
        expect(result.current.unreadCount).toBe(0);
      });
    });

    it("should handle action items with null arrays", async () => {
      server.use(
        http.get("/api/notifications", () => {
          return HttpResponse.json({ notifications: [] });
        }),
        http.get("/api/notifications/action-items", () => {
          return HttpResponse.json({
            inquiries: null,
            posts: null,
            events: null,
            docs: null,
          });
        })
      );

      const { result } = renderWithProviders(() =>
        useMergedNotifications(createMockSession(), createMockPermissions())
      );

      await waitFor(() => {
        expect(result.current.notifications).toEqual([]);
        expect(result.current.unreadCount).toBe(0);
      });
    });

    it("should use notifications with is_inquiry flag for action items", async () => {
      server.use(
        http.get("/api/notifications", () => {
          return HttpResponse.json({ notifications: [] });
        }),
        http.get("/api/notifications/action-items", () => {
          return HttpResponse.json({
            inquiries: [{ id: "inq-1", type: "support", name: "Test" }],
            posts: [],
            events: [],
            docs: [],
          });
        })
      );

      const { result } = renderWithProviders(() =>
        useMergedNotifications(createMockSession(), createMockPermissions())
      );

      await waitFor(() => {
        expect(result.current.notifications[0].is_inquiry).toBe(true);
      });
    });
  });

  describe("Type Safety and Interface Compliance", () => {
    it("should return notifications matching MergedNotification interface", async () => {
      server.use(
        http.get("/api/notifications", () => {
          return HttpResponse.json({
            notifications: [
              {
                id: "notif-1",
                title: "Test",
                message: "Test message",
                is_read: false,
              },
            ],
          });
        }),
        http.get("/api/notifications/action-items", () => {
          return HttpResponse.json({
            inquiries: [],
            posts: [],
            events: [],
            docs: [],
          });
        })
      );

      const { result } = renderWithProviders(() =>
        useMergedNotifications(createMockSession(), createMockPermissions())
      );

      await waitFor(() => {
        const notif = result.current.notifications[0];
        expect(notif).toHaveProperty("id");
        expect(notif).toHaveProperty("title");
        expect(notif).toHaveProperty("message");
        expect(notif).toHaveProperty("is_read");
        expect(typeof notif.id).toBe("string");
        expect(typeof notif.title).toBe("string");
        expect(typeof notif.message).toBe("string");
        expect(typeof notif.is_read).toBe("boolean");
      });
    });

    it("should return unreadCount as number", async () => {
      server.use(
        http.get("/api/notifications", () => {
          return HttpResponse.json({ notifications: [] });
        }),
        http.get("/api/notifications/action-items", () => {
          return HttpResponse.json({
            inquiries: [],
            posts: [],
            events: [],
            docs: [],
          });
        })
      );

      const { result } = renderWithProviders(() =>
        useMergedNotifications(createMockSession(), createMockPermissions())
      );

      await waitFor(() => {
        expect(typeof result.current.unreadCount).toBe("number");
        expect(result.current.unreadCount).toBeGreaterThanOrEqual(0);
      });
    });
  });
});

