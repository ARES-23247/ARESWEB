/* eslint-disable @typescript-eslint/no-explicit-any */
 
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { TestEnv } from "../../../src/test/types";
import storeRouter from "./store";

interface StoreResponse {
  success?: boolean;
  data?: unknown;
  error?: string;
  session?: { id: string; url: string };
  [key: string]: unknown;
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

describe("Hono Backend - /store Router", () => {
  let app: Hono<TestEnv>;
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      selectAll: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
      executeTakeFirst: vi.fn().mockResolvedValue(null),
      insertInto: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      updateTable: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      deleteFrom: vi.fn().mockReturnThis(), // Added missing required method
      select: vi.fn().mockReturnThis(), // Added missing required method
    };

    app = new Hono<TestEnv>();
    app.use("*", async (c, next) => {
      c.set("db", mockDb);
      c.set("sessionUser", { id: "admin-1", role: "admin", email: "admin@test.com", name: null, member_type: "mentor" });
      c.env = {
        STRIPE_SECRET_KEY: "sk_test_123",
        STRIPE_WEBHOOK_SECRET: "whsec_123",
        DB: {} as unknown as D1Database,
        ENVIRONMENT: "test",
        DEV_BYPASS: "true",
      } as TestEnv["Bindings"];
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
      expect(mockDb.insertInto).toHaveBeenCalledWith("orders");
      expect(mockDb.values).toHaveBeenCalled();
      expect(mockDb.execute).toHaveBeenCalled();
      
      const valuesArg = (mockDb.values as any).mock.calls[0][0];
      expect(valuesArg.stripe_session_id).toBe("cs_test_123");
      expect(valuesArg.customer_email).toBe("test@example.com");
      expect(valuesArg.total_cents).toBe(1500);
      expect(valuesArg.status).toBe("paid");
      expect(valuesArg.shipping_name).toBe("John Doe");
    });
  });

  describe("GET /store/products", () => {
    it("returns active products", async () => {
      mockDb.execute.mockResolvedValueOnce([
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
      mockDb.execute.mockResolvedValueOnce([
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
      const data = (await res.json()) as StoreResponse;
      expect(data.sessionId).toBe("cs_test_123");
      expect(data.url).toBe("https://stripe.com/checkout/test");
    });
  });
});

