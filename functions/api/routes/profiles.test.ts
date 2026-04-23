/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockExecutionContext } from "../../../src/test/utils";
import profilesRouter from "./profiles";
import { createMockProfile } from "../../../src/test/factories/userFactory";

// Mock crypto to avoid Web Crypto API issues in test env
vi.mock("../../utils/crypto", () => ({
  decrypt: vi.fn((val) => Promise.resolve(val)),
  encrypt: vi.fn((val) => Promise.resolve(val)),
}));

describe("Hono Backend - /profiles Router", () => {
  const env = {
    DB: {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(),
      all: vi.fn(),
      run: vi.fn(),
    } as any,
    DEV_BYPASS: "true",
    ENCRYPTION_SECRET: "test-secret",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return /me profile for authenticated user", async () => {
    const mockProfile = createMockProfile({ user_id: "local-dev", nickname: "Local Dev" });
    env.DB.first.mockResolvedValueOnce(mockProfile); // first for profile
    env.DB.all.mockResolvedValueOnce({ results: [] }); // all for badges

    const req = new Request("http://localhost/me", { method: "GET" });
    const res = await profilesRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.nickname).toBe("Local Dev");
    expect(body.auth.id).toBe("local-dev");
  });

  it("should handle /me fetch errors gracefully", async () => {
    env.DB.first.mockRejectedValueOnce(new Error("DB error"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const req = new Request("http://localhost/me", { method: "GET" });
    const res = await profilesRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Profile fetch failed" });
    
    consoleSpy.mockRestore();
  });

  it("should update /me profile", async () => {
    env.DB.run.mockResolvedValue({ success: true });

    const req = new Request("http://localhost/me", {
      method: "PUT",
      body: JSON.stringify({ nickname: "New Nick" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await profilesRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });

  it("should return team roster", async () => {
    const mockRoster = [
      { user_id: "1", nickname: "Member 1", member_type: "student", show_on_about: 1 },
      { user_id: "2", nickname: "Member 2", member_type: "mentor", show_on_about: 1 },
    ];
    env.DB.all.mockResolvedValue({ results: mockRoster });

    const req = new Request("http://localhost/team-roster", { method: "GET" });
    const res = await profilesRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.members).toHaveLength(2);
    expect(body.members[0].nickname).toBe("Member 1");
  });

  it("should return public profile by userId", async () => {
    const mockProfile = { 
      user_id: "user-123", 
      nickname: "Public User", 
      show_on_about: 1, 
      member_type: "student" 
    };
    env.DB.first.mockResolvedValueOnce(mockProfile); // first for profile
    env.DB.all.mockResolvedValueOnce({ results: [] }); // all for badges

    const req = new Request("http://localhost/user-123", { method: "GET" });
    const res = await profilesRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.profile.nickname).toBe("Public User");
  });

  it("should return 404 for non-existent profile", async () => {
    env.DB.first.mockResolvedValue(null);

    const req = new Request("http://localhost/ghost", { method: "GET" });
    const res = await profilesRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(404);
  });

  it("should return 403 for private profile", async () => {
    const mockProfile = { 
      user_id: "user-123", 
      nickname: "Private User", 
      show_on_about: 0, 
      member_type: "student" 
    };
    env.DB.first.mockResolvedValue(mockProfile);

    const req = new Request("http://localhost/user-123", { method: "GET" });
    const res = await profilesRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(403);
  });
});
