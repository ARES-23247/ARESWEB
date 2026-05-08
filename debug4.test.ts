import { expect, test, vi } from 'vitest';

test('shared terminal mock', async () => {
  const createMockDb = () => {
      const sharedFn = vi.fn();
      const defaultReturns = {
          all: [],
          get: null,
          run: { success: true },
          execute: [],
          executeTakeFirst: null,
          first: null
      };
      
      const fns = {
          all: (...args) => sharedFn('all', ...args),
          get: (...args) => sharedFn('get', ...args),
          run: (...args) => sharedFn('run', ...args),
          execute: (...args) => sharedFn('execute', ...args),
          executeTakeFirst: (...args) => sharedFn('executeTakeFirst', ...args),
          first: (...args) => sharedFn('first', ...args)
      };

      // Wait, if fns.all is a normal function, we can't do fns.all.mockResolvedValueOnce!
      // We have to bind the mock methods!
  };
});
