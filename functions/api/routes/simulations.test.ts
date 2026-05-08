import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { simulationsRouter } from "./simulations";
import { AppEnv } from "../middleware";

vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAuth: async (_c: unknown, next: () => Promise<void>) => next(),
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
    }, {
      env: { GITHUB_PAT: "test-pat" } as any,
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
    }, {
      env: { GITHUB_PAT: "test-pat" } as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });

    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.simulation).toBeDefined();
    expect(data.simulation.id).toBe("gist:12345");
  });
});
