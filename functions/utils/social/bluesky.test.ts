/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { dispatchBluesky } from './bluesky';
import type { SocialConfig, PostPayload } from '../socialSync';

// Mock @atproto/api
vi.mock('@atproto/api', () => ({
  BskyAgent: vi.fn().mockImplementation(() => ({
    login: vi.fn().mockResolvedValue(undefined),
    post: vi.fn().mockResolvedValue({ uri: 'at://did:plc:123/app.bsky.feed.post/123' }),
    uploadBlob: vi.fn().mockResolvedValue({
      data: {
        blob: {
          $type: 'blob',
          ref: { $link: 'bafkreiabc' },
          mimeType: 'image/jpeg',
        },
      },
    }),
  } as any)),
  RichText: vi.fn().mockImplementation((text) => ({
    text,
    facets: [],
    detectFacets: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock global fetch
global.fetch = vi.fn();

// Mock console methods
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('Bluesky Social Integration', () => {
  const payload: PostPayload = {
    title: 'Test Post Title',
    url: 'https://aresfirst.org/blog/test',
    snippet: 'This is a test snippet for the post that is fairly long',
    thumbnail: 'https://aresfirst.org/images/test.jpg',
    baseUrl: 'https://aresfirst.org',
  };

  const fullConfig: SocialConfig = {
    BLUESKY_HANDLE: 'ares23247.bsky.social',
    BLUESKY_APP_PASSWORD: 'test_app_password',
  };

  const _partialConfig: SocialConfig = {
    BLUESKY_HANDLE: 'ares23247.bsky.social',
  };

  const _emptyConfig: SocialConfig = {};

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy.mockClear();
    consoleWarnSpy.mockClear();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('dispatchBluesky()', () => {
    it('returns early if BLUESKY_HANDLE is missing', async () => {
      const config: SocialConfig = { BLUESKY_APP_PASSWORD: 'password' };
      await dispatchBluesky(payload, config);

      expect(fetch).not.toHaveBeenCalled();
    });

    it('returns early if BLUESKY_APP_PASSWORD is missing', async () => {
      const config: SocialConfig = { BLUESKY_HANDLE: 'handle.bsky.social' };
      await dispatchBluesky(payload, config);

      expect(fetch).not.toHaveBeenCalled();
    });

    it('returns early if both credentials are missing', async () => {
      await dispatchBluesky(payload, _emptyConfig);

      expect(fetch).not.toHaveBeenCalled();
    });

    it('logs in with provided credentials', async () => {
      const mockResponse = { ok: false }; // Image fetch fails
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse as any);

      await dispatchBluesky(payload, fullConfig);

      const { BskyAgent } = await import('@atproto/api');
      const agentMock = vi.mocked(BskyAgent).mock.results[0].value;

      expect(agentMock.login).toHaveBeenCalledWith({
        identifier: 'ares23247.bsky.social',
        password: 'test_app_password',
      });
    });

    it('constructs RichText with prefix, snippet, and suffix', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as any);

      await dispatchBluesky(payload, fullConfig);

      const { RichText } = await import('@atproto/api');

      expect(RichText).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('🚀 New Update:'),
        })
      );
      const calls = vi.mocked(RichText).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]?.text).toContain('Test Post Title');
      expect(lastCall[0]?.text).toContain('Read more:');
      expect(lastCall[0]?.text).toContain('https://aresfirst.org/blog/test');
    });

    it('truncates snippet when exceeding character limit', async () => {
      const longSnippet = 'a'.repeat(300);
      const longPayload: PostPayload = {
        ...payload,
        snippet: longSnippet,
      };

      vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as any);

      await dispatchBluesky(longPayload, fullConfig);

      const { RichText } = await import('@atproto/api');
      const calls = vi.mocked(RichText).mock.calls;
      const lastCall = calls[calls.length - 1];

      // Check that text was truncated
      const text = lastCall[0]?.text as string;
      expect(text).toBeDefined();
      expect(text.length).toBeLessThanOrEqual(300);
    });

    it('sets snippet to empty when prefix and suffix exceed limit', async () => {
      const longTitle = 'a'.repeat(400);
      const longPayload: PostPayload = {
        ...payload,
        title: longTitle,
      };

      vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as any);

      await dispatchBluesky(longPayload, fullConfig);

      const { RichText } = await import('@atproto/api');
      const calls = vi.mocked(RichText).mock.calls;
      const lastCall = calls[calls.length - 1];

      // Check that text still has essential parts
      const text = lastCall[0]?.text as string;
      expect(text).toContain('🚀 New Update:');
      expect(text).toContain('Read more:');
    });

    it('fetches and uploads thumbnail image when available', async () => {
      const imgBuffer = new ArrayBuffer(100);
      const mockImgResponse = {
        ok: true,
        arrayBuffer: async () => imgBuffer,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'image/jpeg' : null),
        },
      };
      vi.mocked(fetch).mockResolvedValueOnce(mockImgResponse as any);

      await dispatchBluesky(payload, fullConfig);

      expect(fetch).toHaveBeenCalledWith(
        'https://aresfirst.org/images/test.jpg',
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('includes image embed when upload succeeds', async () => {
      const imgBuffer = new ArrayBuffer(100);
      const mockImgResponse = {
        ok: true,
        arrayBuffer: async () => imgBuffer,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'image/png' : null),
        },
      };
      vi.mocked(fetch).mockResolvedValueOnce(mockImgResponse as any);

      await dispatchBluesky(payload, fullConfig);

      const { BskyAgent } = await import('@atproto/api');
      const agentMock = vi.mocked(BskyAgent).mock.results[0].value;

      expect(agentMock.uploadBlob).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        { encoding: 'image/png' }
      );
    });

    it('falls back to text-only embed when image fetch fails', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as any);

      await dispatchBluesky(payload, fullConfig);

      const { BskyAgent } = await import('@atproto/api');
      const agentMock = vi.mocked(BskyAgent).mock.results[0].value;

      expect(agentMock.uploadBlob).not.toHaveBeenCalled();
      expect(agentMock.post).toHaveBeenCalledWith(
        expect.objectContaining({
          embed: expect.objectContaining({
            $type: 'app.bsky.embed.external',
            external: expect.objectContaining({
              uri: 'https://aresfirst.org/blog/test',
              title: 'Test Post Title',
            }),
          }),
        })
      );
    });

    it('logs error and continues when image upload fails', async () => {
      const imgBuffer = new ArrayBuffer(100);
      const mockImgResponse = {
        ok: true,
        arrayBuffer: async () => imgBuffer,
        headers: {
          get: (_name: string) => 'image/jpeg',
        },
      };
      vi.mocked(fetch).mockResolvedValueOnce(mockImgResponse as any);

      const { BskyAgent } = await import('@atproto/api');
      vi.mocked(BskyAgent).mockImplementationOnce(() => ({
        login: vi.fn().mockResolvedValue(undefined),
        uploadBlob: vi.fn().mockRejectedValue(new Error('Upload failed')),
        post: vi.fn().mockResolvedValue({ uri: 'at://123' }),
      } as any));

      await dispatchBluesky(payload, fullConfig);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Bluesky image upload failed, proceeding without embed:',
        expect.any(Error)
      );
    });

    it('does not upload image for relative URLs', async () => {
      const relativePayload: PostPayload = {
        ...payload,
        thumbnail: '/relative/path.jpg',
      };

      await dispatchBluesky(relativePayload, fullConfig);

      const { BskyAgent } = await import('@atproto/api');
      const agentMock = vi.mocked(BskyAgent).mock.results[0].value;

      expect(agentMock.uploadBlob).not.toHaveBeenCalled();
    });

    it('retries up to 2 times on UpstreamTimeout errors', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as any);

      const { BskyAgent } = await import('@atproto/api');
      vi.mocked(BskyAgent).mockImplementationOnce(() => ({
        login: vi.fn().mockResolvedValue(undefined),
        post: vi.fn()
          .mockRejectedValueOnce(new Error('UpstreamTimeout'))
          .mockResolvedValueOnce({ uri: 'at://123' }),
      } as any));

      await dispatchBluesky(payload, fullConfig);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Bluesky timeout (attempt 1)')
      );
    });

    it('throws error after max retries for non-timeout errors', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as any);

      const { BskyAgent } = await import('@atproto/api');
      vi.mocked(BskyAgent).mockImplementationOnce(() => ({
        login: vi.fn().mockResolvedValue(undefined),
        post: vi.fn().mockRejectedValue(new Error('Other error')),
      } as any));

      await expect(dispatchBluesky(payload, fullConfig)).rejects.toThrow('Bluesky:');
    });

    it('throws error after max retries even for UpstreamTimeout', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as any);

      const { BskyAgent } = await import('@atproto/api');
      vi.mocked(BskyAgent).mockImplementationOnce(() => ({
        login: vi.fn().mockResolvedValue(undefined),
        post: vi.fn().mockRejectedValue(new Error('UpstreamTimeout')),
      } as any));

      await expect(dispatchBluesky(payload, fullConfig)).rejects.toThrow('Bluesky:');
    });

    it('waits 1500ms between timeout retries', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as any);

      const { BskyAgent } = await import('@atproto/api');
      vi.mocked(BskyAgent).mockImplementationOnce(() => ({
        login: vi.fn().mockResolvedValue(undefined),
        post: vi.fn()
          .mockRejectedValueOnce(new Error('UpstreamTimeout'))
          .mockResolvedValueOnce({ uri: 'at://123' }),
      } as any));

      const startTime = Date.now();
      await dispatchBluesky(payload, fullConfig);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(1400);
    });

    it('logs error on syndication failure', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as any);

      const { BskyAgent } = await import('@atproto/api');
      vi.mocked(BskyAgent).mockImplementationOnce(() => ({
        login: vi.fn().mockResolvedValue(undefined),
        post: vi.fn().mockRejectedValue(new Error('Syndication failed')),
      } as any));

      await expect(dispatchBluesky(payload, fullConfig)).rejects.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Bluesky syndication failed:',
        expect.any(String)
      );
    });

    it('posts with facets and embed', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as any);

      await dispatchBluesky(payload, fullConfig);

      const { BskyAgent, RichText } = await import('@atproto/api');
      const agentMock = vi.mocked(BskyAgent).mock.results[0].value;
      const rtMock = vi.mocked(RichText).mock.results[0].value;

      expect(agentMock.post).toHaveBeenCalledWith(
        expect.objectContaining({
          text: rtMock.text,
          facets: rtMock.facets,
          embed: expect.any(Object),
          createdAt: expect.any(String),
        })
      );
    });

    it('resolves on successful post', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as any);

      await expect(dispatchBluesky(payload, fullConfig)).resolves.not.toThrow();
    });
  });
});
