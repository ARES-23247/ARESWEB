import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { trackPageView } from './analytics';

describe('analytics utility', () => {
  const originalFetch = globalThis.fetch;
  const originalLocation = window.location;

  beforeEach(() => {
    // Mock fetch
    globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as unknown as Response));

    // Mock window.location generically (jsdom allows some edits, but we overwrite properties)
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, hostname: 'ares23247.com' }
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation
    });
    vi.restoreAllMocks();
  });

  it('tracks on localhost', async () => {
    window.location.hostname = 'localhost';
    await trackPageView('/docs', 'doc');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('tracks on local 127.0.0.1 loopback', async () => {
    window.location.hostname = '127.0.0.1';
    await trackPageView('/blog', 'blog');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('fires a POST request to the analytics api for external domains', async () => {
    window.location.hostname = 'ares23247.com';
    await trackPageView('/events', 'event');

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const callArgs = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(callArgs[0]).toBe('/api/analytics/track');
    expect(callArgs[1]).toMatchObject({
      method: 'POST',
      credentials: 'include',
    });
    // Headers is a Headers object - just check it has the right content type
    expect(callArgs[1]?.headers).toBeInstanceOf(Headers);
    expect((callArgs[1]?.headers as Headers).get('content-type')).toBe('application/json');
    expect(callArgs[1]?.body).toBe(JSON.stringify({ path: '/events', category: 'event', referrer: '' }));
  });

  it('fails silently without crashing if the fetch terminates', async () => {
    window.location.hostname = 'ares23247.com';
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    globalThis.fetch = vi.fn(() => Promise.reject(new Error('Network error')));

    // Should not throw
    await expect(trackPageView('/crash', 'system')).resolves.not.toThrow();
    expect(consoleSpy).toHaveBeenCalledWith('[Analytics] Failed to log interaction:', expect.any(Error));
  });
});
