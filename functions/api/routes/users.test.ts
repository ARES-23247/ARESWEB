import { describe, it, expect, vi } from "vitest";
import { mockExecutionContext } from "@/test/utils";
import usersRouter from "./users";
import { createMockUser } from "@/test/factories/userFactory";

describe("Hono Backend - /users Router", () => {
  const env = {
    DB: {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      all: vi.fn(),
      run: vi.fn(),
      batch: vi.fn(),
    } as any,
    DEV_BYPASS: "true",
  };

  it("should list all users for admin", async () => {
    const mockUsers = [
      createMockUser({ id: "1", name: "User 1" }),
      createMockUser({ id: "2", name: "User 2" }),
    ];

    env.DB.all.mockResolvedValue({ results: mockUsers });

    const req = new Request("http://localhost/", { method: "GET" });
    const res = await usersRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.users).toHaveLength(2);
    expect(env.DB.prepare).toHaveBeenCalledWith(expect.stringContaining("SELECT u.id, u.name"));
  });

  it("should handle list errors gracefully", async () => {
    env.DB.all.mockRejectedValue(new Error("DB error"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const req = new Request("http://localhost/", { method: "GET" });
    const res = await usersRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(500);
    const body = await res.json() as any;
    expect(body.users).toEqual([]);
    
    consoleSpy.mockRestore();
  });

  it("should update user role", async () => {
    env.DB.run.mockResolvedValue({ success: true });

    const req = new Request("http://localhost/1", {
      method: "PATCH",
      body: JSON.stringify({ role: "admin" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await usersRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(env.DB.prepare).toHaveBeenCalledWith("UPDATE user SET role = ? WHERE id = ?");
    expect(env.DB.bind).toHaveBeenCalledWith("admin", "1");
  });

  it("should update user member_type", async () => {
    env.DB.run.mockResolvedValue({ success: true });

    const req = new Request("http://localhost/1", {
      method: "PATCH",
      body: JSON.stringify({ member_type: "mentor" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await usersRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(env.DB.prepare).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO user_profiles (user_id, member_type)"));
    expect(env.DB.bind).toHaveBeenCalledWith("1", "mentor");
  });

  it("should handle patch errors gracefully", async () => {
    env.DB.run.mockRejectedValue(new Error("Update failed"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const req = new Request("http://localhost/1", {
      method: "PATCH",
      body: JSON.stringify({ role: "admin" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await usersRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "User update failed" });
    
    consoleSpy.mockRestore();
  });

  it("should override user profile via PUT /:id", async () => {
    // upsertProfile is called internally. We need to mock it or the DB calls it makes.
    env.DB.run.mockResolvedValue({ success: true });

    const req = new Request("http://localhost/1", {
      method: "PUT",
      body: JSON.stringify({ nickname: "New Nick" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await usersRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });

  it("should handle profile update errors gracefully", async () => {
    env.DB.run.mockRejectedValue(new Error("Upsert failed"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const req = new Request("http://localhost/1", {
      method: "PUT",
      body: JSON.stringify({ nickname: "New Nick" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await usersRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Profile update failed" });
    
    consoleSpy.mockRestore();
  });

  it("should delete user and related data", async () => {
    env.DB.batch.mockResolvedValue([]);

    const req = new Request("http://localhost/1", { method: "DELETE" });
    const res = await usersRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(env.DB.batch).toHaveBeenCalled();
    const batchCalls = env.DB.prepare.mock.calls.map((c: any) => c[0]);
    expect(batchCalls).toContain("DELETE FROM user WHERE id = ?");
    expect(batchCalls).toContain("DELETE FROM user_profiles WHERE user_id = ?");
  });

  it("should handle delete errors gracefully", async () => {
    env.DB.batch.mockRejectedValue(new Error("Delete failed"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const req = new Request("http://localhost/1", { method: "DELETE" });
    const res = await usersRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "User delete failed" });
    
    consoleSpy.mockRestore();
  });
});
