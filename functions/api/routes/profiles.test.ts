/* eslint-disable @typescript-eslint/no-explicit-any */
 
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { Context } from "hono";
import { mockExecutionContext } from "../../../src/test/utils";
import type { TestEnv, DrizzleMock } from "../../../src/test/types";
import profilesRouter from "./profiles";


describe("Hono Backend - /profiles Router", () => {
  let mockDb: DrizzleMock;
  let testApp: Hono<TestEnv>;
  let env: TestEnv["Bindings"];

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
      deleteFrom: vi.fn().mockReturnThis(), // Added missing required method
      run: vi.fn().mockResolvedValue({ success: true }),
      getExecutor: vi.fn().mockReturnValue({
        compileQuery: vi.fn().mockReturnValue({ sql: "", parameters: [], query: { kind: "RawNode" } }),
        executeQuery: vi.fn().mockResolvedValue({ rows: [] }),
        transformQuery: vi.fn((q: unknown) => q),
      }),
    };

    env = {
      DB: {
        prepare: vi.fn().mockReturnThis(),
        bind: vi.fn().mockReturnThis(),
        first: vi.fn(),
        all: vi.fn(),
        run: vi.fn(),
      } as unknown as D1Database,
      DEV_BYPASS: "true",
    };

    testApp = new Hono<TestEnv>();
    testApp.use("*", async (c: Context<TestEnv>, next: () => Promise<void>) => {
      c.set("db", createDrizzleProxy(mockDb));
      c.set("sessionUser", { id: "local-dev", email: "admin@test.com", role: "admin", name: "Local Dev", member_type: "mentor" });
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
    const body = await res.json() as { nickname: string; auth: { id: string } };
    expect(body.nickname).toBe("Local Dev");
    expect(body.auth.id).toBe("local-dev");
  });

  it("should handle /me fetch errors gracefully", async () => {
    mockDb.executeTakeFirst.mockRejectedValueOnce(new Error("DB error"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await testApp.request("/me", {}, env, mockExecutionContext);

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to fetch your profile" });
    
    consoleSpy.mockRestore();
  });

  it("should update /me profile", async () => {
    (mockDb as any).run.mockResolvedValue({ success: true });

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

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to update profile" });
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
    vi.mocked(getAuth).mockReturnValueOnce({
      api: { updateUser: vi.fn().mockRejectedValueOnce(new Error("API Error")) }
    } as any);
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
      { user_id: "2", nickname: "Member 2", member_type: "mentor", show_on_about: 1, email: "decrypted@test.com" },
    ];
    mockDb.execute.mockResolvedValueOnce(mockRoster);

    const res = await testApp.request("/team-roster", {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as { members: Array<{ nickname: string }> };
    expect(body.members).toHaveLength(2);
    expect(body.members[0].nickname).toBe("Member 1");
  });

  it("should handle team roster FTS5 search", async () => {
    const mockRoster = [
      { user_id: "2", nickname: "Member 2", member_type: "mentor", show_on_about: 1, email: "decrypted@test.com" },
    ];
    mockDb.execute.mockResolvedValueOnce(mockRoster);

    const res = await testApp.request("/team-roster?q=search", {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as { members: Array<{ nickname: string }> };
    expect(body.members).toHaveLength(1);
    expect(body.members[0].nickname).toBe("Member 2");
  });

  it("should return 500 on team roster fetch error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("DB error"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await testApp.request("/team-roster", {}, env, mockExecutionContext);

    expect(res.status).toBe(500); 
    expect(await res.json()).toEqual({ error: "Failed to fetch team roster" });
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
    const body = await res.json() as { profile: { nickname: string } };
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
    const body = await res.json() as { profile: { nickname: string; dietary_restrictions: string } };
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

  it("should handle decryption failures in /me", async () => {
    vi.mocked(cryptoUtils.decrypt).mockRejectedValue(new Error("Corrupt"));
    const mockProfile = createMockProfile({ user_id: "local-dev", phone: "bad-data" });
    mockDb.executeTakeFirst.mockResolvedValueOnce(mockProfile);

    const res = await testApp.request("/me", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as { phone: string };
    expect(body.phone).toBe("[Decryption Failed]");
  });

  it("should handle decryption failures in team-roster", async () => {
    vi.mocked(cryptoUtils.decrypt).mockRejectedValue(new Error("Corrupt"));
    mockDb.execute.mockResolvedValueOnce([{ user_id: "1", member_type: "mentor", email: "bad:data", show_on_about: 1 }]);

    const res = await testApp.request("/team-roster", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as { members: Array<{ email: string | null }> };
    expect(body.members[0].email).toBeNull();
  });

  it("should handle empty results in team-roster with warning", async () => {
    mockDb.execute.mockResolvedValueOnce([{ user_id: "1", show_on_about: 1 }]);

    vi.mocked(shared.sanitizeProfileForPublic).mockReturnValueOnce(null as any);

    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await testApp.request("/team-roster", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

