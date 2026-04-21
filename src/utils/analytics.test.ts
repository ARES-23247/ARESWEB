import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { trackPageView } from './analytics';

describe('analytics utility', () => {
  const originalFetch = global.fetch;
  const originalLocation = window.location;

  beforeEach(() => {
    // Mock fetch
    global.fetch = vi.fn(() => Promise.resolve({ ok: true } as Response));
    
    // Mock window.location generically (jsdom allows some edits, but we overwrite properties)
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, hostname: 'ares23247.com' }
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation
    });
    vi.restoreAllMocks();
  });

  it('tracks on localhost', async () => {
    window.location.hostname = 'localhost';
    await trackPageView('/docs', 'doc');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('tracks on local 127.0.0.1 loopback', async () => {
    window.location.hostname = '127.0.0.1';
    await trackPageView('/blog', 'blog');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('fires a POST request to the analytics api for external domains', async () => {
    window.location.hostname = 'ares23247.com';
    await trackPageView('/events', 'event');
    
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('/api/analytics/track', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: expect.stringContaining('"category":"event"'),
    }));
  });

  it('fails silently without crashing if the fetch terminates', async () => {
    window.location.hostname = 'ares23247.com';
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));
    
    // Should not throw
    await expect(trackPageView('/crash', 'system')).resolves.not.toThrow();
    expect(consoleSpy).toHaveBeenCalledWith('[Analytics] Failed to log interaction:', expect.any(Error));
  });
});
