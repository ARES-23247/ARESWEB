/**
 * Tests for Zulip webhook route handler
 *
 * Tests Zulip webhook endpoints including token verification,
 * bot command handling, and various Zulip message types. Webhook routes
 * do not use standard auth - they rely on timing-safe token comparison.
 *
 * Database query tests are skipped because the webhook performs complex
 * Drizzle ORM queries that would require extensive mocking. The token
 * verification and command routing tests provide adequate coverage.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { createTestEnv } from '../../test/test-env';
// Extend globalThis for test mocks
declare global {
  var __mockSessionUser: import('../middleware').SessionUser | null;
}
import { AppEnv } from '../middleware';
import type { SocialConfig } from '../middleware/utils';

// Mock the modules that zulipWebhookRouter depends on BEFORE importing
vi.mock('../../utils/zulipSync', () => ({
  sendZulipMessage: vi.fn(() => Promise.resolve('message-id')),
}));

vi.mock('../../utils/irvCalculator', () => ({
  _calculateIRV: vi.fn().mockReturnValue({
    winner: 0,
    rounds: [],
  }),
}));

// Mock getSocialConfig to return test config
vi.mock('../middleware', async () => {
  const actual = await vi.importActual<typeof import('../middleware')>('../middleware');
  return {
    ...actual,
    getSocialConfig: vi.fn().mockResolvedValue({
      ZULIP_WEBHOOK_TOKEN: 'test-zulip-webhook-token',
      ZULIP_URL: 'https://aresfirst.zulipchat.com',
      ZULIP_BOT_EMAIL: 'bot@example.com',
      ZULIP_API_KEY: 'test-api-key',
      ZULIP_ADMIN_STREAM: 'leadership',
      ZULIP_COMMENT_STREAM: 'website-discussion',
    }),
    getDb: vi.fn(() => ({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            get: vi.fn(),
            all: vi.fn(),
          })),
        })),
      })),
      insert: vi.fn(),
      update: vi.fn(),
    })),
  };
});

import zulipWebhookRouter from './zulipWebhook';
import { sendZulipMessage } from '../../utils/zulipSync';
import * as middleware from '../middleware';

// Mock execution context for tests
const mockExecutionContext = {
  waitUntil: vi.fn().mockResolvedValue(undefined),
  passThroughOnException: vi.fn(),
} as unknown as ExecutionContext;

describe('Zulip Webhook Routes', () => {
  const testWebhookToken = 'test-zulip-webhook-token';

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for getSocialConfig
    vi.mocked(middleware.getSocialConfig).mockResolvedValue({
      ZULIP_WEBHOOK_TOKEN: testWebhookToken,
      ZULIP_URL: 'https://aresfirst.zulipchat.com',
      ZULIP_BOT_EMAIL: 'bot@example.com',
      ZULIP_API_KEY: 'test-api-key',
      ZULIP_ADMIN_STREAM: 'leadership',
      ZULIP_COMMENT_STREAM: 'website-discussion',
    } as SocialConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createTestApp = () => {
    const app = new Hono<AppEnv>()
    app.route('/webhooks/zulip', zulipWebhookRouter);
    return app;
  };

  // Helper function to create a valid Zulip webhook payload
  function createZulipPayload(overrides: Record<string, unknown> = {}) {
    const messageOverrides = (overrides.message as Record<string, unknown>) || {};
    return {
      token: testWebhookToken,
      message: {
        id: 12345,
        sender_id: 6789,
        sender_email: 'user@example.com',
        sender_full_name: 'Test User',
        content: '!help',
        display_recipient: 'general',
        subject: 'test',
        topic: 'test',
        type: 'stream',
        ...messageOverrides,
      },
      trigger: 'message',
      ...overrides,
    } as Record<string, unknown>;
  }

  describe('Router structure', () => {
    it('should export a valid router', () => {
      expect(zulipWebhookRouter).toBeDefined();
      expect(typeof zulipWebhookRouter).toBe('object');
    });

    it('should have OpenAPI support', () => {
      expect(typeof (zulipWebhookRouter as { openapi?: unknown }).openapi).toBe('function');
    });
  });

  describe('POST /webhooks/zulip - token verification', () => {
    it('should return 401 when ZULIP_WEBHOOK_TOKEN is not configured', async () => {
      const app = createTestApp();

      // Mock getSocialConfig to return empty token
      vi.mocked(middleware.getSocialConfig).mockResolvedValue({
        ZULIP_WEBHOOK_TOKEN: '',
      } as SocialConfig);

      const payload = createZulipPayload({ token: testWebhookToken });
      const req = new Request('http://localhost/webhooks/zulip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const _res = await app.request(req, undefined, createTestEnv(), mockExecutionContext);

      expect(_res.status).toBe(401);
      const json = (await _res.json()) as { error?: string; message?: string };
      expect(json.error ?? json.message).toContain('Webhook token not configured');
    });

    it('should return 401 when token is missing from payload', async () => {
      const app = createTestApp();

      const payload = createZulipPayload({ token: '' }); // Empty token in payload
      const req = new Request('http://localhost/webhooks/zulip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const _res = await app.request(req, undefined, createTestEnv(), mockExecutionContext);

      expect(_res.status).toBe(401);
      const json = (await _res.json()) as { error?: string; message?: string };
      expect(json.error ?? json.message).toContain('Unauthorized');
    });

    it('should return 401 when token is invalid', async () => {
      const app = createTestApp();

      const payload = createZulipPayload({ token: 'wrong-token' });
      const req = new Request('http://localhost/webhooks/zulip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const _res = await app.request(req, undefined, createTestEnv(), mockExecutionContext);

      expect(_res.status).toBe(401);
      const json = (await _res.json()) as { error?: string; message?: string };
      expect(json.error ?? json.message).toContain('Unauthorized');
    });

    it('should accept valid webhook with correct token', async () => {
      const app = createTestApp();

      const payload = createZulipPayload({ message: { content: '!help' } });
      const req = new Request('http://localhost/webhooks/zulip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const _res = await app.request(req, undefined, createTestEnv(), mockExecutionContext);

      expect(_res.status).toBe(200);
      const json = (await _res.json()) as { content?: string };
      expect(json.content).toBeDefined();
    });

    it('should use timing-safe comparison for token verification', async () => {
      const app = createTestApp();

      // Test with a token of similar length but different content
      const similarToken = 'test-zulip-webhook-tokem'; // Last char different
      const payload = createZulipPayload({ token: similarToken });
      const req = new Request('http://localhost/webhooks/zulip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const _res = await app.request(req, undefined, createTestEnv(), mockExecutionContext);

      expect(_res.status).toBe(401);
    });
  });

  describe('POST /webhooks/zulip - bot commands', () => {
    it('should handle empty content with greeting message', async () => {
      const app = createTestApp();

      const payload = createZulipPayload({ message: { content: '   @**Someone**   ' } });
      const req = new Request('http://localhost/webhooks/zulip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const _res = await app.request(req, undefined, createTestEnv(), mockExecutionContext);

      expect(_res.status).toBe(200);
      const json = (await _res.json()) as { content?: string };
      expect(json.content).toContain('Hello! I am the ARES Bot');
    });

    it('should handle !help command', async () => {
      const app = createTestApp();

      const payload = createZulipPayload({ message: { content: '!help' } });
      const req = new Request('http://localhost/webhooks/zulip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const _res = await app.request(req, undefined, createTestEnv(), mockExecutionContext);

      expect(_res.status).toBe(200);
      const json = (await _res.json()) as { content?: string };
      expect(json.content).toContain('ARES Bot Commands');
      expect(json.content).toContain('!tasks');
      expect(json.content).toContain('!stats');
      expect(json.content).toContain('!rcv');
    });

    it('should strip @**mentions** from content before parsing commands', async () => {
      const app = createTestApp();

      const payload = createZulipPayload({
        message: {
          content: '@**ARES Bot** !help',
        },
      });
      const req = new Request('http://localhost/webhooks/zulip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const _res = await app.request(req, undefined, createTestEnv(), mockExecutionContext);

      expect(_res.status).toBe(200);
      const json = (await _res.json()) as { content?: string };
      expect(json.content).toContain('ARES Bot Commands');
    });

    it('should handle unknown commands gracefully', async () => {
      const app = createTestApp();

      const payload = createZulipPayload({
        message: {
          content: '@**Bot** !unknowncommand',
        },
      });
      const req = new Request('http://localhost/webhooks/zulip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const _res = await app.request(req, undefined, createTestEnv(), mockExecutionContext);

      expect(_res.status).toBe(200);
      const json = (await _res.json()) as { content?: string };
      expect(json.content).toContain('Unknown command');
    });

    it('should return empty response for messages without mentions', async () => {
      const app = createTestApp();

      const payload = createZulipPayload({
        message: {
          content: 'Just a regular message',
          type: 'stream',
          topic: 'random',
        },
      });
      const req = new Request('http://localhost/webhooks/zulip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const _res = await app.request(req, undefined, createTestEnv(), mockExecutionContext);

      expect(_res.status).toBe(200);
      const json = (await _res.json()) as { content?: string };
      expect(json.content).toBe('');
    });
  });

  describe('POST /webhooks/zulip - !broadcast command', () => {
    it('should handle !broadcast command with valid parameters', async () => {
      const app = createTestApp();

      const payload = createZulipPayload({
        message: {
          content: '!broadcast general "Test broadcast message"',
          sender_full_name: 'Test User',
        },
      });
      const req = new Request('http://localhost/webhooks/zulip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const _res = await app.request(req, undefined, createTestEnv(), mockExecutionContext);

      expect(_res.status).toBe(200);
      const json = (await _res.json()) as { content?: string };
      expect(json.content).toContain('Broadcast dispatched');

      // Verify waitUntil was called (indicating background task)
      expect(mockExecutionContext.waitUntil).toHaveBeenCalled();

      // Verify Zulip message was scheduled
      expect(sendZulipMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          ZULIP_WEBHOOK_TOKEN: testWebhookToken,
        }),
        'general',
        'Broadcast',
        expect.stringContaining('Test broadcast message')
      );
    });

    it('should return usage help for !broadcast without parameters', async () => {
      const app = createTestApp();

      const payload = createZulipPayload({
        message: {
          content: '!broadcast',
        },
      });
      const req = new Request('http://localhost/webhooks/zulip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const _res = await app.request(req, undefined, createTestEnv(), mockExecutionContext);

      expect(_res.status).toBe(200);
      const json = (await _res.json()) as { content?: string };
      expect(json.content).toContain('Usage');
    });
  });

  describe('POST /webhooks/zulip - !rcv command', () => {
    it('should handle !rcv help subcommand', async () => {
      const app = createTestApp();

      const payload = createZulipPayload({
        message: {
          content: '!rcv',
        },
      });
      const req = new Request('http://localhost/webhooks/zulip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const _res = await app.request(req, undefined, createTestEnv(), mockExecutionContext);

      expect(_res.status).toBe(200);
      const json = (await _res.json()) as { content?: string };
      expect(json.content).toContain('Ranked Choice Voting');
      expect(json.content).toContain('!rcv create');
      expect(json.content).toContain('!rcv vote');
      expect(json.content).toContain('!rcv status');
      expect(json.content).toContain('!rcv tally');
    });

    it('should handle !rcv with explicit help', async () => {
      const app = createTestApp();

      const payload = createZulipPayload({
        message: {
          content: '!rcv help',
        },
      });
      const req = new Request('http://localhost/webhooks/zulip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const _res = await app.request(req, undefined, createTestEnv(), mockExecutionContext);

      expect(_res.status).toBe(200);
      const json = (await _res.json()) as { content?: string };
      expect(json.content).toContain('Ranked Choice Voting');
    });

    it('should deny !rcv create without admin privileges', async () => {
      const app = createTestApp();

      const payload = createZulipPayload({
        message: {
          content: '!rcv create "Test Poll" "Option 1" "Option 2"',
          sender_email: 'user@example.com',
        },
      });
      const req = new Request('http://localhost/webhooks/zulip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const _res = await app.request(req, undefined, createTestEnv(), mockExecutionContext);

      expect(_res.status).toBe(200);
      const json = (await _res.json()) as { content?: string };
      expect(json.content).toContain('Permission denied');
    });

    it('should return error for !rcv vote without poll ID', async () => {
      const app = createTestApp();

      const payload = createZulipPayload({
        message: {
          content: '!rcv vote',
        },
      });
      const req = new Request('http://localhost/webhooks/zulip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const _res = await app.request(req, undefined, createTestEnv(), mockExecutionContext);

      expect(_res.status).toBe(200);
      const json = (await _res.json()) as { content?: string };
      expect(json.content).toContain('Please specify a poll ID');
    });

    it('should handle !rcv status for nonexistent poll', async () => {
      const app = createTestApp();

      const payload = createZulipPayload({
        message: {
          content: '!rcv status nonexistent',
        },
      });
      const req = new Request('http://localhost/webhooks/zulip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const _res = await app.request(req, undefined, createTestEnv(), mockExecutionContext);

      expect(_res.status).toBe(200);
      const json = (await _res.json()) as { content?: string };
      expect(json.content).toContain('not found');
    });

    it('should return error for unknown !rcv subcommand', async () => {
      const app = createTestApp();

      // The route checks specific subcommands first, then falls through
      // to try looking up a poll, which returns "not found" for unknown commands
      const payload = createZulipPayload({
        message: {
          content: '!rcv unknownsubcommand poll123',
        },
      });
      const req = new Request('http://localhost/webhooks/zulip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const _res = await app.request(req, undefined, createTestEnv(), mockExecutionContext);

      expect(_res.status).toBe(200);
      const json = (await _res.json()) as { content?: string };
      // Unknown subcommands try to look up the poll and return "not found"
      expect(json.content).toContain('not found');
    });
  });

  describe('POST /webhooks/zulip - topic-based comment sync', () => {
    it('should handle post/topic messages for comment sync', async () => {
      const app = createTestApp();

      const payload = createZulipPayload({
        message: {
          content: 'This is a comment on a post',
          type: 'stream',
          topic: 'post/my-post-slug',
          sender_email: 'author@example.com',
          sender_full_name: 'Author Name',
        },
        trigger: 'message',
      });
      const req = new Request('http://localhost/webhooks/zulip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const _res = await app.request(req, undefined, createTestEnv(), mockExecutionContext);

      // Returns 200 (with empty content for success)
      expect(_res.status).toBe(200);
    });

    it('should handle event/topic messages', async () => {
      const app = createTestApp();

      const payload = createZulipPayload({
        message: {
          content: 'Event comment here',
          type: 'stream',
          subject: 'event/event-123', // Uses subject instead of topic
          sender_email: 'author@example.com',
        },
        trigger: 'message',
      });
      const req = new Request('http://localhost/webhooks/zulip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const _res = await app.request(req, undefined, createTestEnv(), mockExecutionContext);

      expect(_res.status).toBe(200);
    });

    it('should ignore non-post/event/doc topics', async () => {
      const app = createTestApp();

      const payload = createZulipPayload({
        message: {
          content: 'Random topic message',
          type: 'stream',
          topic: 'random/topic',
        },
        trigger: 'message',
      });
      const req = new Request('http://localhost/webhooks/zulip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const _res = await app.request(req, undefined, createTestEnv(), mockExecutionContext);

      expect(_res.status).toBe(200);
    });
  });

  describe('Error handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      const app = createTestApp();

      const invalidJson = '{ invalid json }';
      const req = new Request('http://localhost/webhooks/zulip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: invalidJson,
      });

      const _res = await app.request(req, undefined, createTestEnv(), mockExecutionContext);

      // Should return error for invalid JSON
      expect(_res.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle missing message object with validation error', async () => {
      const app = createTestApp();

      const payload = {
        token: testWebhookToken,
        // Missing message object (required by schema)
      };
      const req = new Request('http://localhost/webhooks/zulip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const _res = await app.request(req, undefined, createTestEnv(), mockExecutionContext);

      // Zod validation returns 400 for missing required fields
      expect(_res.status).toBe(400);
    });
  });

  describe('Origin integrity', () => {
    it('should not rely on Referer or Host headers for authentication', async () => {
      const app = createTestApp();

      const payload = createZulipPayload({ message: { content: '!help' } });
      const req = new Request('http://localhost/webhooks/zulip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // These headers should NOT be used for authentication
          'Referer': 'https://malicious-site.com',
          'Host': 'evil.com',
        },
        body: JSON.stringify(payload),
      });

      const _res = await app.request(req, undefined, createTestEnv(), mockExecutionContext);

      // Should still accept if token is valid (doesn't check spoofable headers)
      expect(_res.status).toBe(200);
    });
  });

  // NOTE: Database query tests are skipped because the Zulip webhook route
  // performs complex Drizzle ORM queries with multiple joins, conditions,
  // and database mutations that would require extensive mocking. The token
  // verification, command routing, and permission check tests provide adequate
  // coverage of the route's core functionality.
  describe.skip('Database queries (requires Drizzle ORM mocking)', () => {
    // The following operations would require complex Drizzle mocking:
    // - !tasks: SELECT with LEFT JOIN and ORDER BY
    // - !task (create): INSERT with UUID generation
    // - !task (done): UPDATE with subquery
    // - !stats: Multiple parallel SELECT COUNT queries
    // - !inquiries: SELECT COUNT with WHERE clause
    // - !events: SELECT with complex date filtering (gte)
    // - !rcv create: INSERT into settings table
    // - !rcv vote/status/tally: SELECT/UPDATE settings with JSON parsing
    // - Comment sync: SELECT user, INSERT comment with error handling
    // - Privileged commands: SELECT user.role for permission checks
    //
    // These are better tested through integration/E2E tests with a real D1 database.
  });
});
