import { expect, test, vi } from 'vitest';

test('proxy double mock test', async () => {
  const createMockDb = () => {
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
      const terminalsList = ['all', 'get', 'run', 'execute', 'executeTakeFirst', 'first'];
      for (const m of methods) {
        orig[m] = {};
        for(const k of terminalsList) {
            orig[m][k] = fns[k][m].bind(fns[k]);
        }
      }
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
    };

    const mockDb = createMockDb();
    mockDb.execute.mockRejectedValueOnce(new Error("Missing column"));
    mockDb.execute.mockResolvedValueOnce([{ id: "fallback" }]);

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
});
