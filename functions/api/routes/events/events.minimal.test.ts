import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import type { Context } from "hono";
import { AppEnv } from "../../middleware";
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
    sanitizeProfileForPublic: vi.fn().mockImplementation((val: unknown) => val),
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
  decrypt: vi.fn().mockImplementation((val: unknown) => val),
  encrypt: vi.fn().mockImplementation((val: unknown) => val),
}));

const mockExecutionContext = {
  waitUntil: vi.fn(),
};

describe("Hono Backend - Events Router", () => {
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
    };;

  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockDb = createMockDb();

    app = new Hono<AppEnv>();
    app.use("*", async (c: Context<AppEnv>, next: () => Promise<void>) => {
      c.set("db", mockDb as never);
      const user = { id: "local-dev", email: "admin@test.com", role: "admin", name: "Local Dev", nickname: "Local Dev", image: null, member_type: "mentor" };
      vi.mocked(shared.getSessionUser).mockResolvedValue(user);
      await next();
    });
    app.route("/", eventsRouter);
  });

  afterEach(async () => {
    const calls = mockExecutionContext.waitUntil.mock.calls as unknown[][];
    const promises = calls.map((call) => call[0] as Promise<unknown>);
    await Promise.all(promises);
  });

  it("GET / - list public events", async () => {
    mockDb.execute.mockResolvedValueOnce([]);
    const res = await app.request("/", {}, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(200);
    expect(mockDb.select).toHaveBeenCalled();
  });
});
