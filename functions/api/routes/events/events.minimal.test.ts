/* eslint-disable @typescript-eslint/no-explicit-any -- OpenAPI handler input validated by Zod schemas */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import type { Context } from "hono";
import { mockExecutionContext, createMockDrizzle, createDrizzleProxy } from "../../../../src/test/utils";
import { TestEnv, MockDrizzle } from "../../../../src/test/types";
import eventsRouter from "./index";
import * as shared from "../../middleware";

vi.mock("../../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../middleware")>();
  return {
    ...actual,
    ensureAdmin: async (_c: unknown, next: () => Promise<void>) => next(),
    ensureAuth: async (_c: unknown, next: () => Promise<void>) => next(),
    logAuditAction: vi.fn().mockResolvedValue(true),
    getSocialConfig: vi.fn().mockResolvedValue({
      ZULIP_BOT_EMAIL: "bot@test.com",
      ZULIP_API_KEY: "key",
      ZULIP_SITE: "https://test.com",
      GCAL_SERVICE_ACCOUNT_EMAIL: "gcal@test.com",
      GCAL_PRIVATE_KEY: "key",
      CALENDAR_ID: "cal1",
      CALENDAR_ID_INTERNAL: "cal1",
      CALENDAR_ID_OUTREACH: "cal2",
      CALENDAR_ID_EXTERNAL: "cal3"
    }),
    getDbSettings: vi.fn().mockResolvedValue({
      GCAL_SERVICE_ACCOUNT_EMAIL: "gcal@test.com",
      GCAL_PRIVATE_KEY: "key",
      CALENDAR_ID: "cal1"
    }),
    getSessionUser: vi.fn().mockResolvedValue(null),
    sanitizeProfileForPublic: vi.fn().mockImplementation((val: any) => val),
  };
});

vi.mock("../../../utils/socialSync", () => ({
  dispatchSocials: vi.fn().mockResolvedValue(true),
}));

vi.mock("../../../utils/zulipSync", () => ({
  sendZulipMessage: vi.fn().mockResolvedValue(true),
}));

vi.mock("../../../utils/gcalSync", () => ({
  pushEventToGcal: vi.fn().mockResolvedValue("gcal_123"),
  pullEventsFromGcal: vi.fn().mockResolvedValue([{ title: "Sync Event", dateStart: "2026-01-01T00:00:00Z", gcalEventId: "ext_123" }]),
  deleteEventFromGcal: vi.fn().mockResolvedValue(true)
}));

vi.mock("../../utils/crypto", () => ({
  decrypt: vi.fn().mockImplementation((val: any) => val),
  encrypt: vi.fn().mockImplementation((val: any) => val),
}));

describe("Hono Backend - Events Router", () => {
  let mockDb: MockDrizzle;
  let testApp: Hono<TestEnv>;
  let env: Record<string, unknown>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockDb = createMockDrizzle();

    env = {
      DB: {},
      ENVIRONMENT: "test",
      DEV_BYPASS: "true",
    };

    testApp = new Hono<TestEnv>();
    testApp.use("*", async (c: Context<TestEnv>, next: () => Promise<void>) => {
      c.set("db", createDrizzleProxy(mockDb));
      const user = { id: "local-dev", email: "admin@test.com", role: "admin", name: "Local Dev", nickname: "Local Dev", image: null, member_type: "mentor" };
      vi.mocked(shared.getSessionUser).mockResolvedValue(user);
      await next();
    });
    testApp.route("/", eventsRouter);
  });

  afterEach(async () => {
    const calls = mockExecutionContext.waitUntil.mock.calls as unknown as ReadonlyArray<readonly [Promise<unknown>]>;
    const promises = calls.map((call) => call[0]);
    await Promise.all(promises);
  });

  it("GET / - list public events", async () => {
    mockDb.all.mockResolvedValueOnce([]);
    const res = await testApp.request("/", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.select).toHaveBeenCalled();
  });
});
