import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import storeRouter from "./store";
import { AppEnv } from "../middleware";

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
        constructEvent: vi.fn((rawBody, signature, _secret) => {
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
  return {
    ...actual,
    getDb: () => {
      const fns = {
        all: vi.fn().mockResolvedValue([]),
        get: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ success: true }),
        execute: vi.fn().mockResolvedValue([]),
        executeTakeFirst: vi.fn().mockResolvedValue(null),
        first: vi.fn().mockResolvedValue(null)
      };
      const methods = ['mockResolvedValueOnce', 'mockResolvedValue', 'mockRejectedValueOnce', 'mockRejectedValue'];
      const orig = {};
      for (const m of methods) {
        orig[m] = {
          all: fns.all[m].bind(fns.all),
          get: fns.get[m].bind(fns.get),
          run: fns.run[m].bind(fns.run),
          execute: fns.execute[m].bind(fns.execute),
          executeTakeFirst: fns.executeTakeFirst[m].bind(fns.executeTakeFirst),
          first: fns.first[m].bind(fns.first)
        };
      }
      const terminalsList = ['all', 'get', 'run', 'execute', 'executeTakeFirst', 'first'];
      for (const key of terminalsList) {
        for (const m of methods) {
          fns[key][m] = (...args) => {
            const terminals = ['all', 'get', 'run', 'execute', 'executeTakeFirst', 'first'];
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
          if (prop in target) return target[prop];
          if (prop === 'transaction') return vi.fn(async (cb) => cb(chainable));
          target[prop] = vi.fn().mockReturnValue(chainable);
          return target[prop];
        }
      });
      return chainable;
    },
    }),
  };
});

interface _StoreResponse {
  success?: boolean;
  data?: unknown;
  error?: string;
  session?: { id: string; url: string };
  [key: string]: unknown;
}

describe("Hono Backend - /store Router", () => {
  let app: Hono<AppEnv>;
  let getDbMock: () => any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const middleware = await import("../middleware");
    getDbMock = middleware.getDb as any;

    app = new Hono<AppEnv>();
    app.use("*", async (c, next) => {
      c.set("db", getDbMock() as any);
      c.set("sessionUser", { id: "admin-1", role: "admin", email: "admin@test.com", name: null, member_type: "mentor" } as any);
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
