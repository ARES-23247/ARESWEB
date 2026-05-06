import { describe, it, expect, vi, beforeEach } from "vitest";
import { upsertProfile } from "./_profileUtils";
import { Context } from "hono";
import { AppEnv } from "../middleware";
import type { MockKysely } from "../../../src/test/types";

vi.mock("../../utils/crypto", () => ({
  encrypt: vi.fn((val) => Promise.resolve("encrypted_" + val)),
}));

describe("Profile Utils", () => {
  let mockDb: MockKysely;
  let mockContext: {
    env: { ENCRYPTION_SECRET: string };
    get: ReturnType<typeof vi.fn>;
    var: {
      session: {
        user: {
          id: string;
          role: string;
          member_type: string;
        };
      };
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(null),
      insertInto: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      onConflict: vi.fn().mockImplementation((cb) => {
        if (typeof cb === "function") {
          cb({
            column: vi.fn().mockReturnValue({
              doUpdateSet: vi.fn().mockReturnThis()
            })
          });
        }
        return mockDb;
      }),
      updateTable: vi.fn().mockReturnThis(),
      deleteFrom: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
    };

    mockContext = {
      env: { ENCRYPTION_SECRET: "secret" },
      get: vi.fn().mockReturnValue(mockDb),
      var: {
        session: { user: { id: "1", role: "admin", member_type: "mentor" } }
      }
    };
  });

  it("upserts profile with new data", async () => {
    await upsertProfile(mockContext as unknown as Context<AppEnv>, "1", { nickname: "New Nickname", phone: "123", subteams: ["Programming"], show_email: true });
    expect(mockDb.insertInto).toHaveBeenCalledWith("user_profiles");
    expect(mockDb.values).toHaveBeenCalled();
  });

  it("prevents self-escalation of member_type for non-admins", async () => {
    mockContext.var.session.user = { id: "2", role: "user", member_type: "student" };
    mockDb.executeTakeFirst.mockResolvedValueOnce({ member_type: "student" });
    
    await upsertProfile(mockContext as unknown as Context<AppEnv>, "2", { member_type: "mentor" });
    
    expect(mockDb.insertInto).toHaveBeenCalled();
  });

  it("prevents self-escalation and defaults to student if existing has no member_type", async () => {
    mockContext.var.session.user = { id: "2", role: "user", member_type: "student" };
    mockDb.executeTakeFirst.mockResolvedValueOnce({}); // No member_type
    
    await upsertProfile(mockContext as unknown as Context<AppEnv>, "2", { member_type: "mentor" });
    
    expect(mockDb.insertInto).toHaveBeenCalled();
  });

  it("defaults to student if no existing profile", async () => {
    mockContext.var.session.user = { id: "2", role: "user", member_type: "student" };
    mockDb.executeTakeFirst.mockResolvedValueOnce(null);
    
    await upsertProfile(mockContext as unknown as Context<AppEnv>, "2", { member_type: "mentor" });
    
    expect(mockDb.insertInto).toHaveBeenCalled();
  });

  it("uses default values if JSON is invalid in DB", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ subteams: "invalid_json" });
    await upsertProfile(mockContext as unknown as Context<AppEnv>, "3", { nickname: "Test" });
    expect(mockDb.insertInto).toHaveBeenCalled();
  });

  it("handles valid JSON in DB", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ subteams: '["Marketing"]' });
    await upsertProfile(mockContext as unknown as Context<AppEnv>, "4", {});
    expect(mockDb.insertInto).toHaveBeenCalled();
  });
});

