import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import storeRouter from "./store";

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
        constructEvent: vi.fn((rawBody, signature, secret) => {
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
  let app: Hono;
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      selectAll: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
      insertInto: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      updateTable: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis()
    };

    app = new Hono();
    app.use("*", async (c, next) => {
      c.set("db", mockDb);
      c.set("sessionUser", { id: "admin-1", role: "admin" });
      c.env = {
        STRIPE_SECRET_KEY: "sk_test_123",
        STRIPE_WEBHOOK_SECRET: "whsec_123"
      };
      await next();
    });
    app.route("/", storeRouter);
  });

  describe("POST /webhook", () => {
    it("returns 400 if signature is missing", async () => {
      const res = await app.request("/webhook", {
        method: "POST",
        body: JSON.stringify({ type: "checkout.session.completed" })
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Missing stripe signature");
    });

    it("returns 400 if signature is invalid", async () => {
      const res = await app.request("/webhook", {
        method: "POST",
        headers: {
          "stripe-signature": "invalid"
        },
        body: JSON.stringify({ type: "checkout.session.completed" })
      });
      expect(res.status).toBe(400);
      const data = await res.json();
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

      const res = await app.request("/webhook", {
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
      
      const valuesArg = mockDb.values.mock.calls[0][0];
      expect(valuesArg.stripe_session_id).toBe("cs_test_123");
      expect(valuesArg.customer_email).toBe("test@example.com");
      expect(valuesArg.total_cents).toBe(1500);
      expect(valuesArg.status).toBe("paid");
      expect(valuesArg.shipping_name).toBe("John Doe");
    });
  });

  describe("GET /api/store/products", () => {
    it("returns active products", async () => {
      mockDb.execute.mockResolvedValueOnce([
        { id: "prod_1", name: "T-Shirt", active: 1, price_cents: 2000 }
      ]);
      const res = await app.request("/api/store/products");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe("prod_1");
    });
  });

  describe("POST /api/store/checkout", () => {
    it("creates a checkout session", async () => {
      mockDb.execute.mockResolvedValueOnce([
        { id: "prod_1", name: "T-Shirt", active: 1, price_cents: 2000 }
      ]);

      const res = await app.request("/api/store/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ productId: "prod_1", quantity: 1 }],
          successUrl: "http://localhost/success",
          cancelUrl: "http://localhost/cancel"
        })
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.sessionId).toBe("cs_test_123");
      expect(data.url).toBe("https://stripe.com/checkout/test");
    });
  });
});
