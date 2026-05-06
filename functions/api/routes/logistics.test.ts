import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { Context } from "hono";
import { MockKysely, TestEnv } from "../../../src/test/types";
import { mockExecutionContext } from "../../../src/test/utils";

vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAdmin: async (_c: Context<TestEnv>, next: () => Promise<void>) => next(),
  };
});

vi.mock("../../utils/crypto", () => ({
  decrypt: vi.fn(async (val: string) => val.split(":")[1] || val)
}));

import logisticsRouter from "./logistics";

describe("Hono Backend - /logistics Router", () => {
  let mockDb: MockKysely;
  let testApp: Hono<TestEnv>;
  let env: Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
      executeTakeFirst: vi.fn().mockResolvedValue(null),
    } as unknown as MockKysely;

    env = {
      ENCRYPTION_SECRET: "test-secret"
    };

    testApp = new Hono<TestEnv>();
    testApp.use("*", async (c: Context<TestEnv>, next: () => Promise<void>) => {
      c.set("db", mockDb);
      await next();
    });
    testApp.route("/", logisticsRouter);
  });

  it("GET /admin/summary - fetches logistics summary", async () => {
    mockDb.execute.mockResolvedValueOnce([
      { dietary_restrictions: "Vegan, Nut Allergy", tshirt_size: "L", member_type: "student", name: "Alice" },
      { dietary_restrictions: "Vegan", tshirt_size: "M", member_type: "mentor", name: "Bob" },
      { dietary_restrictions: null, tshirt_size: "L", member_type: "student", name: "Charlie" }
    ]);

    const res = await testApp.request("/admin/summary", {}, env, mockExecutionContext);
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
    mockDb.execute.mockResolvedValueOnce([
      { name: "Alice", email: "alice@test.com", role: "student" },
      { name: "Bob", email: "iv:bob@test.com", role: "mentor" },
      { name: "Charlie", email: "invalid-email", role: "admin" } // Should be skipped
    ]);

    const res = await testApp.request("/admin/export-emails", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as {
      users: Array<{ name: string; email: string; role: string; emergencyName: string; emergencyPhone: string }>;
    };
    expect(body.users).toHaveLength(2);
    expect(body.users[0]).toEqual({ name: "Alice", email: "alice@test.com", role: "student", emergencyName: "—", emergencyPhone: "—" });
    expect(body.users[1]).toEqual({ name: "Bob", email: "bob@test.com", role: "mentor", emergencyName: "—", emergencyPhone: "—" });
  });
});

