import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockExecutionContext } from "@/test/utils";
import settingsRouter from "./settings";

describe("Settings Router", () => {
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
      DEV_BYPASS: "true",
    };
    vi.clearAllMocks();
  });

  describe("GET /", () => {
    it("should return masked settings for admins", async () => {
      const mockSettings = [
        { key: "site_name", value: "ARES" },
        { key: "BETTER_AUTH_SECRET", value: "super-secret-key-1234" },
      ];
      mockDb.all.mockResolvedValue({ results: mockSettings });

      const req = new Request("http://localhost/");
      const res = await settingsRouter.request(req, {}, env, mockExecutionContext);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.settings.site_name).toBe("ARES");
      expect(body.settings.BETTER_AUTH_SECRET).toBe("••••••••1234");
    });

    it("should return 500 on database error", async () => {
      mockDb.all.mockRejectedValue(new Error("DB Error"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const req = new Request("http://localhost/");
      const res = await settingsRouter.request(req, {}, env, mockExecutionContext);

      expect(res.status).toBe(500);
      const body = await res.json() as any;
      expect(body.success).toBe(false);
      
      consoleSpy.mockRestore();
    });
  });

  describe("POST /", () => {
    it("should upsert settings and log audit action", async () => {
      mockDb.run.mockResolvedValue({ success: true });
      // For logAuditAction
      mockDb.first.mockResolvedValue({ member_type: "mentor" });

      const req = new Request("http://localhost/", {
        method: "POST",
        body: JSON.stringify({ site_name: "New Name", GITHUB_PAT: "ghp_123456" }),
        headers: { "Content-Type": "application/json" },
      });
      const res = await settingsRouter.request(req, {}, env, mockExecutionContext);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.updated).toBe(2);
      
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO settings"));
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO audit_log"));
    });

    it("should return 400 if value is too long", async () => {
      const longValue = "a".repeat(10001);
      const req = new Request("http://localhost/", {
        method: "POST",
        body: JSON.stringify({ too_long: longValue }),
        headers: { "Content-Type": "application/json" },
      });
      const res = await settingsRouter.request(req, {}, env, mockExecutionContext);

      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toContain("exceeds maximum length");
    });

    it("should return 500 if save fails", async () => {
      mockDb.run.mockRejectedValue(new Error("Write Error"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const req = new Request("http://localhost/", {
        method: "POST",
        body: JSON.stringify({ key: "value" }),
        headers: { "Content-Type": "application/json" },
      });
      const res = await settingsRouter.request(req, {}, env, mockExecutionContext);

      expect(res.status).toBe(500);
      const body = await res.json() as any;
      expect(body.error).toBe("Settings save failed");

      consoleSpy.mockRestore();
    });

    it("should return 500 on invalid JSON", async () => {
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        const req = new Request("http://localhost/", {
          method: "POST",
          body: "not-json",
          headers: { "Content-Type": "application/json" },
        });
        const res = await settingsRouter.request(req, {}, env, mockExecutionContext);
  
        expect(res.status).toBe(500);
        consoleSpy.mockRestore();
      });
  });

  describe("GET /admin/backup", () => {
    it("should export database tables as JSON", async () => {
      mockDb.all.mockResolvedValue({ results: [{ id: 1, data: "test" }] });
      // For logAuditAction
      mockDb.first.mockResolvedValue({ member_type: "mentor" });

      const req = new Request("http://localhost/admin/backup");
      const res = await settingsRouter.request(req, {}, env, mockExecutionContext);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.backup).toBeDefined();
      expect(body.backup.posts).toEqual([{ id: 1, data: "test" }]);
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining("SELECT * FROM \"posts\""));
    });

    it("should handle missing tables gracefully", async () => {
      mockDb.all.mockRejectedValue(new Error("no such table"));
      mockDb.first.mockResolvedValue({ member_type: "mentor" });

      const req = new Request("http://localhost/admin/backup");
      const res = await settingsRouter.request(req, {}, env, mockExecutionContext);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.backup.posts).toBeUndefined(); // Skipped silently
    });

    it("should return 500 on major failure in backup", async () => {
      const dateSpy = vi.spyOn(Date.prototype, 'toISOString').mockImplementation(() => {
        throw new Error("Date failed");
      });
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const req = new Request("http://localhost/admin/backup");
      const res = await settingsRouter.request(req, {}, env, mockExecutionContext);

      expect(res.status).toBe(500);
      dateSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });
});
