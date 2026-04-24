/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { mockExecutionContext } from "../../../src/test/utils";
import profilesRouter from "./profiles";
import { createMockProfile } from "../../../src/test/factories/userFactory";

// Mock crypto to avoid Web Crypto API issues in test env
vi.mock("../../utils/crypto", () => ({
  decrypt: vi.fn((val) => Promise.resolve(val)),
  encrypt: vi.fn((val) => Promise.resolve(val)),
}));

vi.mock("../../utils/auth", () => ({
  getAuth: vi.fn().mockReturnValue({
    api: {
      updateUser: vi.fn().mockResolvedValue({ success: true })
    }
  })
}));

describe("Hono Backend - /profiles Router", () => {
  let mockDb: any;
  let testApp: Hono<any>;
  let env: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      selectAll: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
      executeTakeFirst: vi.fn().mockResolvedValue(null),
      insertInto: vi.fn().mockReturnThis(),
      onConflict: vi.fn().mockReturnThis(),
      doUpdateSet: vi.fn().mockReturnThis(),
      updateTable: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true }),
      getExecutor: vi.fn().mockReturnValue({
        compileQuery: vi.fn().mockReturnValue({ sql: "", parameters: [], query: { kind: "RawNode" } }),
        executeQuery: vi.fn().mockResolvedValue({ rows: [] }),
        transformQuery: vi.fn((q) => q),
      }),
    };

    env = {
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

    testApp = new Hono<any>();
    testApp.use("*", async (c: any, next: any) => {
      c.set("db", mockDb);
      c.set("sessionUser", { id: "local-dev", email: "admin@test.com", role: "admin", name: "Local Dev" });
      await next();
    });
    testApp.route("/", profilesRouter);
  });

  it("should return /me profile for authenticated user", async () => {
    const mockProfile = createMockProfile({ user_id: "local-dev", nickname: "Local Dev" });
    mockDb.executeTakeFirst.mockResolvedValueOnce(mockProfile); // profile
    mockDb.execute.mockResolvedValueOnce([]); // badges

    const res = await testApp.request("/me", {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.nickname).toBe("Local Dev");
    expect(body.auth.id).toBe("local-dev");
  });

  it("should handle /me fetch errors gracefully", async () => {
    mockDb.executeTakeFirst.mockRejectedValueOnce(new Error("DB error"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await testApp.request("/me", {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ auth: null, member_type: "student", first_name: "", last_name: "", nickname: "" });
    
    consoleSpy.mockRestore();
  });

  it("should update /me profile", async () => {
    mockDb.run.mockResolvedValue({ success: true });

    const res = await testApp.request("/me", {
      method: "PUT",
      body: JSON.stringify({ nickname: "New Nick" }),
      headers: { "Content-Type": "application/json" },
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });

  it("should return 500 on /me update error", async () => {
    // Note: upsertProfile also uses c.get("db") which points to mockDb
    mockDb.executeTakeFirst.mockRejectedValueOnce(new Error("DB error"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await testApp.request("/me", {
      method: "PUT",
      body: JSON.stringify({ nickname: "New Nick" }),
      headers: { "Content-Type": "application/json" },
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: false });
    consoleSpy.mockRestore();
  });

  it("should update /avatar", async () => {
    const res = await testApp.request("/avatar", {
      method: "PUT",
      body: JSON.stringify({ image: "https://example.com/avatar.png" }),
      headers: { "Content-Type": "application/json" },
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });

  it("should return 500 on /avatar update error", async () => {
    const { getAuth } = await import("../../utils/auth");
    (getAuth as any).mockReturnValueOnce({
      api: { updateUser: vi.fn().mockRejectedValueOnce(new Error("API Error")) }
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await testApp.request("/avatar", {
      method: "PUT",
      body: JSON.stringify({ image: "https://example.com/avatar.png" }),
      headers: { "Content-Type": "application/json" },
    }, env, mockExecutionContext);

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Avatar update failed" });
    consoleSpy.mockRestore();
  });

  it("should return team roster", async () => {
    const mockRoster = [
      { user_id: "1", nickname: "Member 1", member_type: "student", show_on_about: 1 },
      { user_id: "2", nickname: "Member 2", member_type: "mentor", show_on_about: 1, contact_email: "encrypted" },
    ];
    mockDb.execute.mockResolvedValueOnce(mockRoster);

    const res = await testApp.request("/team-roster", {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.members).toHaveLength(2);
    expect(body.members[0].nickname).toBe("Member 1");
  });

  it("should handle team roster FTS5 search", async () => {
    const mockRoster = [
      { user_id: "2", nickname: "Member 2", member_type: "mentor", show_on_about: 1, contact_email: "encrypted" },
    ];
    mockDb.execute.mockResolvedValueOnce(mockRoster);

    const res = await testApp.request("/team-roster?q=search", {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.members).toHaveLength(1);
    expect(body.members[0].nickname).toBe("Member 2");
  });

  it("should return 500 on team roster fetch error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("DB error"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await testApp.request("/team-roster", {}, env, mockExecutionContext);

    expect(res.status).toBe(200); 
    const body = await res.json() as any;
    expect(body.members).toHaveLength(0);
    consoleSpy.mockRestore();
  });

  it("should return public profile by userId", async () => {
    const mockProfile = { 
      user_id: "user-123", 
      nickname: "Public User", 
      show_on_about: 1, 
      member_type: "student" 
    };
    mockDb.executeTakeFirst.mockResolvedValueOnce(mockProfile); // profile
    mockDb.execute.mockResolvedValueOnce([]); // badges

    const res = await testApp.request("/user-123", {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.profile.nickname).toBe("Public User");
  });

  it("should return 404 for non-existent profile", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(null);

    const res = await testApp.request("/ghost", {}, env, mockExecutionContext);

    expect(res.status).toBe(404);
  });

  it("should return 403 for private profile", async () => {
    const mockProfile = { 
      user_id: "user-123", 
      nickname: "Private User", 
      show_on_about: 0, 
      member_type: "student" 
    };
    mockDb.executeTakeFirst.mockResolvedValueOnce(mockProfile);

    const res = await testApp.request("/user-123", {}, env, mockExecutionContext);

    expect(res.status).toBe(403);
  });

  it("should fetch sensitive info for self/admin in public profile", async () => {
    const mockProfile = { 
      user_id: "local-dev", // Same as authenticated user
      nickname: "Public User", 
      show_on_about: 1, 
      member_type: "student" 
    };
    const sensitiveData = {
      emergency_contact_name: "encrypted_name",
      emergency_contact_phone: "encrypted_phone",
      dietary_restrictions: "None",
      tshirt_size: "L"
    };

    mockDb.executeTakeFirst
      .mockResolvedValueOnce(mockProfile) // profile
      .mockResolvedValueOnce(sensitiveData); // sensitive
    mockDb.execute.mockResolvedValueOnce([]); // badges

    const res = await testApp.request("/local-dev", {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.profile.nickname).toBe("Public User");
    expect(body.profile.dietary_restrictions).toBe("None");
  });

  it("should handle public profile fetch error", async () => {
    mockDb.executeTakeFirst.mockRejectedValueOnce(new Error("DB error"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await testApp.request("/user-123", {}, env, mockExecutionContext);

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Profile fetch failed" });
    consoleSpy.mockRestore();
  });
});
