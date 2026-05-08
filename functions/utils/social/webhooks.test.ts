/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import {
  dispatchDiscord,
  dispatchDiscordPhoto,
  dispatchSlack,
  dispatchSlackPhoto,
  dispatchTeams,
  dispatchTeamsPhoto,
  dispatchGChat,
  dispatchGChatPhoto,
  dispatchMake,
} from './webhooks';
import type { SocialConfig, PostPayload } from '../socialSync';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock console
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('Webhook Social Integration', () => {
  const payload: PostPayload = {
    title: 'Test Post Title',
    url: 'https://aresfirst.org/blog/test',
    snippet: 'This is a test snippet for the post',
    thumbnail: '/test-image.jpg',
    baseUrl: 'https://aresfirst.org',
  };

  const imageUrl = 'https://aresfirst.org/gallery/photo.jpg';
  const caption = 'Team photo from competition!';

  const discordConfig: SocialConfig = {
    DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/abc123',
  };

  const slackConfig: SocialConfig = {
    SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/ABC/123/xyz',
  };

  const teamsConfig: SocialConfig = {
    TEAMS_WEBHOOK_URL: 'https://outlook.office.com/webhook/abc',
  };

  const gchatConfig: SocialConfig = {
    GCHAT_WEBHOOK_URL: 'https://chat.googleapis.com/v1/spaces/ABC/messages',
  };

  const makeConfig: SocialConfig = {
    MAKE_WEBHOOK_URL: 'https://hook.us1.make.com/abc123',
  };

  const emptyConfig: SocialConfig = {};

  beforeEach(() => {
    mockFetch.mockClear();
    consoleErrorSpy.mockClear();
    // Default mock implementation - return a resolved promise
    mockFetch.mockResolvedValue({ ok: true } as any);
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('validateWebhookUrl()', () => {
    describe('Discord validation', () => {
      it('accepts valid Discord webhook URL', () => {
        // Should not return early (valid URL)
        dispatchDiscord(payload, discordConfig);
        expect(mockFetch).toHaveBeenCalled();
      });

      it('rejects Discord webhook without correct prefix', () => {
        const badConfig: SocialConfig = {
          DISCORD_WEBHOOK_URL: 'https://evil.com/webhook',
        };

        dispatchDiscord(payload, badConfig);
        expect(mockFetch).not.toHaveBeenCalled();
      });

      it('returns early for undefined Discord webhook', () => {
        dispatchDiscord(payload, emptyConfig);
        expect(mockFetch).not.toHaveBeenCalled();
      });
    });

    describe('Slack validation', () => {
      it('accepts valid Slack webhook URL', () => {
        dispatchSlack(payload, slackConfig);
        expect(mockFetch).toHaveBeenCalled();
      });

      it('rejects Slack webhook without correct prefix', () => {
        const badConfig: SocialConfig = {
          SLACK_WEBHOOK_URL: 'https://evil.com/webhook',
        };

        dispatchSlack(payload, badConfig);
        expect(mockFetch).not.toHaveBeenCalled();
      });
    });

    describe('Teams validation', () => {
      it('accepts outlook.office.com webhook URL', () => {
        dispatchTeams(payload, teamsConfig);
        expect(mockFetch).toHaveBeenCalled();
      });

      it('accepts webhook.office.com webhook URL', () => {
        const config: SocialConfig = {
          TEAMS_WEBHOOK_URL: 'https://test.webhook.office.com/webhook',
        };

        dispatchTeams(payload, config);
        expect(mockFetch).toHaveBeenCalled();
      });

      it('rejects Teams webhook with non-HTTPS URL', () => {
        const badConfig: SocialConfig = {
          TEAMS_WEBHOOK_URL: 'http://webhook.office.com/webhook',
        };

        dispatchTeams(payload, badConfig);
        expect(mockFetch).not.toHaveBeenCalled();
      });

      it('rejects Teams webhook with correct domain but wrong format', () => {
        const badConfig: SocialConfig = {
          TEAMS_WEBHOOK_URL: 'https://office.com/webhook',
        };

        dispatchTeams(payload, badConfig);
        expect(mockFetch).not.toHaveBeenCalled();
      });
    });

    describe('Google Chat validation', () => {
      it('accepts valid GChat webhook URL', () => {
        dispatchGChat(payload, gchatConfig);
        expect(mockFetch).toHaveBeenCalled();
      });

      it('rejects GChat webhook without correct prefix', () => {
        const badConfig: SocialConfig = {
          GCHAT_WEBHOOK_URL: 'https://evil.com/webhook',
        };

        dispatchGChat(payload, badConfig);
        expect(mockFetch).not.toHaveBeenCalled();
      });
    });

    describe('Make.com validation', () => {
      it('accepts valid Make webhook URL', () => {
        dispatchMake(payload, makeConfig);
        expect(mockFetch).toHaveBeenCalled();
      });

      it('rejects Make webhook without correct prefix', () => {
        const badConfig: SocialConfig = {
          MAKE_WEBHOOK_URL: 'https://evil.com/webhook',
        };

        dispatchMake(payload, badConfig);
        expect(mockFetch).not.toHaveBeenCalled();
      });
    });
  });

  describe('dispatchDiscord()', () => {
    it('sends POST request to Discord webhook URL', async () => {
      const mockResponse = { ok: true };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      await dispatchDiscord(payload, discordConfig);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/abc123',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('includes embed with ARES branding and post content', async () => {
      const mockResponse = { ok: true };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      await dispatchDiscord(payload, discordConfig);

      const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);

      expect(body.content).toBeNull();
      expect(body.embeds).toHaveLength(1);
      expect(body.embeds[0].title).toBe('🚀 New Web Update: Test Post Title');
      expect(body.embeds[0].description).toBe('This is a test snippet for the post');
      expect(body.embeds[0].url).toBe('https://aresfirst.org/blog/test');
      expect(body.embeds[0].color).toBe(12582912); // ARES Red
      expect(body.embeds[0].author).toEqual({ name: 'ARES 23247 Bot' });
      expect(body.embeds[0].footer).toEqual({ text: 'FIRST Robotics Competition • ARES 23247' });
    });

    it('includes image when thumbnail is provided', async () => {
      const mockResponse = { ok: true };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      await dispatchDiscord(payload, discordConfig);

      const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);

      // The image URL is constructed by replacing '/blog/' with the thumbnail
      expect(body.embeds[0].image).not.toBeNull();
      expect(body.embeds[0].image.url).toContain('test-image.jpg');
    });

    it('uses 5 second timeout', async () => {
      const mockResponse = { ok: true };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      await dispatchDiscord(payload, discordConfig);

      expect(mockFetch.mock.calls[0][1]?.signal).toBeDefined();
    });

    it('logs error on failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await dispatchDiscord(payload, discordConfig);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Discord webhook failed:',
        expect.any(Error)
      );
    });
  });

  describe('dispatchDiscordPhoto()', () => {
    it('sends photo embed to Discord webhook', async () => {
      const mockResponse = { ok: true };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      await dispatchDiscordPhoto(imageUrl, caption, discordConfig);

      const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);

      expect(body.embeds[0]).toMatchObject({
        title: '📸 New ARES Gallery Media',
        description: caption,
        color: 12582912,
        image: { url: imageUrl },
        author: { name: 'ARES 23247 Bot' },
      });
    });
  });

  describe('dispatchSlack()', () => {
    it('sends POST request to Slack webhook URL', async () => {
      const mockResponse = { ok: true };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      await dispatchSlack(payload, slackConfig);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://hooks.slack.com/services/ABC/123/xyz',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('includes formatted text with link', async () => {
      const mockResponse = { ok: true };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      await dispatchSlack(payload, slackConfig);

      const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);

      expect(body.text).toBe(
        '🚀 *New Web Update: Test Post Title*\nThis is a test snippet for the post\n<https://aresfirst.org/blog/test|Read more>'
      );
    });

    it('logs error on failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Slack error'));

      await dispatchSlack(payload, slackConfig);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Slack webhook failed:',
        expect.any(Error)
      );
    });
  });

  describe('dispatchSlackPhoto()', () => {
    it('sends photo using Slack blocks format', async () => {
      const mockResponse = { ok: true };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      await dispatchSlackPhoto(imageUrl, caption, slackConfig);

      const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);

      expect(body.blocks).toEqual([
        {
          type: 'image',
          title: { type: 'plain_text', text: caption },
          image_url: imageUrl,
          alt_text: 'ARES 23247 Broadcast',
        },
      ]);
    });

    it('defaults to "ARES Media" when caption is empty', async () => {
      const mockResponse = { ok: true };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      await dispatchSlackPhoto(imageUrl, '', slackConfig);

      const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);

      expect(body.blocks[0].title.text).toBe('ARES Media');
    });
  });

  describe('dispatchTeams()', () => {
    it('sends POST request to Teams webhook URL', async () => {
      const mockResponse = { ok: true };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      await dispatchTeams(payload, teamsConfig);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://outlook.office.com/webhook/abc',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('uses Adaptive Card format', async () => {
      const mockResponse = { ok: true };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      await dispatchTeams(payload, teamsConfig);

      const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);

      expect(body).toEqual({
        type: 'message',
        attachments: [
          {
            contentType: 'application/vnd.microsoft.card.adaptive',
            content: expect.objectContaining({
              $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
              type: 'AdaptiveCard',
              version: '1.2',
            }),
          },
        ],
      });
    });

    it('includes card body with title and description', async () => {
      const mockResponse = { ok: true };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      await dispatchTeams(payload, teamsConfig);

      const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      const content = body.attachments[0].content;

      expect(content.body[0]).toEqual({
        type: 'TextBlock',
        text: '🚀 New Web Update: Test Post Title',
        weight: 'Bolder',
        size: 'Medium',
      });

      expect(content.body[1]).toEqual({
        type: 'TextBlock',
        text: 'This is a test snippet for the post',
        wrap: true,
      });
    });

    it('includes action button to read more', async () => {
      const mockResponse = { ok: true };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      await dispatchTeams(payload, teamsConfig);

      const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      const action = body.attachments[0].content.actions[0];

      expect(action).toEqual({
        type: 'Action.OpenUrl',
        title: 'Read More',
        url: 'https://aresfirst.org/blog/test',
      });
    });
  });

  describe('dispatchTeamsPhoto()', () => {
    it('sends photo with caption in Adaptive Card', async () => {
      const mockResponse = { ok: true };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      await dispatchTeamsPhoto(imageUrl, caption, teamsConfig);

      const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      const content = body.attachments[0].content;

      expect(content.body).toEqual([
        {
          type: 'TextBlock',
          text: '📸 New ARES Gallery Media',
          weight: 'Bolder',
          size: 'Medium',
        },
        { type: 'Image', url: imageUrl },
        { type: 'TextBlock', text: caption, wrap: true },
      ]);
    });
  });

  describe('dispatchGChat()', () => {
    it('sends POST request to GChat webhook URL', async () => {
      const mockResponse = { ok: true };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      await dispatchGChat(payload, gchatConfig);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://chat.googleapis.com/v1/spaces/ABC/messages',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('includes formatted text with link', async () => {
      const mockResponse = { ok: true };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      await dispatchGChat(payload, gchatConfig);

      const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);

      expect(body.text).toBe(
        '🚀 *New Web Update: Test Post Title*\nThis is a test snippet for the post\nRead more: https://aresfirst.org/blog/test'
      );
    });

    it('throws error when GChat rejects request', async () => {
      const mockResponse = {
        ok: false,
        text: async () => 'Invalid webhook',
      };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      await expect(dispatchGChat(payload, gchatConfig)).rejects.toThrow(
        'GChat Rejected: Invalid webhook'
      );
    });
  });

  describe('dispatchGChatPhoto()', () => {
    it('sends photo using cardsV2 format', async () => {
      const mockResponse = { ok: true };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      await dispatchGChatPhoto(imageUrl, caption, gchatConfig);

      const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);

      expect(body.cardsV2).toEqual([
        {
          cardId: 'photoCard',
          card: {
            header: { title: '📸 New ARES Gallery Media' },
            sections: [
              {
                widgets: [
                  { image: { imageUrl } },
                  { textParagraph: { text: caption } },
                ],
              },
            ],
          },
        },
      ]);
    });

    it('logs error on failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('GChat error'));

      await dispatchGChatPhoto(imageUrl, caption, gchatConfig);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'GChat Photo push failed:',
        expect.any(Error)
      );
    });
  });

  describe('dispatchMake()', () => {
    it('sends POST request to Make webhook URL', async () => {
      const mockResponse = { ok: true };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      await dispatchMake(payload, makeConfig);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://hook.us1.make.com/abc123',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('passes entire payload as JSON body', async () => {
      const mockResponse = { ok: true };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      await dispatchMake(payload, makeConfig);

      const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);

      expect(body).toEqual(payload);
    });

    it('logs error on failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Make error'));

      await dispatchMake(payload, makeConfig);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Make.com webhook failed:',
        expect.any(Error)
      );
    });
  });
});
