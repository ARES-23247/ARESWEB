import { describe, it, expect, vi, beforeEach } from "vitest";
import storeRouter from "../store";
import { adminDb } from "../../lib/firebase-admin";

// Mock Firebase Admin
vi.mock("../../lib/firebase-admin", () => {
  const mockSet = vi.fn();
  const mockDoc = vi.fn().mockImplementation((id) => {
    return {
      set: mockSet,
    };
  });
  const mockCollection = vi.fn().mockImplementation(() => {
    return {
      doc: mockDoc,
    };
  });

  return {
    adminDb: {
      collection: mockCollection,
    },
  };
});

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
    it("should successfully log a valid order to Firestore", async () => {
      const handler = getHandler("/checkout", "post", ["ensureAuth"]);
      req.body = {
        customerEmail: "customer@example.com",
        items: [
          { productId: "prod_1", quantity: 2, name: "Jersey" },
        ],
        totalCents: 9000,
      };

      await handler(req, res, next);

      const mockSet = vi.mocked(adminDb.collection("orders").doc).mock.results[0]?.value?.set;

      expect(res.json).toHaveBeenCalled();
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.success).toBe(true);
      expect(responseData.orderId).toBeDefined();

      expect(mockSet).toHaveBeenCalled();
      const orderArg = vi.mocked(mockSet).mock.calls[0][0];
      expect(orderArg.customerEmail).toBe("test@example.com");
    });

    it("should fail if items list is missing", async () => {
      const handler = getHandler("/checkout", "post", ["ensureAuth"]);
      req.body = {
        customerEmail: "customer@example.com",
        totalCents: 9000,
      };

      await handler(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0];
      expect(err.message).toBe("Missing or empty items list");
    });
  });
});
