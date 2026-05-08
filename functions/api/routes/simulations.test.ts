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
        return (resolve, reject) => Promise.resolve(fns.all()).then(resolve).catch(reject);
      }
      if (prop === 'catch') {
        return (reject) => Promise.resolve(fns.all()).catch(reject);
      }
      if (prop === 'finally') {
        return (cb) => Promise.resolve(fns.all()).finally(cb);
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
      if (prop === 'transaction') return vi.fn(async (cb) => cb(chainable));
      if (typeof prop === 'symbol') return chainable;
      target[prop] = vi.fn().mockReturnValue(chainable);
      return target[prop];
    }
  });
  return chainable;
};

const mockDb = createMockDb();

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { simulationsRouter } from "./simulations";
import { AppEnv } from "../middleware";

vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAuth: async (_c: unknown, next: () => Promise<void>) => next(),
    getDb: () => mockDb,
  };
});

describe("simulationsRouter", () => {
  let app: Hono<AppEnv>;

  beforeEach(() => {
    app = new Hono<AppEnv>();
    app.route("/", simulationsRouter);
    vi.stubGlobal("fetch", vi.fn());
  });

  it("should list simulations", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ simulators: [{ id: "test-sim", name: "Test Sim" }] }),
    } as any);

    const res = await app.request("/", {
      method: "GET"
    }, { GITHUB_PAT: "test-pat" } as any, {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    
    });

    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.simulations).toBeDefined();
    expect(data.simulations.length).toBe(1);
    expect(data.simulations[0].id).toBe("github:test-sim");
  });

  it("should get a gist simulation", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        description: "Test Gist",
        files: { "index.tsx": { content: "console.log('test');" } },
        owner: { login: "test-user" },
        public: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }),
    } as any);

    const res = await app.request("/gist/12345", {
      method: "GET"
    }, { GITHUB_PAT: "test-pat" } as any, {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    
    });

    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.simulation).toBeDefined();
    expect(data.simulation.id).toBe("gist:12345");
  });
});
