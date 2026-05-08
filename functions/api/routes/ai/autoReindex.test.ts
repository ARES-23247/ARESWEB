import { describe, it, expect, vi, beforeEach } from "vitest";
import { triggerBackgroundReindex } from "./autoReindex";
import type { VectorizeIndex, Ai } from "@cloudflare/workers-types";

vi.mock("../middleware", () => ({
  ensureAdmin: async (_c: unknown, next: () => Promise<void>) => next(),
  logAuditAction: vi.fn().mockResolvedValue(true),
  rateLimitMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
  persistentRateLimitMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
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
    promises,
  };
}

// Simple inline mock database
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
    };

describe("triggerBackgroundReindex", () => {
  let mockExecutionCtx: ReturnType<typeof createMockExecutionContext>;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockAi: { run: ReturnType<typeof vi.fn> };
  let mockVectorize: { upsert: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecutionCtx = createMockExecutionContext();
    mockDb = createMockDb();
    mockAi = { run: vi.fn() };
    mockVectorize = { upsert: vi.fn() };
  });

  it("no-ops when AI binding is undefined", () => {
    triggerBackgroundReindex(
      mockExecutionCtx,
      mockDb as unknown as Parameters<typeof triggerBackgroundReindex>[1],
      undefined,
      mockVectorize as unknown as VectorizeIndex
    );

    expect(mockExecutionCtx.waitUntil).not.toHaveBeenCalled();
  });

  it("no-ops when Vectorize binding is undefined", () => {
    triggerBackgroundReindex(
      mockExecutionCtx,
      mockDb as unknown as Parameters<typeof triggerBackgroundReindex>[1],
      mockAi as unknown as Ai,
      undefined
    );

    expect(mockExecutionCtx.waitUntil).not.toHaveBeenCalled();
  });

  it("calls waitUntil with a promise when bindings are present", () => {
    triggerBackgroundReindex(
      mockExecutionCtx,
      mockDb as unknown as Parameters<typeof triggerBackgroundReindex>[1],
      mockAi as unknown as Ai,
      mockVectorize as unknown as VectorizeIndex
    );

    expect(mockExecutionCtx.waitUntil).toHaveBeenCalledTimes(1);
    expect(mockExecutionCtx.waitUntil).toHaveBeenCalledWith(expect.any(Promise));
  });

  it("does not throw when AI and Vectorize are present (fire-and-forget)", () => {
    expect(() => {
      triggerBackgroundReindex(
        mockExecutionCtx,
        mockDb as unknown as Parameters<typeof triggerBackgroundReindex>[1],
        mockAi as unknown as Ai,
        mockVectorize as unknown as VectorizeIndex
      );
    }).not.toThrow();
  });

  it("works without KV (optional parameter)", () => {
    triggerBackgroundReindex(
      mockExecutionCtx,
      mockDb as unknown as Parameters<typeof triggerBackgroundReindex>[1],
      mockAi as unknown as Ai,
      mockVectorize as unknown as VectorizeIndex
    );

    expect(mockExecutionCtx.waitUntil).toHaveBeenCalledTimes(1);
  });
});
