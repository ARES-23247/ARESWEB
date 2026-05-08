/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dispatchFacebook, dispatchMetaPhoto } from './meta';
import type { SocialConfig, PostPayload } from '../socialSync';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Meta (Facebook/Instagram) Social Integration', () => {
  const payload: PostPayload = {
    title: 'Test Post Title',
    url: 'https://aresfirst.org/blog/test',
    snippet: 'This is a test snippet for the post',
    thumbnail: '/test-image.jpg',
    baseUrl: 'https://aresfirst.org',
  };

  const fullConfig: SocialConfig = {
    FACEBOOK_PAGE_ID: '123456789',
    FACEBOOK_ACCESS_TOKEN: 'test_fb_token',
    INSTAGRAM_ACCOUNT_ID: '987654321',
    INSTAGRAM_ACCESS_TOKEN: 'test_ig_token',
  };

  const partialConfig: SocialConfig = {
    FACEBOOK_PAGE_ID: '123456789',
    FACEBOOK_ACCESS_TOKEN: 'test_fb_token',
  };

  const emptyConfig: SocialConfig = {};

  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('dispatchFacebook()', () => {
    it('returns early if FACEBOOK_PAGE_ID is missing', async () => {
      const config: SocialConfig = { FACEBOOK_ACCESS_TOKEN: 'token' };
      await dispatchFacebook(payload, config);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns early if FACEBOOK_ACCESS_TOKEN is missing', async () => {
      const config: SocialConfig = { FACEBOOK_PAGE_ID: '123' };
      await dispatchFacebook(payload, config);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns early if both credentials are missing', async () => {
      await dispatchFacebook(payload, emptyConfig);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('posts to Facebook Graph API with correct payload', async () => {
      const mockResponse = { ok: true };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      await dispatchFacebook(payload, fullConfig);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://graph.facebook.com/v19.0/123456789/feed',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('includes correct message format with emoji and link', async () => {
      const mockResponse = { ok: true };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      await dispatchFacebook(payload, fullConfig);

      const callArgs = mockFetch.mock.calls[0];
      const body = callArgs[1]?.body as string;

      expect(body).toContain('message=');
      // The emoji is multi-byte, so encoding is different
      expect(body).toContain('New+Update%3A');
      expect(body).toContain('Test+Post+Title');
      expect(body).toContain('This+is+a+test+snippet');
      expect(body).toContain('link=');
      // URL encoding transforms slashes and colons
      expect(body).toContain('link=https%3A%2F%2F');
      expect(body).toContain('aresfirst.org');
      expect(body).toContain('blog');
      expect(body).toContain('test');
      expect(body).toContain('access_token=');
    });

    it('throws error when Facebook API rejects request', async () => {
      const mockResponse = { ok: false, text: async () => 'Invalid OAuth token' };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      await expect(dispatchFacebook(payload, fullConfig)).rejects.toThrow(
        'Facebook API Rejected: Invalid OAuth token'
      );
    });

    it('resolves on successful post', async () => {
      const mockResponse = { ok: true };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      await expect(dispatchFacebook(payload, fullConfig)).resolves.not.toThrow();
    });

    it('uses 5 second timeout for requests', async () => {
      const mockResponse = { ok: true };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      await dispatchFacebook(payload, fullConfig);

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1]?.signal).toBeDefined();
    });
  });

  describe('dispatchMetaPhoto()', () => {
    const imageUrl = 'https://aresfirst.org/gallery/photo.jpg';
    const caption = 'Team photo from competition!';

    it('does nothing if no Instagram or Facebook credentials are configured', async () => {
      const config: SocialConfig = {};

      await dispatchMetaPhoto(imageUrl, caption, config);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('posts photo to Instagram when credentials are present', async () => {
      // Use config with only Instagram credentials
      const igOnlyConfig: SocialConfig = {
        INSTAGRAM_ACCOUNT_ID: '987654321',
        INSTAGRAM_ACCESS_TOKEN: 'test_ig_token',
      };

      // Instagram media creation response
      const createResponse = {
        ok: true,
        json: async () => ({ id: 'instagram_media_id_123' }),
      };
      // Instagram publish response
      const publishResponse = { ok: true };

      mockFetch
        .mockResolvedValueOnce(createResponse as any)
        .mockResolvedValueOnce(publishResponse as any);

      await dispatchMetaPhoto(imageUrl, caption, igOnlyConfig);

      // Verify creation endpoint was called
      expect(mockFetch).toHaveBeenCalledWith(
        'https://graph.facebook.com/v19.0/987654321/media',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
      );

      // Verify publish endpoint was called
      expect(mockFetch).toHaveBeenCalledWith(
        'https://graph.facebook.com/v19.0/987654321/media_publish',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
      );
    });

    it('includes image URL and caption in Instagram creation payload', async () => {
      const igOnlyConfig: SocialConfig = {
        INSTAGRAM_ACCOUNT_ID: '987654321',
        INSTAGRAM_ACCESS_TOKEN: 'test_ig_token',
      };

      const createResponse = {
        ok: true,
        json: async () => ({ id: 'media_id' }),
      };
      const publishResponse = { ok: true };
      mockFetch
        .mockResolvedValueOnce(createResponse as any)
        .mockResolvedValueOnce(publishResponse as any);

      await dispatchMetaPhoto(imageUrl, caption, igOnlyConfig);

      const callArgs = mockFetch.mock.calls[0];
      const body = callArgs[1]?.body as string;

      expect(body).toContain('image_url=');
      expect(body).toContain('https%3A%2F%2F');
      expect(body).toContain('aresfirst.org');
      expect(body).toContain('caption=');
      // URLSearchParams uses + for spaces
      expect(body).toContain('Team+photo+from+competition');
    });

    it('throws error when Instagram media creation fails', async () => {
      const igOnlyConfig: SocialConfig = {
        INSTAGRAM_ACCOUNT_ID: '987654321',
        INSTAGRAM_ACCESS_TOKEN: 'test_ig_token',
      };

      const createResponse = {
        ok: false,
        text: async () => 'Invalid image URL',
      };
      mockFetch.mockResolvedValueOnce(createResponse as any);

      await expect(dispatchMetaPhoto(imageUrl, caption, igOnlyConfig)).rejects.toThrow(
        'Instagram Photo Creation Rejected: Invalid image URL'
      );
    });

    it('throws error when Instagram publish fails', async () => {
      const igOnlyConfig: SocialConfig = {
        INSTAGRAM_ACCOUNT_ID: '987654321',
        INSTAGRAM_ACCESS_TOKEN: 'test_ig_token',
      };

      const createResponse = {
        ok: true,
        json: async () => ({ id: 'media_id' }),
      };
      const publishResponse = {
        ok: false,
        text: async () => 'Publish failed',
      };
      mockFetch
        .mockResolvedValueOnce(createResponse as any)
        .mockResolvedValueOnce(publishResponse as any);

      await expect(dispatchMetaPhoto(imageUrl, caption, igOnlyConfig)).rejects.toThrow(
        'Instagram Photo Publish Rejected: Publish failed'
      );
    });

    it('skips publish if media creation returns no ID', async () => {
      const igOnlyConfig: SocialConfig = {
        INSTAGRAM_ACCOUNT_ID: '987654321',
        INSTAGRAM_ACCESS_TOKEN: 'test_ig_token',
      };

      const createResponse = {
        ok: true,
        json: async () => ({ no_id: 'missing' }),
      };
      mockFetch.mockResolvedValueOnce(createResponse as any);

      await dispatchMetaPhoto(imageUrl, caption, igOnlyConfig);

      // Only creation should be called, not publish
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('posts photo to Facebook when credentials are present', async () => {
      const fbResponse = { ok: true };
      mockFetch.mockResolvedValueOnce(fbResponse as any);

      await dispatchMetaPhoto(imageUrl, caption, partialConfig);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://graph.facebook.com/v19.0/123456789/photos',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
      );
    });

    it('includes URL and message in Facebook photo payload', async () => {
      const fbResponse = { ok: true };
      mockFetch.mockResolvedValueOnce(fbResponse as any);

      await dispatchMetaPhoto(imageUrl, caption, partialConfig);

      const callArgs = mockFetch.mock.calls[0];
      const body = callArgs[1]?.body as string;

      expect(body).toContain('url=');
      expect(body).toContain('https%3A%2F%2F');
      expect(body).toContain('aresfirst.org');
      expect(body).toContain('message=');
      // The message is encoded, spaces become +
      expect(body).toContain('Team+photo+from+competition');
    });

    it('throws error when Facebook photo upload fails', async () => {
      const fbResponse = {
        ok: false,
        text: async () => 'Upload failed',
      };
      mockFetch.mockResolvedValueOnce(fbResponse as any);

      await expect(dispatchMetaPhoto(imageUrl, caption, partialConfig)).rejects.toThrow(
        'Facebook Photo API Rejected: Upload failed'
      );
    });

    it('dispatches to both Instagram and Facebook simultaneously when both configured', async () => {
      const createResponse = {
        ok: true,
        json: async () => ({ id: 'ig_id' }),
      };
      const publishResponse = { ok: true };
      const fbResponse = { ok: true };

      mockFetch
        .mockResolvedValueOnce(createResponse as any)
        .mockResolvedValueOnce(publishResponse as any)
        .mockResolvedValueOnce(fbResponse as any);

      await dispatchMetaPhoto(imageUrl, caption, fullConfig);

      expect(mockFetch).toHaveBeenCalled();
    });

    it('returns Promise.all of all platform promises', async () => {
      const createResponse = {
        ok: true,
        json: async () => ({ id: 'ig_id' }),
      };
      const publishResponse = { ok: true };
      const fbResponse = { ok: true };

      mockFetch
        .mockResolvedValueOnce(createResponse as any)
        .mockResolvedValueOnce(publishResponse as any)
        .mockResolvedValueOnce(fbResponse as any);

      const result = await dispatchMetaPhoto(imageUrl, caption, fullConfig);

      // Should return the result of Promise.all
      expect(result).toBeDefined();
    });
  });
});
