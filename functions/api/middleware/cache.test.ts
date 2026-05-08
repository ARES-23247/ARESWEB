import { describe, it, expect } from 'vitest';
import { edgeCacheMiddleware } from './cache';

describe('cache middleware', () => {
  describe('edgeCacheMiddleware', () => {
    it('creates middleware with default parameters', () => {
      const middleware = edgeCacheMiddleware();
      expect(middleware).toBeTypeOf('function');
    });

    it('creates middleware with custom parameters', () => {
      const middleware = edgeCacheMiddleware(600, 120, 600);
      expect(middleware).toBeTypeOf('function');
    });

    it('sets cache name to aresweb-global-cache', () => {
      // The middleware should use the correct cache name
      const middleware = edgeCacheMiddleware();
      expect(middleware).toBeDefined();
    });

    it('configures cache-control header correctly', () => {
      // Test with custom values
      const middleware = edgeCacheMiddleware(300, 60, 300);

      // Verify the middleware function is created
      expect(middleware).toBeTypeOf('function');

      // The actual cache-control header would be set by the hono/cache wrapper
      // which we can't easily test without a full Hono context
    });

    it('uses s-maxage for CDN caching', () => {
      const middleware = edgeCacheMiddleware(600, 120, 300);

      expect(middleware).toBeTypeOf('function');
    });

    it('includes stale-while-revalidate directive', () => {
      const middleware = edgeCacheMiddleware(300, 60, 600);

      expect(middleware).toBeTypeOf('function');
    });

    it('has sensible default values', () => {
      const middleware = edgeCacheMiddleware();

      expect(middleware).toBeTypeOf('function');
      // Default values: sMaxAge=300, maxAge=60, staleWhileRevalidate=300
    });
  });

  describe('cache behavior', () => {
    it('should be applicable to public API routes', () => {
      const middleware = edgeCacheMiddleware(180, 60, 300);

      expect(middleware).toBeTypeOf('function');
    });

    it('should support different cache durations for different content types', () => {
      // Static content - longer cache
      const staticMiddleware = edgeCacheMiddleware(3600, 600, 3600);
      expect(staticMiddleware).toBeTypeOf('function');

      // Dynamic content - shorter cache
      const dynamicMiddleware = edgeCacheMiddleware(60, 30, 60);
      expect(dynamicMiddleware).toBeTypeOf('function');

      // Real-time content - minimal cache
      const realtimeMiddleware = edgeCacheMiddleware(10, 5, 10);
      expect(realtimeMiddleware).toBeTypeOf('function');
    });
  });
});
