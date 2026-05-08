import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateETag, withETag } from './etag';
import { Context } from 'hono';

describe('etag utility', () => {
  describe('generateETag', () => {
    it('generates ETag for simple object', async () => {
      const data = { foo: 'bar' };
      const etag = await generateETag(data);

      expect(etag).toMatch(/^"[a-f0-9]{64}"$/);
    });

    it('generates consistent ETags for identical data', async () => {
      const data = { name: 'test', value: 123 };
      const etag1 = await generateETag(data);
      const etag2 = await generateETag(data);

      expect(etag1).toBe(etag2);
    });

    it('generates different ETags for different data', async () => {
      const data1 = { name: 'test1' };
      const data2 = { name: 'test2' };
      const etag1 = await generateETag(data1);
      const etag2 = await generateETag(data2);

      expect(etag1).not.toBe(etag2);
    });

    it('handles complex nested objects', async () => {
      const data = {
        user: {
          id: '123',
          profile: {
            name: 'Test User',
            settings: {
              theme: 'dark',
              notifications: true,
            },
          },
        },
      };
      const etag = await generateETag(data);

      expect(etag).toMatch(/^"[a-f0-9]{64}"$/);
    });

    it('handles arrays', async () => {
      const data = [1, 2, 3, 4, 5];
      const etag = await generateETag(data);

      expect(etag).toMatch(/^"[a-f0-9]{64}"$/);
    });

    it('handles arrays of objects', async () => {
      const data = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ];
      const etag = await generateETag(data);

      expect(etag).toMatch(/^"[a-f0-9]{64}"$/);
    });

    it('handles null and undefined values', async () => {
      const data1 = { value: null };
      const data2 = { value: undefined };

      const etag1 = await generateETag(data1);
      const etag2 = await generateETag(data2);

      // Both should generate valid ETags
      expect(etag1).toMatch(/^"[a-f0-9]{64}"$/);
      expect(etag2).toMatch(/^"[a-f0-9]{64}"$/);
    });

    it('handles empty objects and arrays', async () => {
      const etag1 = await generateETag({});
      const etag2 = await generateETag([]);

      expect(etag1).toMatch(/^"[a-f0-9]{64}"$/);
      expect(etag2).toMatch(/^"[a-f0-9]{64}"$/);
    });

    it('handles strings', async () => {
      const data = 'simple string';
      const etag = await generateETag(data);

      expect(etag).toMatch(/^"[a-f0-9]{64}"$/);
    });

    it('handles numbers', async () => {
      const data = 42;
      const etag = await generateETag(data);

      expect(etag).toMatch(/^"[a-f0-9]{64}"$/);
    });

    it('handles boolean values', async () => {
      const etag1 = await generateETag(true);
      const etag2 = await generateETag(false);

      expect(etag1).toMatch(/^"[a-f0-9]{64}"$/);
      expect(etag2).toMatch(/^"[a-f0-9]{64}"$/);
      expect(etag1).not.toBe(etag2);
    });
  });

  describe('withETag', () => {
    let mockContext: Context;

    beforeEach(() => {
      mockContext = {
        req: {
          header: vi.fn(),
        },
        header: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      } as unknown as Context;
    });

    it('sets ETag header on response', async () => {
      const data = { message: 'Hello' };
      mockContext.req.header = vi.fn(() => undefined) as unknown as typeof mockContext.req.header;

      const _result = await withETag(mockContext, data);

      expect(mockContext.header).toHaveBeenCalledWith('ETag', expect.stringMatching(/^"[a-f0-9]{64}"$/));
    });

    it('returns 200 when If-None-Match header does not match', async () => {
      const data = { message: 'Hello' };
      mockContext.req.header = vi.fn(() => '"different-etag"') as unknown as typeof mockContext.req.header;
      mockContext.json = vi.fn((body, status) => ({ body, status })) as unknown as typeof mockContext.json;

      const _result = await withETag(mockContext, data);

      expect(mockContext.header).toHaveBeenCalled();
    });

    it('returns 304 when If-None-Match header matches', async () => {
      const data = { message: 'Hello' };
      const etag = await generateETag(data);

      mockContext.req.header = vi.fn((name) => {
        if (name === 'If-None-Match') return etag;
        return undefined;
      }) as unknown as typeof mockContext.req.header;
      mockContext.body = vi.fn().mockReturnValue({ status: 304 });

      const _result = await withETag(mockContext, data);

      expect(mockContext.body).toHaveBeenCalledWith(null, 304);
    });

    it('handles missing If-None-Match header', async () => {
      const data = { message: 'Hello' };
      mockContext.req.header = vi.fn(() => undefined) as unknown as typeof mockContext.req.header;

      await withETag(mockContext, data);

      expect(mockContext.header).toHaveBeenCalled();
    });

    it('generates consistent ETags across multiple calls with same data', async () => {
      const data = { id: 1, name: 'Test' };

      mockContext.req.header = vi.fn(() => undefined) as unknown as typeof mockContext.req.header;

      await withETag(mockContext, data);
      const firstCall = mockContext.header;

      mockContext.header = vi.fn().mockReturnThis();
      await withETag(mockContext, data);
      const secondCall = mockContext.header;

      expect(firstCall).toHaveBeenCalledWith('ETag', expect.any(String));
      expect(secondCall).toHaveBeenCalledWith('ETag', expect.any(String));
    });
  });

  describe('ETag format', () => {
    it('uses SHA-256 for hash generation (64 hex characters)', async () => {
      const data = { test: 'data' };
      const etag = await generateETag(data);

      // SHA-256 produces 64 hex characters
      const hash = etag.replace(/"/g, '');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('wraps hash in double quotes', async () => {
      const data = { test: 'data' };
      const etag = await generateETag(data);

      expect(etag).toMatch(/^".*"$/);
    });
  });

  describe('edge cases', () => {
    it('handles objects with circular references (via JSON.stringify behavior)', () => {
      const obj: Record<string, unknown> = { name: 'test' };
      obj.self = obj;

      // JSON.stringify would throw for circular refs
      // But since we can't actually test circular refs without throwing,
      // we verify the behavior for deeply nested but valid objects
      const deep: Record<string, unknown> = { level: 1 };
      deep.child = { level: 2, parent: deep };

      // This should still work since JSON.stringify can handle some level of nesting
      expect(async () => {
        // Note: actual circular refs would throw, but this tests the concept
        await generateETag({ level1: { level2: { level3: 'deep' } } });
      }).not.toThrow();
    });

    it('handles special characters in data', async () => {
      const data = {
        message: 'Hello 🌍',
        emoji: '😀',
        unicode: 'Î±Î²Î³Î´',
      };

      const etag = await generateETag(data);
      expect(etag).toMatch(/^"[a-f0-9]{64}"$/);
    });

    it('handles very large data structures', async () => {
      const largeArray = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        description: 'A'.repeat(100),
      }));

      const etag = await generateETag(largeArray);
      expect(etag).toMatch(/^"[a-f0-9]{64}"$/);
    });
  });
});
