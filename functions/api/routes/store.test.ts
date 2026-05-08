import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import storeRouter from "./store";
import { AppEnv } from "../middleware";

// Proper mock types
interface MockDbMethods {
  all: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
  execute: ReturnType<typeof vi.fn>;
  executeTakeFirst: ReturnType<typeof vi.fn>;
  first: ReturnType<typeof vi.fn>;
  [key: string]: ReturnType<typeof vi.fn> | MockMethodMap;
}

interface MockMethodMap {
  all: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
  execute: ReturnType<typeof vi.fn>;
  executeTakeFirst: ReturnType<typeof vi.fn>;
  first: ReturnType<typeof vi.fn>;
}

type ChainableDb = MockDbMethods & { transaction?: ReturnType<typeof vi.fn> };

interface StoreResponse {
  success?: boolean;
  data?: unknown;
  error?: string;
  session?: { id: string; url: string };
  [key: string]: unknown;
}

interface MockDbFunction {
  (): ChainableDb;
}

vi.mock("../../utils/zulip", () => ({
  sendZulipMessage: vi.fn().mockResolvedValue(true)
}));

// Mock Stripe
vi.mock("stripe", () => {
  return {
    default: class MockStripe {
      checkout = {
        sessions: {
          create: vi.fn().mockResolvedValue({ id: "cs_test_123", url: "https://stripe.com/checkout/test" })
        }
      };
      webhooks = {
        constructEvent: vi.fn((rawBody: string, signature: string, _secret: string) => {
          if (signature === "invalid") {
            throw new Error("Invalid signature");
          }
          return JSON.parse(rawBody);
        })
      };
    }
  };
});

vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  const fns: MockDbMethods = {
    all: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
    run: vi.fn().mockResolvedValue({ success: true }),
    execute: vi.fn().mockResolvedValue([]),
    executeTakeFirst: vi.fn().mockResolvedValue(null),
    first: vi.fn().mockResolvedValue(null)
  };
  const methods = ['mockResolvedValueOnce', 'mockResolvedValue', 'mockRejectedValueOnce', 'mockRejectedValue'] as const;
  const orig: Record<string, MockMethodMap> = {};
  for (const m of methods) {
    orig[m] = {
      all: (fns.all as any)[m].bind(fns.all),
      get: (fns.get as any)[m].bind(fns.get),
      run: (fns.run as any)[m].bind(fns.run),
      execute: (fns.execute as any)[m].bind(fns.execute),
      executeTakeFirst: (fns.executeTakeFirst as any)[m].bind(fns.executeTakeFirst),
      first: (fns.first as any)[m].bind(fns.first)
    };
  }
  const terminalsList = ['all', 'get', 'run', 'execute', 'executeTakeFirst', 'first'] as const;
  for (const key of terminalsList) {
    for (const m of methods) {
      (fns[key])[m] = (...args: unknown[]) => {
        const terminals = ['all', 'get', 'run', 'execute', 'executeTakeFirst', 'first'] as const;
        for (const k of terminals) {
          if (orig[m][k]) orig[m][k](...args);
        }
        return fns[key];
      };
    }
  }
  const chainable = new Proxy(fns, {
    get: (target, prop) => {
      if (prop === 'then') return undefined;
      if (prop in target) return target[prop as keyof MockDbMethods];
      if (prop === 'transaction') return vi.fn(async (cb: (tx: ChainableDb) => Promise<unknown>) => cb(chainable));
      (target[prop as string] as ReturnType<typeof vi.fn>) = vi.fn().mockReturnValue(chainable);
      return target[prop as string];
    }
  }) as ChainableDb;

  return {
    ...actual,
    getDb: (() => chainable) as MockDbFunction,
    resetDbMock: () => {
      vi.clearAllMocks();
      fns.all.mockResolvedValue([]);
      fns.get.mockResolvedValue(null);
      fns.run.mockResolvedValue({ success: true });
      fns.execute.mockResolvedValue([]);
      fns.executeTakeFirst.mockResolvedValue(null);
      fns.first.mockResolvedValue(null);
    }
  };
});

describe("Hono Backend - /store Router", () => {
  let app: Hono<AppEnv>;
  let getDbMock: MockDbFunction;

  beforeEach(async () => {
    vi.clearAllMocks();
    const middleware = await import("../middleware");
    getDbMock = middleware.getDb as unknown as MockDbFunction;
    ((middleware as unknown as Record<string, () => void>).resetDbMock ?? (() => {}))();

    app = new Hono<AppEnv>();
    app.use("*", async (c, next) => {
      c.set("db", getDbMock() as never);
      c.set("sessionUser", { id: "admin-1", role: "admin", email: "admin@test.com", name: null, member_type: "mentor" } as never);
      c.env = {
        STRIPE_SECRET_KEY: "sk_test_123",
        STRIPE_WEBHOOK_SECRET: "whsec_123",
        DB: {} as unknown as D1Database,
        ENVIRONMENT: "test",
        DEV_BYPASS: "true",
      } as AppEnv["Bindings"];
      await next();
    });
    app.route("/store", storeRouter);
  });

  describe("POST /store/webhook", () => {
    it("returns 400 if signature is missing", async () => {
      const res = await app.request("/store/webhook", {
        method: "POST",
        body: JSON.stringify({ type: "checkout.session.completed" })
      });
      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe("Missing stripe signature");
    });

    it("returns 400 if signature is invalid", async () => {
      const res = await app.request("/store/webhook", {
        method: "POST",
        headers: {
          "stripe-signature": "invalid"
        },
        body: JSON.stringify({ type: "checkout.session.completed" })
      });
      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe("Invalid signature");
    });

    it("inserts order on checkout.session.completed", async () => {
      const mockDb = getDbMock();
      mockDb.run = vi.fn().mockResolvedValueOnce({ success: true });
      const payload = {
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_123",
            customer_details: { email: "test@example.com" },
            amount_total: 1500,
            shipping_details: {
              name: "John Doe",
              address: { line1: "123 Main St", city: "Anytown", state: "NY", postal_code: "12345", country: "US" }
            }
          }
        }
      };

      const res = await app.request("/store/webhook", {
        method: "POST",
        headers: {
          "stripe-signature": "valid"
        },
        body: JSON.stringify(payload)
      });

      expect(res.status).toBe(200);
      expect(mockDb.run).toHaveBeenCalled();
    });
  });

  describe("GET /store/products", () => {
    it("returns active products", async () => {
      const mockDb = getDbMock();
      mockDb.all = vi.fn().mockResolvedValueOnce([
        { id: "prod_1", name: "T-Shirt", active: 1, price_cents: 2000, description: "Cool shirt", image_url: null, stock_count: 10, created_at: null }
      ]);
      const res = await app.request("/store/products");
      expect(res.status).toBe(200);
      const data = (await res.json()) as Array<{ id: string }>;
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe("prod_1");
    });
  });

  describe("POST /store/checkout", () => {
    it("creates a checkout session", async () => {
      const mockDb = getDbMock();
      mockDb.all = vi.fn().mockResolvedValueOnce([
        { id: "prod_1", name: "T-Shirt", active: 1, price_cents: 2000, description: "Cool shirt", image_url: null, stock_count: 10, created_at: null }
      ]);

      const res = await app.request("/store/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ productId: "prod_1", quantity: 1 }],
          successUrl: "http://localhost/success",
          cancelUrl: "http://localhost/cancel"
        })
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.sessionId).toBe("cs_test_123");
      expect(data.url).toBe("https://stripe.com/checkout/test");
    });
  });
});
