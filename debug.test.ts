import { expect, test, vi } from 'vitest';

test('proxy test', async () => {
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
  for (const key of Object.keys(fns)) {
    for (const m of methods) {
      fns[key][m] = (...args) => {
        for (const k of Object.keys(fns)) {
          orig[m][k](...args);
        }
        return fns[key];
      };
    }
  }

  const chainable = new Proxy(fns, {
    get: (target, prop) => {
      if (prop === 'then') return undefined;
      if (prop in target) return target[prop];
      target[prop] = vi.fn().mockReturnValue(chainable);
      return target[prop];
    }
  });

  try {
    const res = await chainable.someUnmockedMethod();
    console.log("RESOLVED:", typeof res);
    for (const item of res) {
        console.log(item);
    }
  } catch(e) {
    console.log("CAUGHT:", e.message);
  }
});
