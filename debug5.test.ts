import { expect, test, vi } from 'vitest';

test('alias mock test', async () => {
  const createMockDb = () => {
      const allFn = vi.fn().mockResolvedValue([]);
      const getFn = vi.fn().mockResolvedValue(null);
      const runFn = vi.fn().mockResolvedValue({ success: true });

      const fns = {
        all: allFn,
        get: getFn,
        run: runFn,
        // ALIASES for legacy Kysely compatibility
        execute: allFn,
        executeTakeFirst: getFn,
        first: getFn
      };

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
    };

    const mockDb = createMockDb();
    mockDb.execute.mockRejectedValueOnce(new Error("Missing column"));
    mockDb.all.mockResolvedValueOnce([{ id: "fallback" }]);
    mockDb.get.mockResolvedValueOnce({ value: "sync_date" });

    try {
        await mockDb.select().all();
        console.log("FIRST RESOLVED");
    } catch(e) {
        console.log("FIRST CAUGHT", e.message);
    }
    
    try {
        const res = await mockDb.select().all();
        console.log("SECOND RESOLVED:", res);
    } catch(e) {
        console.log("SECOND CAUGHT", e.message);
    }

    try {
        const res = await mockDb.select().get();
        console.log("THIRD RESOLVED:", res);
    } catch(e) {
        console.log("THIRD CAUGHT", e.message);
    }
});
