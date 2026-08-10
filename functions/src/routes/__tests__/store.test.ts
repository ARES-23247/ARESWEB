import { describe, it, expect, vi, beforeEach } from "vitest";
import storeRouter from "../store";

describe("Store Router Backend Endpoints", () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      body: {},
      user: {
        uid: "user_123",
        email: "test@example.com",
      },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  const getHandler = (path: string, method: string, expectedMiddlewares: string[] = []) => {
    const routeLayer = storeRouter.stack.find(
      (layer) => layer.route && layer.route.path === path && (layer.route as any).methods[method]
    );
    expect(routeLayer).toBeDefined();
    const stack = routeLayer!.route!.stack;
    const middlewareNames = stack.map(layer => layer.name);
    for (const mw of expectedMiddlewares) {
      expect(middlewareNames).toContain(mw);
    }
    return stack[stack.length - 1].handle;
  };

  describe("POST /checkout", () => {
    it("rejects checkout until a verified payment provider is configured", async () => {
      const handler = getHandler("/checkout", "post", ["ensureAuth"]);
      req.body = {
        customerEmail: "customer@example.com",
        items: [
          { productId: "prod_1", quantity: 2, name: "Jersey" },
        ],
        totalCents: 9000,
      };

      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0];
      expect(err.status).toBe(503);
      expect(err.message).toBe("Online checkout is unavailable until a verified payment provider is configured");
      expect(res.json).not.toHaveBeenCalled();
    });
  });
});
