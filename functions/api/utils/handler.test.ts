import { describe, it, expect } from 'vitest';
import { typedHandler } from './handler';
import { createRoute, z } from '@hono/zod-openapi';

describe('handler utility', () => {
  describe('typedHandler', () => {
    it('creates a typed handler function', () => {
      const _testRoute = createRoute({
        method: 'post',
        path: '/test',
        responses: {
          200: {
            description: 'Success',
          },
        },
      });

      const result = typedHandler<typeof _testRoute>(async (c) => {
        return c.body(null, 200);
      });

      expect(result).toBeTypeOf('function');
    });

    it('preserves handler type safety', () => {
      const testSchema = z.object({
        name: z.string(),
        email: z.string().email(),
      });

      const _testRoute = createRoute({
        method: 'post',
        path: '/test',
        request: {
          body: {
            content: {
              'application/json': { schema: testSchema },
            },
          },
        },
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': { schema: z.unknown() },
            },
          },
        },
      });

      const result = typedHandler<typeof _testRoute>(async (c) => {
        return c.json({}, 200);
      });

      expect(result).toBeDefined();
      expect(result).toBeTypeOf('function');
    });

    it('works with complex route schemas', () => {
      const complexSchema = z.object({
        limit: z.coerce.number().min(1).max(100),
        offset: z.coerce.number().min(0).default(0),
      });

      const _testRoute = createRoute({
        method: 'get',
        path: '/items',
        request: {
          query: complexSchema,
        },
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': { schema: z.unknown() },
            },
          },
        },
      });

      const result = typedHandler<typeof _testRoute>(async (c) => {
        return c.json({}, 200);
      });

      expect(result).toBeDefined();
    });
  });

  describe('integration with OpenAPIHono', () => {
    it('is compatible with OpenAPIHono router types', () => {
      const _testRoute = createRoute({
        method: 'get',
        path: '/items',
        responses: {
          200: {
            description: 'Success',
          },
        },
      });
      const handler = typedHandler<typeof _testRoute>(async (c) => {
        return c.body(null, 200);
      });

      // Should not throw type errors
      expect(handler).toBeDefined();
    });
  });
});
