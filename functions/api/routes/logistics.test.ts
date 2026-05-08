import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { Context } from "hono";
import { AppEnv } from "../middleware";

vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAdmin: async (_c: Context<AppEnv>, next: () => Promise<void>) => next(),
  };
});

vi.mock("../../utils/crypto", () => ({
  decrypt: vi.fn(async (val: string) => val.split(":")[1] || val)
}));

import logisticsRouter from "./logistics";

const mockExecutionContext = {
  waitUntil: vi.fn(),
};

describe("Hono Backend - /logistics Router", () => {
  let app: Hono<AppEnv>;

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
          if (prop === 'then') {
            return (resolve: any, reject: any) => Promise.resolve(fns.all()).then(resolve).catch(reject);
          }
          if (prop === 'catch') {
            return (reject: any) => Promise.resolve(fns.all()).catch(reject);
          }
          if (prop === 'finally') {
            return (cb: any) => Promise.resolve(fns.all()).finally(cb);
          }
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
          if (prop === 'transaction') return vi.fn(async (cb: any) => cb(chainable));
          if (typeof prop === 'symbol') return chainable;
          target[prop as string] = vi.fn().mockReturnValue(chainable);
          return target[prop as string];
        }
      });
      return chainable;
    };;;

  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = createMockDb();

    app = new Hono<AppEnv>();
    app.use("*", async (c: Context<AppEnv>, next: () => Promise<void>) => {
      c.set("db", mockDb as never);
      await next();
    });
    app.route("/", logisticsRouter);
  });

  it("GET /admin/summary - fetches logistics summary", async () => {
    mockDb.all.mockResolvedValueOnce([
      { dietary_restrictions: "Vegan, Nut Allergy", tshirt_size: "L", member_type: "student", name: "Alice" },
      { dietary_restrictions: "Vegan", tshirt_size: "M", member_type: "mentor", name: "Bob" },
      { dietary_restrictions: null, tshirt_size: "L", member_type: "student", name: "Charlie" }
    ]);

    const res = await app.request("/admin/summary", {}, { ENCRYPTION_SECRET: "test-secret" } as never, mockExecutionContext as never);
    expect(res.status).toBe(200);
    const body = await res.json() as {
      totalCount: number;
      memberCounts: Record<string, number>;
      dietary: Record<string, number>;
      tshirts: Record<string, number>;
    };
    expect(body.totalCount).toBe(3);
    expect(body.memberCounts).toEqual({ student: 2, mentor: 1 });
    expect(body.dietary).toEqual({ "Vegan": 2, "Nut Allergy": 1 });
    expect(body.tshirts).toEqual({ "L": 2, "M": 1 });
  });

  it("GET /admin/export-emails - exports emails correctly", async () => {
    mockDb.all.mockResolvedValueOnce([
      { name: "Alice", email: "alice@test.com", role: "student", emergency_contact_name: null, emergency_contact_phone: null },
      { name: "Bob", email: "iv:bob@test.com", role: "mentor", emergency_contact_name: null, emergency_contact_phone: null },
      { name: "Charlie", email: "invalid-email", role: "admin", emergency_contact_name: null, emergency_contact_phone: null } // Should be skipped
    ]);

    const res = await app.request("/admin/export-emails", {}, { ENCRYPTION_SECRET: "test-secret" } as never, mockExecutionContext as never);
    expect(res.status).toBe(200);
    const body = await res.json() as {
      users: Array<{ name: string; email: string; role: string; emergencyName: string; emergencyPhone: string }>;
    };
    expect(body.users).toHaveLength(2);
    expect(body.users[0]).toEqual({ name: "Alice", email: "alice@test.com", role: "student", emergencyName: "—", emergencyPhone: "—" });
    expect(body.users[1]).toEqual({ name: "Bob", email: "bob@test.com", role: "mentor", emergencyName: "—", emergencyPhone: "—" });
  });
});
