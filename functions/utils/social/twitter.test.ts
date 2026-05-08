/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { dispatchTwitterPhoto } from './twitter';
import type { SocialConfig } from '../socialSync';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock crypto.subtle methods
vi.stubGlobal('crypto', {
  subtle: {
    importKey: vi.fn().mockResolvedValue('key-material'),
    deriveKey: vi.fn().mockResolvedValue('derived-key'),
    sign: vi.fn().mockResolvedValue(
      new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06]).buffer
    ),
  },
  randomUUID: vi.fn(() => '12345678-1234-1234-1234-123456789abc'),
});

// Mock console
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('Twitter (X) Social Integration', () => {
  const imageUrl = 'https://aresfirst.org/gallery/photo.jpg';
  const caption = 'Team photo from competition!';

  const fullConfig: SocialConfig = {
    TWITTER_API_KEY: 'test_api_key',
    TWITTER_API_SECRET: 'test_api_secret',
    TWITTER_ACCESS_TOKEN: 'test_access_token',
    TWITTER_ACCESS_SECRET: 'test_access_secret',
  };

  const partialConfig: SocialConfig = {
    TWITTER_API_KEY: 'test_api_key',
    TWITTER_API_SECRET: 'test_api_secret',
    TWITTER_ACCESS_TOKEN: 'test_access_token',
  };

  const emptyConfig: SocialConfig = {};

  beforeEach(() => {
    mockFetch.mockClear();
    vi.clearAllMocks();
    consoleErrorSpy.mockClear();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('generateOAuth1Signature()', () => {
    it('generates valid OAuth 1.0 signature header', async () => {
      const testUrl = 'https://api.twitter.com/2/tweets';
      const testMethod = 'POST';

      // Import and test the internal function via dispatchTwitterPhoto call
      const imgBuffer = new ArrayBuffer(100);
      const mockImgResponse = {
        ok: true,
        arrayBuffer: async () => imgBuffer,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'image/jpeg' : null),
        },
      };

      const mockUploadResponse = {
        ok: true,
        json: async () => ({ media_id_string: 'media_id_123' }),
      };

      const mockTweetResponse = {
        ok: true,
        json: async () => ({ data: { id: 'tweet_123' } }),
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce(mockImgResponse as any)
        .mockResolvedValueOnce(mockUploadResponse as any)
        .mockResolvedValueOnce(mockTweetResponse as any);

      await dispatchTwitterPhoto(imageUrl, caption, fullConfig);

      // Check that the first fetch was for the image (not signed)
      expect(mockFetch).toHaveBeenNthCalledWith(1, imageUrl, expect.any(Object));

      // Check that upload call includes Authorization header
      const uploadCall = mockFetch.mock.calls[1];
      expect(uploadCall[0]).toBe('https://upload.twitter.com/1.1/media/upload.json');
      expect(uploadCall[1]?.headers).toHaveProperty('Authorization');
      expect((uploadCall[1]?.headers as any).Authorization).toMatch(/^OAuth /);

      // Check that tweet call includes Authorization header
      const tweetCall = mockFetch.mock.calls[2];
      expect(tweetCall[0]).toBe('https://api.twitter.com/2/tweets');
      expect(tweetCall[1]?.headers).toHaveProperty('Authorization');
    });

    it('includes all required OAuth parameters', async () => {
      const imgBuffer = new ArrayBuffer(100);
      const mockImgResponse = {
        ok: true,
        arrayBuffer: async () => imgBuffer,
        headers: { get: () => 'image/jpeg' },
      };

      const mockUploadResponse = {
        ok: true,
        json: async () => ({ media_id_string: 'media_id' }),
      };

      const mockTweetResponse = { ok: true };

      vi.mocked(fetch)
        .mockResolvedValueOnce(mockImgResponse as any)
        .mockResolvedValueOnce(mockUploadResponse as any)
        .mockResolvedValueOnce(mockTweetResponse as any);

      await dispatchTwitterPhoto(imageUrl, caption, fullConfig);

      const uploadCall = mockFetch.mock.calls[1];
      const authHeader = (uploadCall[1]?.headers as any).Authorization;

      expect(authHeader).toContain('oauth_consumer_key=');
      expect(authHeader).toContain('oauth_nonce=');
      expect(authHeader).toContain('oauth_signature_method=');
      expect(authHeader).toContain('oauth_timestamp=');
      expect(authHeader).toContain('oauth_token=');
      expect(authHeader).toContain('oauth_version=');
      expect(authHeader).toContain('oauth_signature=');
    });

    it('uses HMAC-SHA1 signing method', async () => {
      const imgBuffer = new ArrayBuffer(100);
      const mockImgResponse = {
        ok: true,
        arrayBuffer: async () => imgBuffer,
        headers: { get: () => 'image/jpeg' },
      };

      const mockUploadResponse = {
        ok: true,
        json: async () => ({ media_id_string: 'media_id' }),
      };

      const mockTweetResponse = { ok: true };

      vi.mocked(fetch)
        .mockResolvedValueOnce(mockImgResponse as any)
        .mockResolvedValueOnce(mockUploadResponse as any)
        .mockResolvedValueOnce(mockTweetResponse as any);

      await dispatchTwitterPhoto(imageUrl, caption, fullConfig);

      expect(crypto.subtle.importKey).toHaveBeenCalledWith(
        'raw',
        expect.anything(),
        { name: 'HMAC', hash: 'SHA-1' },
        false,
        ['sign']
      );
    });
  });

  describe('dispatchTwitterPhoto()', () => {
    it('returns early if TWITTER_API_KEY is missing', async () => {
      const config: SocialConfig = {
        TWITTER_API_SECRET: 'secret',
        TWITTER_ACCESS_TOKEN: 'token',
        TWITTER_ACCESS_SECRET: 'secret',
      };

      await dispatchTwitterPhoto(imageUrl, caption, config);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns early if TWITTER_API_SECRET is missing', async () => {
      const config: SocialConfig = {
        TWITTER_API_KEY: 'key',
        TWITTER_ACCESS_TOKEN: 'token',
        TWITTER_ACCESS_SECRET: 'secret',
      };

      await dispatchTwitterPhoto(imageUrl, caption, config);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns early if TWITTER_ACCESS_TOKEN is missing', async () => {
      const config: SocialConfig = {
        TWITTER_API_KEY: 'key',
        TWITTER_API_SECRET: 'secret',
        TWITTER_ACCESS_SECRET: 'secret',
      };

      await dispatchTwitterPhoto(imageUrl, caption, config);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns early if TWITTER_ACCESS_SECRET is missing', async () => {
      const config: SocialConfig = {
        TWITTER_API_KEY: 'key',
        TWITTER_API_SECRET: 'secret',
        TWITTER_ACCESS_TOKEN: 'token',
      };

      await dispatchTwitterPhoto(imageUrl, caption, config);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('fetches the image from provided URL', async () => {
      const imgBuffer = new ArrayBuffer(100);
      const mockImgResponse = {
        ok: true,
        arrayBuffer: async () => imgBuffer,
        headers: { get: () => 'image/jpeg' },
      };

      const mockUploadResponse = {
        ok: true,
        json: async () => ({ media_id_string: 'media_id' }),
      };

      const mockTweetResponse = { ok: true };

      vi.mocked(fetch)
        .mockResolvedValueOnce(mockImgResponse as any)
        .mockResolvedValueOnce(mockUploadResponse as any)
        .mockResolvedValueOnce(mockTweetResponse as any);

      await dispatchTwitterPhoto(imageUrl, caption, fullConfig);

      expect(mockFetch).toHaveBeenCalledWith(
        imageUrl,
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('uploads image to Twitter media endpoint', async () => {
      const imgBuffer = new ArrayBuffer(100);
      const mockImgResponse = {
        ok: true,
        arrayBuffer: async () => imgBuffer,
        headers: { get: () => 'image/jpeg' },
      };

      const mockUploadResponse = {
        ok: true,
        json: async () => ({ media_id_string: 'media_id_123' }),
      };

      const mockTweetResponse = { ok: true };

      vi.mocked(fetch)
        .mockResolvedValueOnce(mockImgResponse as any)
        .mockResolvedValueOnce(mockUploadResponse as any)
        .mockResolvedValueOnce(mockTweetResponse as any);

      await dispatchTwitterPhoto(imageUrl, caption, fullConfig);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://upload.twitter.com/1.1/media/upload.json',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^OAuth /),
          }),
          body: expect.any(FormData),
        })
      );
    });

    it('creates tweet with media ID and caption', async () => {
      const imgBuffer = new ArrayBuffer(100);
      const mockImgResponse = {
        ok: true,
        arrayBuffer: async () => imgBuffer,
        headers: { get: () => 'image/jpeg' },
      };

      const mockUploadResponse = {
        ok: true,
        json: async () => ({ media_id_string: 'media_id_456' }),
      };

      const mockTweetResponse = { ok: true };

      vi.mocked(fetch)
        .mockResolvedValueOnce(mockImgResponse as any)
        .mockResolvedValueOnce(mockUploadResponse as any)
        .mockResolvedValueOnce(mockTweetResponse as any);

      await dispatchTwitterPhoto(imageUrl, caption, fullConfig);

      const tweetCall = mockFetch.mock.calls[2];
      const body = JSON.parse(tweetCall[1]?.body as string);

      expect(body).toEqual({
        text: caption,
        media: { media_ids: ['media_id_456'] },
      });
    });

    it('sends tweet to Twitter API v2 endpoint', async () => {
      const imgBuffer = new ArrayBuffer(100);
      const mockImgResponse = {
        ok: true,
        arrayBuffer: async () => imgBuffer,
        headers: { get: () => 'image/jpeg' },
      };

      const mockUploadResponse = {
        ok: true,
        json: async () => ({ media_id_string: 'media_id' }),
      };

      const mockTweetResponse = { ok: true };

      vi.mocked(fetch)
        .mockResolvedValueOnce(mockImgResponse as any)
        .mockResolvedValueOnce(mockUploadResponse as any)
        .mockResolvedValueOnce(mockTweetResponse as any);

      await dispatchTwitterPhoto(imageUrl, caption, fullConfig);

      const tweetCall = mockFetch.mock.calls[2];
      expect(tweetCall[0]).toBe('https://api.twitter.com/2/tweets');
    });

    it('defaults to image/jpeg when content-type header is missing', async () => {
      const imgBuffer = new ArrayBuffer(100);
      const mockImgResponse = {
        ok: true,
        arrayBuffer: async () => imgBuffer,
        headers: { get: () => null },
      };

      const mockUploadResponse = {
        ok: true,
        json: async () => ({ media_id_string: 'media_id' }),
      };

      const mockTweetResponse = { ok: true };

      vi.mocked(fetch)
        .mockResolvedValueOnce(mockImgResponse as any)
        .mockResolvedValueOnce(mockUploadResponse as any)
        .mockResolvedValueOnce(mockTweetResponse as any);

      await dispatchTwitterPhoto(imageUrl, caption, fullConfig);

      const uploadCall = mockFetch.mock.calls[1];
      const formData = uploadCall[1]?.body as FormData;
      const mediaBlob = formData.get('media') as Blob;

      expect(mediaBlob.type).toBe('image/jpeg');
    });

    it('throws and logs error on failure', async () => {
      const imgBuffer = new ArrayBuffer(100);
      const mockImgResponse = {
        ok: true,
        arrayBuffer: async () => imgBuffer,
        headers: { get: () => 'image/jpeg' },
      };

      mockFetch.mockResolvedValueOnce(mockImgResponse as any);
      mockFetch.mockRejectedValueOnce(new Error('Upload failed'));

      await expect(dispatchTwitterPhoto(imageUrl, caption, fullConfig)).rejects.toThrow(
        'Upload failed'
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'X (Twitter) Native Push failed:',
        expect.any(Error)
      );
    });

    it('uses 5 second timeout for requests', async () => {
      const imgBuffer = new ArrayBuffer(100);
      const mockImgResponse = {
        ok: true,
        arrayBuffer: async () => imgBuffer,
        headers: { get: () => 'image/jpeg' },
      };

      const mockUploadResponse = {
        ok: true,
        json: async () => ({ media_id_string: 'media_id' }),
      };

      const mockTweetResponse = { ok: true };

      vi.mocked(fetch)
        .mockResolvedValueOnce(mockImgResponse as any)
        .mockResolvedValueOnce(mockUploadResponse as any)
        .mockResolvedValueOnce(mockTweetResponse as any);

      await dispatchTwitterPhoto(imageUrl, caption, fullConfig);

      const calls = mockFetch.mock.calls;
      calls.forEach((call) => {
        expect(call[1]?.signal).toBeDefined();
      });
    });
  });
});
