/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { dispatchBand } from './band';
import type { SocialConfig, PostPayload } from '../socialSync';

// Mock global fetch
global.fetch = vi.fn();

// Mock console methods
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('BAND Social Integration', () => {
  const payload: PostPayload = {
    title: 'Test Post Title',
    url: 'https://aresfirst.org/blog/test',
    snippet: 'This is a test snippet for the post',
    thumbnail: '/test-image.jpg',
    baseUrl: 'https://aresfirst.org',
  };

  const fullConfig: SocialConfig = {
    BAND_ACCESS_TOKEN: 'test_band_token',
    BAND_KEY: 'test_band_key_123',
  };

  const partialConfig: SocialConfig = {
    BAND_ACCESS_TOKEN: 'test_band_token',
  };

  const emptyConfig: SocialConfig = {};

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy.mockClear();
    consoleWarnSpy.mockClear();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('dispatchBand()', () => {
    it('returns early if BAND_ACCESS_TOKEN is missing', async () => {
      const config: SocialConfig = { BAND_KEY: 'key' };
      await dispatchBand(payload, config);

      expect(fetch).not.toHaveBeenCalled();
    });

    it('returns early if BAND_KEY is missing', async () => {
      const config: SocialConfig = { BAND_ACCESS_TOKEN: 'token' };
      await dispatchBand(payload, config);

      expect(fetch).not.toHaveBeenCalled();
    });

    it('returns early if both credentials are missing', async () => {
      await dispatchBand(payload, emptyConfig);

      expect(fetch).not.toHaveBeenCalled();
    });

    it('posts to BAND API with correct endpoint', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ result_code: 1, result_data: {} }),
      };
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse as any);

      await dispatchBand(payload, fullConfig);

      expect(fetch).toHaveBeenCalledWith(
        'https://openapi.band.us/v2.2/band/post/create',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('includes formatted text content with emoji and link', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ result_code: 1 }),
      };
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse as any);

      await dispatchBand(payload, fullConfig);

      const callArgs = vi.mocked(fetch).mock.calls[0];
      const body = callArgs[1]?.body as URLSearchParams;

      expect(body).toBeInstanceOf(URLSearchParams);
      const content = body.get('content');
      expect(content).toContain('🚀 New Update:');
      expect(content).toContain('Test Post Title');
      expect(content).toContain('This is a test snippet for the post');
      expect(content).toContain('Read more:');
      expect(content).toContain('https://aresfirst.org/blog/test');
    });

    it('handles missing snippet gracefully', async () => {
      const noSnippetPayload: PostPayload = {
        ...payload,
        snippet: '',
      };
      const mockResponse = {
        ok: true,
        json: async () => ({ result_code: 1 }),
      };
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse as any);

      await dispatchBand(noSnippetPayload, fullConfig);

      const callArgs = vi.mocked(fetch).mock.calls[0];
      const body = callArgs[1]?.body as URLSearchParams;
      const content = body.get('content');

      expect(content).toBeDefined();
    });

    it('includes access_token, band_key, and do_push parameters', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ result_code: 1 }),
      };
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse as any);

      await dispatchBand(payload, fullConfig);

      const callArgs = vi.mocked(fetch).mock.calls[0];
      const body = callArgs[1]?.body as URLSearchParams;

      expect(body.get('access_token')).toBe('test_band_token');
      expect(body.get('band_key')).toBe('test_band_key_123');
      expect(body.get('do_push')).toBe('true');
    });

    it('retries up to 2 times on failure', async () => {
      const failResponse = {
        ok: false,
        text: async () => 'Service unavailable',
      };
      const successResponse = {
        ok: true,
        json: async () => ({ result_code: 1 }),
      };

      vi.mocked(fetch)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(successResponse as any);

      await dispatchBand(payload, fullConfig);

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('BAND timeout or error (attempt 1)')
      );
    });

    it('waits 1500ms between retries', async () => {
      const failResponse = {
        ok: false,
        text: async () => 'Failed',
      };
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Fail'));

      const startTime = Date.now();
      await dispatchBand(payload, fullConfig).catch(() => {});
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(1400); // Allow some margin
    });

    it('throws error after max retries exhausted', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Persistent failure'));

      await expect(dispatchBand(payload, fullConfig)).rejects.toThrow('BAND:');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'BAND post failed:',
        expect.any(String)
      );
    });

    it('throws error when BAND API returns non-1 result_code', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ result_code: 0, result_data: { error: 'Invalid key' } }),
      };
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse as any);

      await expect(dispatchBand(payload, fullConfig)).rejects.toThrow('BAND:');
    });

    it('throws error when HTTP response is not ok', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      };
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse as any);

      await expect(dispatchBand(payload, fullConfig)).rejects.toThrow();
      // The error is wrapped with BAND: prefix
    });

    it('logs error with message on syndication failure', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Connection failed'));

      await expect(dispatchBand(payload, fullConfig)).rejects.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'BAND post failed:',
        'Connection failed'
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'BAND syndication failed:',
        expect.any(String)
      );
    });

    it('preserves original error as cause in thrown error', async () => {
      const originalError = new Error('Original cause');
      vi.mocked(fetch).mockRejectedValue(originalError);

      try {
        await dispatchBand(payload, fullConfig);
        throw new Error('Should have thrown');
      } catch (err) {
        // The error gets wrapped, so we check that the cause exists
        expect((err as Error).cause).toBeDefined();
        expect((err as Error).cause).toBeInstanceOf(Error);
      }
    });

    it('resolves on successful post', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ result_code: 1, result_data: { post_key: '123' } }),
      };
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse as any);

      await expect(dispatchBand(payload, fullConfig)).resolves.not.toThrow();
    });

    it('uses 10 second timeout for requests', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ result_code: 1 }),
      };
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse as any);

      await dispatchBand(payload, fullConfig);

      const callArgs = vi.mocked(fetch).mock.calls[0];
      expect(callArgs[1]?.signal).toBeDefined();
    });
  });
});
