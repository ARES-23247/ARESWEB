/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import notificationsRouter from "./notifications";

// Minimal execution context mock for Hono tests
const mockExecutionContext = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
};

describe("Notifications Router", () => {
  let mockDb: any;
  let env: any;

  beforeEach(() => {
    mockDb = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      all: vi.fn(),
      run: vi.fn(),
      first: vi.fn(),
    };
    env = {
      DB: mockDb,
      DEV_BYPASS: "true", // Bypasses ensureAuth and provides a dummy user
    };
    vi.clearAllMocks();
  });

  describe("GET /", () => {
    it("should return user notifications", async () => {
      const mockNotifications = [
        { id: "1", title: "Test", message: "Hello", link: "/", priority: "high", is_read: 0, created_at: "2026-01-01" },
      ];
      mockDb.all.mockResolvedValue({ results: mockNotifications });

      const req = new Request("http://localhost/");
      const res = await notificationsRouter.request(req, {}, env, mockExecutionContext);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.notifications.length).toBe(1);
      expect(body.notifications[0].title).toBe("Test");
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining("SELECT id, title, message, link, priority, is_read, created_at FROM notifications"));
    });

    it("should return 500 on database error", async () => {
      mockDb.all.mockRejectedValue(new Error("DB Error"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const req = new Request("http://localhost/");
      const res = await notificationsRouter.request(req, {}, env, mockExecutionContext);

      expect(res.status).toBe(500);
      const body = await res.json() as any;
      expect(body.notifications.length).toBe(0);

      consoleSpy.mockRestore();
    });
  });

  describe("PUT /:id/read", () => {
    it("should mark a single notification as read", async () => {
      mockDb.run.mockResolvedValue({ success: true });

      const req = new Request("http://localhost/123/read", { method: "PUT" });
      const res = await notificationsRouter.request(req, {}, env, mockExecutionContext);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining("UPDATE notifications SET is_read = 1 WHERE id = ?"));
    });

    it("should return 500 on database error", async () => {
      mockDb.run.mockRejectedValue(new Error("DB Error"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const req = new Request("http://localhost/123/read", { method: "PUT" });
      const res = await notificationsRouter.request(req, {}, env, mockExecutionContext);

      expect(res.status).toBe(500);
      const body = await res.json() as any;
      expect(body.error).toBe("Update failed");

      consoleSpy.mockRestore();
    });
  });

  describe("PUT /read-all", () => {
    it("should mark all notifications as read", async () => {
      mockDb.run.mockResolvedValue({ success: true });

      const req = new Request("http://localhost/read-all", { method: "PUT" });
      const res = await notificationsRouter.request(req, {}, env, mockExecutionContext);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining("UPDATE notifications SET is_read = 1 WHERE user_id = ?"));
    });

    it("should return 500 on database error", async () => {
      mockDb.run.mockRejectedValue(new Error("DB Error"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const req = new Request("http://localhost/read-all", { method: "PUT" });
      const res = await notificationsRouter.request(req, {}, env, mockExecutionContext);

      expect(res.status).toBe(500);
      const body = await res.json() as any;
      expect(body.error).toBe("Update failed");

      consoleSpy.mockRestore();
    });
  });
});
