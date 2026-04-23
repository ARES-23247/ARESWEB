import { describe, it, expect, vi, beforeEach } from "vitest";
import signupsRouter from "./signups";

const mockExecutionContext = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
};

let mockUser: Record<string, string> = { role: "admin", id: "u1", member_type: "mentor" };

vi.mock("../../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../middleware")>();
  return {
    ...actual,
    turnstileMiddleware: () => async (c: unknown, next: () => Promise<void>) => next(),
    getSessionUser: vi.fn().mockImplementation(() => Promise.resolve(mockUser)),
  };
});

describe("Events Signups Router", () => {
  let mockDb: Record<string, ReturnType<typeof vi.fn>>;
  let env: { DB: Record<string, ReturnType<typeof vi.fn>> };

  beforeEach(() => {
    mockDb = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: [] }),
      first: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockResolvedValue({ success: true }),
    };
    env = { DB: mockDb };
    mockUser = { role: "admin", id: "u1", member_type: "mentor" };
    vi.clearAllMocks();
  });

  it("GET /:id/signups should return signups", async () => {
    mockDb.all.mockResolvedValueOnce({
      results: [{ user_id: "u1", nickname: "Admin", notes: "test note" }]
    });

    const req = new Request("http://localhost/e1/signups");
    const res = await signupsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as { signups: unknown[], can_manage: boolean };
    expect(body.signups.length).toBe(1);
    expect(body.can_manage).toBe(true);
  });

  it("GET /:id/signups should redact notes for non-admin", async () => {
    mockUser = { role: "verified", id: "u2", member_type: "student" };
    mockDb.all.mockResolvedValueOnce({
      results: [{ user_id: "u1", nickname: "Admin", notes: "test note" }]
    });

    const req = new Request("http://localhost/e1/signups");
    const res = await signupsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as { signups: { notes?: string }[] };
    expect(body.signups[0].notes).toBeUndefined();
  });

  it("GET /:id/signups should handle database error", async () => {
    mockDb.all.mockRejectedValue(new Error("DB Error"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const req = new Request("http://localhost/e1/signups");
    const res = await signupsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(500);

    consoleSpy.mockRestore();
  });

  it("POST /:id/signups should create signup", async () => {
    const payload = { bringing: "food", notes: "early", prep_hours: 2 };
    const req = new Request("http://localhost/e1/signups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const res = await signupsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /:id/signups should block unverified", async () => {
    mockUser = { role: "unverified", id: "u2" };
    const req = new Request("http://localhost/e1/signups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    const res = await signupsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(403);
  });

  it("DELETE /:id/signups/me should remove signup", async () => {
    const req = new Request("http://localhost/e1/signups/me", { method: "DELETE" });
    const res = await signupsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("PATCH /:id/signups/me/attendance should update self attendance", async () => {
    const req = new Request("http://localhost/e1/signups/me/attendance", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attended: true })
    });
    const res = await signupsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("PATCH /:id/signups/:userId/attendance should update other attendance if admin", async () => {
    const req = new Request("http://localhost/e1/signups/u2/attendance", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attended: true })
    });
    const res = await signupsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("PATCH /:id/signups/:userId/attendance should reject if not admin", async () => {
    mockUser = { role: "verified", id: "u2", member_type: "student" };
    const req = new Request("http://localhost/e1/signups/u3/attendance", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attended: true })
    });
    const res = await signupsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(401);
  });

  describe("Negative Paths", () => {
    it("POST /:id/signups - should return 400 for malformed JSON", async () => {
      const req = new Request("http://localhost/e1/signups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json"
      });
      const res = await signupsRouter.request(req, {}, env, mockExecutionContext);
      expect(res.status).toBe(400);
    });

    it("POST /:id/signups - should handle database error", async () => {
      mockDb.run.mockRejectedValue(new Error("Write error"));
      const req = new Request("http://localhost/e1/signups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "test" })
      });
      const res = await signupsRouter.request(req, {}, env, mockExecutionContext);
      expect(res.status).toBe(500);
    });

    it("DELETE /:id/signups/me - should handle database error", async () => {
      mockDb.run.mockRejectedValue(new Error("Delete error"));
      const req = new Request("http://localhost/e1/signups/me", { method: "DELETE" });
      const res = await signupsRouter.request(req, {}, env, mockExecutionContext);
      expect(res.status).toBe(500);
    });

    it("PATCH /:id/signups/:userId/attendance - should return 400 for missing attended field", async () => {
      const req = new Request("http://localhost/e1/signups/u2/attendance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const res = await signupsRouter.request(req, {}, env, mockExecutionContext);
      expect(res.status).toBe(400);
    });
  });
});
