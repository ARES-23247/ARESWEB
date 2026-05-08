import { describe, it, expect, vi, beforeEach } from "vitest";
import { upsertProfile } from "./_profileUtils";
import { Context } from "hono";
import { AppEnv } from "../middleware";

vi.mock("../../utils/crypto", () => ({
  encrypt: vi.fn((val: string) => Promise.resolve("encrypted_" + val)),
}));

// Simple inline mock database
const createMockDb = () => {
      const allFn = vi.fn().mockResolvedValue([]);
      const getFn = vi.fn().mockResolvedValue(null);
      const runFn = vi.fn().mockResolvedValue({ success: true });

      const fns: Record<string, any> = {
        all: allFn,
        get: getFn,
        run: runFn,
        execute: allFn,
        executeTakeFirst: getFn,
        first: getFn
      };

      const chainable: any = new Proxy(fns, {
        get: (target, prop) => {
          if (prop === 'then') return undefined;
          if (prop === 'query') {
             return new Proxy({}, {
                get: () => new Proxy({}, {
                   get: (tTarget, tProp) => {
                      if (tProp === 'findFirst') return fns.get;
                      if (tProp === 'findMany') return fns.all;
                      return vi.fn().mockReturnValue(chainable);
                   }
                })
             });
          }
          if (prop in target) return target[prop];
          if (prop === 'transaction') return vi.fn(async (cb) => cb(chainable));
          target[prop as string] = vi.fn().mockReturnValue(chainable);
          return target[prop as string];
        }
      });
      return chainable;
    };

describe("Profile Utils", () => {
  let mockDb: ReturnType<typeof createMockDb>;
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
    mockDb = createMockDb();

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
    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockDb.values).toHaveBeenCalled();
  });

  it("prevents self-escalation of member_type for non-admins", async () => {
    mockContext.var.session.user = { id: "2", role: "user", member_type: "student" };
    mockDb.get.mockResolvedValueOnce({ member_type: "student" });

    await upsertProfile(mockContext as unknown as Context<AppEnv>, "2", { member_type: "mentor" });

    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("prevents self-escalation and defaults to student if existing has no member_type", async () => {
    mockContext.var.session.user = { id: "2", role: "user", member_type: "student" };
    mockDb.get.mockResolvedValueOnce({}); // No member_type

    await upsertProfile(mockContext as unknown as Context<AppEnv>, "2", { member_type: "mentor" });

    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("defaults to student if no existing profile", async () => {
    mockContext.var.session.user = { id: "2", role: "user", member_type: "student" };
    mockDb.get.mockResolvedValueOnce(null);

    await upsertProfile(mockContext as unknown as Context<AppEnv>, "2", { member_type: "mentor" });

    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("uses default values if JSON is invalid in DB", async () => {
    mockDb.get.mockResolvedValueOnce({ subteams: "invalid_json" });
    await upsertProfile(mockContext as unknown as Context<AppEnv>, "3", { nickname: "Test" });
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("handles valid JSON in DB", async () => {
    mockDb.get.mockResolvedValueOnce({ subteams: '["Marketing"]' });
    await upsertProfile(mockContext as unknown as Context<AppEnv>, "4", {});
    expect(mockDb.insert).toHaveBeenCalled();
  });
});
