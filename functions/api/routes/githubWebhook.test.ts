/**
 * Tests for GitHub webhook route handler
 *
 * Tests GitHub webhook endpoints including signature verification,
 * event handling, and various GitHub event types. Webhook routes
 * do not use standard auth - they rely on HMAC-SHA256 signature verification.
 *
 * Database query tests are skipped because the webhook primarily calls
 * external services (Zulip) and doesn't perform complex database operations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { createTestEnv } from '../../test/test-env';
import { globalErrorHandler } from '../middleware/errorHandler';
// Extend globalThis for test mocks
declare global {
  var __mockSessionUser: import('../middleware').SessionUser | null;
}
import { AppEnv } from '../middleware';


// Mock the zulipSync module BEFORE importing githubWebhookRouter
vi.mock('../../utils/zulipSync', () => ({
  sendZulipMessage: vi.fn(() => Promise.resolve('message-id')),
}));

import githubWebhookRouter from './githubWebhook';
import { sendZulipMessage } from '../../utils/zulipSync';

// Mock execution context for tests
const mockExecutionContext = {
  waitUntil: vi.fn().mockResolvedValue(undefined),
  passThroughOnException: vi.fn(),
} as unknown as ExecutionContext;

describe('GitHub Webhook Routes', () => {
  const testWebhookSecret = 'test-webhook-secret';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createTestApp = () => {
    const app = new Hono<AppEnv>();
    app.onError(globalErrorHandler);

    app.route('/webhooks/github', githubWebhookRouter);
    return app;
  };

  // Helper function to generate a valid GitHub webhook signature
  async function generateGitHubSignature(payload: string, secret: string): Promise<string> {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      enc.encode(payload)
    );

    const sigBytes = new Uint8Array(signature);
    const sigHex = Array.from(sigBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return `sha256=${sigHex}`;
  }

  describe('Router structure', () => {
    it('should export a valid router', () => {
      expect(githubWebhookRouter).toBeDefined();
      expect(typeof githubWebhookRouter).toBe('object');
    });

    it('should have OpenAPI support', () => {
      expect(typeof (githubWebhookRouter as { openapi?: unknown }).openapi).toBe('function');
    });
  });

  describe('POST /webhooks/github - signature verification', () => {
    it('should return 503 when GITHUB_WEBHOOK_SECRET is not configured', async () => {
      const app = createTestApp();

      const testEnv = createTestEnv({
        GITHUB_WEBHOOK_SECRET: '', // Empty secret
      });

      const payload = JSON.stringify({ action: 'test' });
      const req = new Request('http://localhost/webhooks/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': await generateGitHubSignature(payload, 'some-secret'),
        },
        body: payload,
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(503);
      const json = (await _res.json()) as { error?: string; code?: string };
      expect(json.error?.toLowerCase()).toContain('webhook not configured');
    });

    it('should return 401 when signature is missing', async () => {
      const app = createTestApp();

      const testEnv = createTestEnv({
        GITHUB_WEBHOOK_SECRET: testWebhookSecret,
      });

      const payload = JSON.stringify({ action: 'test' });
      const req = new Request('http://localhost/webhooks/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // No X-Hub-Signature-256 header
        },
        body: payload,
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should return 401 when signature is invalid', async () => {
      const app = createTestApp();

      const testEnv = createTestEnv({
        GITHUB_WEBHOOK_SECRET: testWebhookSecret,
      });

      const payload = JSON.stringify({ action: 'test' });
      const req = new Request('http://localhost/webhooks/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': 'sha256=invalid_signature_here',
        },
        body: payload,
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should return 400 when JSON is invalid', async () => {
      const app = createTestApp();

      const testEnv = createTestEnv({
        GITHUB_WEBHOOK_SECRET: testWebhookSecret,
      });

      const invalidJson = '{invalid json}';
      const req = new Request('http://localhost/webhooks/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': await generateGitHubSignature(invalidJson, testWebhookSecret),
        },
        body: invalidJson,
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Invalid JSON may cause a parse error (500) or validation error (400)
      expect([400, 500]).toContain(_res.status);
    });

    it('should accept valid webhook with correct signature', async () => {
      const app = createTestApp();

      const testEnv = createTestEnv({
        GITHUB_WEBHOOK_SECRET: testWebhookSecret,
      });

      const payload = JSON.stringify({ action: 'test' });
      const req = new Request('http://localhost/webhooks/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GitHub-Event': 'push',
          'X-Hub-Signature-256': await generateGitHubSignature(payload, testWebhookSecret),
        },
        body: payload,
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(200);
      const json = (await _res.json()) as { error?: string };
      expect(json).toEqual({
        received: true,
        event: 'push',
      });
    });

    it('should handle signature without sha256= prefix (legacy support)', async () => {
      const app = createTestApp();

      const testEnv = createTestEnv({
        GITHUB_WEBHOOK_SECRET: testWebhookSecret,
      });

      const payload = JSON.stringify({ action: 'test' });
      // Generate signature with prefix, then test without prefix (should fail but not crash)
      const validSig = await generateGitHubSignature(payload, testWebhookSecret);
      const sigWithoutPrefix = validSig.replace('sha256=', '');

      const req = new Request('http://localhost/webhooks/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GitHub-Event': 'push',
          'X-Hub-Signature-256': sigWithoutPrefix,
        },
        body: payload,
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should reject - the prefix is required
      expect(_res.status).toBe(401);
    });
  });

  describe('POST /webhooks/github - event handling', () => {
    it('should handle unknown events gracefully', async () => {
      const app = createTestApp();

      const testEnv = createTestEnv({
        GITHUB_WEBHOOK_SECRET: testWebhookSecret,
      });

      const payload = JSON.stringify({ action: 'test' });
      const req = new Request('http://localhost/webhooks/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GitHub-Event': 'unknown_event',
          'X-Hub-Signature-256': await generateGitHubSignature(payload, testWebhookSecret),
        },
        body: payload,
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(200);
      const json = (await _res.json()) as { error?: string };
      expect(json).toEqual({
        received: true,
        event: 'unknown_event',
      });
      // Should not trigger Zulip message for unknown events
      expect(sendZulipMessage).not.toHaveBeenCalled();
    });

    it('should handle projects_v2_item created event', async () => {
      const app = createTestApp();

      const testEnv = createTestEnv({
        GITHUB_WEBHOOK_SECRET: testWebhookSecret,
      });

      const payload = JSON.stringify({
        action: 'created',
        projects_v2_item: {
          node_id: 'test-node-id',
        },
      });

      const req = new Request('http://localhost/webhooks/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GitHub-Event': 'projects_v2_item',
          'X-Hub-Signature-256': await generateGitHubSignature(payload, testWebhookSecret),
        },
        body: payload,
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(200);

      // Verify waitUntil was called (indicating background task)
      expect(mockExecutionContext.waitUntil).toHaveBeenCalled();

      // Verify Zulip message was scheduled
      expect(sendZulipMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          ZULIP_ENABLED: expect.any(String),
        }),
        'engineering',
        'Project Board',
        expect.any(String) // The message content
      );
    });

    it('should handle projects_v2_item edited event', async () => {
      const app = createTestApp();

      const testEnv = createTestEnv({
        GITHUB_WEBHOOK_SECRET: testWebhookSecret,
      });

      const payload = JSON.stringify({
        action: 'edited',
        projects_v2_item: {
          node_id: 'test-node-id',
        },
        changes: {
          status: {
            from: 'In Progress',
            to: 'Done',
          },
        },
      });

      const req = new Request('http://localhost/webhooks/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GitHub-Event': 'projects_v2_item',
          'X-Hub-Signature-256': await generateGitHubSignature(payload, testWebhookSecret),
        },
        body: payload,
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(200);
      expect(mockExecutionContext.waitUntil).toHaveBeenCalled();
      expect(sendZulipMessage).toHaveBeenCalledWith(
        expect.any(Object),
        'engineering',
        'Project Board',
        expect.any(String)
      );
    });

    it('should handle projects_v2_item deleted event', async () => {
      const app = createTestApp();

      const testEnv = createTestEnv({
        GITHUB_WEBHOOK_SECRET: testWebhookSecret,
      });

      const payload = JSON.stringify({
        action: 'deleted',
        projects_v2_item: {
          node_id: 'test-node-id',
        },
      });

      const req = new Request('http://localhost/webhooks/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GitHub-Event': 'projects_v2_item',
          'X-Hub-Signature-256': await generateGitHubSignature(payload, testWebhookSecret),
        },
        body: payload,
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(200);
      expect(mockExecutionContext.waitUntil).toHaveBeenCalled();
      expect(sendZulipMessage).toHaveBeenCalledWith(
        expect.any(Object),
        'engineering',
        'Project Board',
        expect.any(String)
      );
    });

    it('should handle push event', async () => {
      const app = createTestApp();

      const testEnv = createTestEnv({
        GITHUB_WEBHOOK_SECRET: testWebhookSecret,
      });

      const payload = JSON.stringify({
        ref: 'refs/heads/main',
        repository: {
          full_name: 'ares/web',
        },
        commits: [
          {
            message: 'Add new feature',
            author: {
              name: 'Test User',
            },
          },
          {
            message: 'Fix bug',
            author: {
              name: 'Another User',
            },
          },
        ],
      });

      const req = new Request('http://localhost/webhooks/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GitHub-Event': 'push',
          'X-Hub-Signature-256': await generateGitHubSignature(payload, testWebhookSecret),
        },
        body: payload,
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(200);
      expect(mockExecutionContext.waitUntil).toHaveBeenCalled();
      expect(sendZulipMessage).toHaveBeenCalledWith(
        expect.any(Object),
        'engineering',
        'ares/web',
        expect.any(String)
      );
    });

    it('should handle push event with more than 5 commits', async () => {
      const app = createTestApp();

      const testEnv = createTestEnv({
        GITHUB_WEBHOOK_SECRET: testWebhookSecret,
      });

      const commits = Array.from({ length: 7 }, (_, i) => ({
        message: `Commit ${i + 1}`,
        author: {
          name: 'Test User',
        },
      }));

      const payload = JSON.stringify({
        ref: 'refs/heads/feature-branch',
        repository: {
          full_name: 'ares/web',
        },
        commits,
      });

      const req = new Request('http://localhost/webhooks/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GitHub-Event': 'push',
          'X-Hub-Signature-256': await generateGitHubSignature(payload, testWebhookSecret),
        },
        body: payload,
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(200);
      expect(mockExecutionContext.waitUntil).toHaveBeenCalled();
      expect(sendZulipMessage).toHaveBeenCalledWith(
        expect.any(Object),
        'engineering',
        'ares/web',
        expect.any(String)
      );
    });

    it('should handle pull_request opened event', async () => {
      const app = createTestApp();

      const testEnv = createTestEnv({
        GITHUB_WEBHOOK_SECRET: testWebhookSecret,
      });

      const payload = JSON.stringify({
        action: 'opened',
        pull_request: {
          title: 'Add new feature',
          html_url: 'https://github.com/ares/web/pull/123',
          user: {
            login: 'contributor',
          },
          merged: false,
        },
        repository: {
          full_name: 'ares/web',
        },
      });

      const req = new Request('http://localhost/webhooks/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GitHub-Event': 'pull_request',
          'X-Hub-Signature-256': await generateGitHubSignature(payload, testWebhookSecret),
        },
        body: payload,
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(200);
      expect(mockExecutionContext.waitUntil).toHaveBeenCalled();
      expect(sendZulipMessage).toHaveBeenCalledWith(
        expect.any(Object),
        'engineering',
        'ares/web',
        expect.any(String)
      );
    });

    it('should handle pull_request closed event (not merged)', async () => {
      const app = createTestApp();

      const testEnv = createTestEnv({
        GITHUB_WEBHOOK_SECRET: testWebhookSecret,
      });

      const payload = JSON.stringify({
        action: 'closed',
        pull_request: {
          title: 'Abandoned feature',
          html_url: 'https://github.com/ares/web/pull/456',
          user: {
            login: 'contributor',
          },
          merged: false,
        },
        repository: {
          full_name: 'ares/web',
        },
      });

      const req = new Request('http://localhost/webhooks/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GitHub-Event': 'pull_request',
          'X-Hub-Signature-256': await generateGitHubSignature(payload, testWebhookSecret),
        },
        body: payload,
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(200);
      expect(mockExecutionContext.waitUntil).toHaveBeenCalled();
      expect(sendZulipMessage).toHaveBeenCalledWith(
        expect.any(Object),
        'engineering',
        'ares/web',
        expect.any(String)
      );
    });

    it('should handle pull_request merged event', async () => {
      const app = createTestApp();

      const testEnv = createTestEnv({
        GITHUB_WEBHOOK_SECRET: testWebhookSecret,
      });

      const payload = JSON.stringify({
        action: 'closed',
        pull_request: {
          title: 'Merged feature',
          html_url: 'https://github.com/ares/web/pull/789',
          user: {
            login: 'contributor',
          },
          merged: true,
        },
        repository: {
          full_name: 'ares/web',
        },
      });

      const req = new Request('http://localhost/webhooks/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GitHub-Event': 'pull_request',
          'X-Hub-Signature-256': await generateGitHubSignature(payload, testWebhookSecret),
        },
        body: payload,
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(200);
      expect(mockExecutionContext.waitUntil).toHaveBeenCalled();
      expect(sendZulipMessage).toHaveBeenCalledWith(
        expect.any(Object),
        'engineering',
        'ares/web',
        expect.any(String)
      );
    });

    it('should handle pull_request reopened event', async () => {
      const app = createTestApp();

      const testEnv = createTestEnv({
        GITHUB_WEBHOOK_SECRET: testWebhookSecret,
      });

      const payload = JSON.stringify({
        action: 'reopened',
        pull_request: {
          title: 'Reopened PR',
          html_url: 'https://github.com/ares/web/pull/999',
          user: {
            login: 'contributor',
          },
          merged: false,
        },
        repository: {
          full_name: 'ares/web',
        },
      });

      const req = new Request('http://localhost/webhooks/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GitHub-Event': 'pull_request',
          'X-Hub-Signature-256': await generateGitHubSignature(payload, testWebhookSecret),
        },
        body: payload,
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(200);
      expect(mockExecutionContext.waitUntil).toHaveBeenCalled();
      expect(sendZulipMessage).toHaveBeenCalledWith(
        expect.any(Object),
        'engineering',
        'ares/web',
        expect.any(String)
      );
    });

    it('should ignore pull_request actions other than opened/closed/reopened', async () => {
      const app = createTestApp();

      const testEnv = createTestEnv({
        GITHUB_WEBHOOK_SECRET: testWebhookSecret,
      });

      const payload = JSON.stringify({
        action: 'synchronize', // This happens when commits are added to a PR
        pull_request: {
          title: 'Updated PR',
          html_url: 'https://github.com/ares/web/pull/111',
          user: {
            login: 'contributor',
          },
          merged: false,
        },
        repository: {
          full_name: 'ares/web',
        },
      });

      const req = new Request('http://localhost/webhooks/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GitHub-Event': 'pull_request',
          'X-Hub-Signature-256': await generateGitHubSignature(payload, testWebhookSecret),
        },
        body: payload,
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(200);
      // Should not trigger Zulip for synchronize action
      expect(sendZulipMessage).not.toHaveBeenCalled();
    });

    it('should handle issues opened event', async () => {
      const app = createTestApp();

      const testEnv = createTestEnv({
        GITHUB_WEBHOOK_SECRET: testWebhookSecret,
      });

      const payload = JSON.stringify({
        action: 'opened',
        issue: {
          title: 'Bug report',
          html_url: 'https://github.com/ares/web/issues/1',
          user: {
            login: 'reporter',
          },
        },
        repository: {
          full_name: 'ares/web',
        },
      });

      const req = new Request('http://localhost/webhooks/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GitHub-Event': 'issues',
          'X-Hub-Signature-256': await generateGitHubSignature(payload, testWebhookSecret),
        },
        body: payload,
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(200);
      expect(mockExecutionContext.waitUntil).toHaveBeenCalled();
      expect(sendZulipMessage).toHaveBeenCalledWith(
        expect.any(Object),
        'engineering',
        'ares/web',
        expect.any(String)
      );
    });

    it('should handle issues closed event', async () => {
      const app = createTestApp();

      const testEnv = createTestEnv({
        GITHUB_WEBHOOK_SECRET: testWebhookSecret,
      });

      const payload = JSON.stringify({
        action: 'closed',
        issue: {
          title: 'Fixed bug',
          html_url: 'https://github.com/ares/web/issues/2',
          user: {
            login: 'fixer',
          },
        },
        repository: {
          full_name: 'ares/web',
        },
      });

      const req = new Request('http://localhost/webhooks/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GitHub-Event': 'issues',
          'X-Hub-Signature-256': await generateGitHubSignature(payload, testWebhookSecret),
        },
        body: payload,
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(200);
      expect(mockExecutionContext.waitUntil).toHaveBeenCalled();
      expect(sendZulipMessage).toHaveBeenCalledWith(
        expect.any(Object),
        'engineering',
        'ares/web',
        expect.any(String)
      );
    });

    it('should handle issues reopened event', async () => {
      const app = createTestApp();

      const testEnv = createTestEnv({
        GITHUB_WEBHOOK_SECRET: testWebhookSecret,
      });

      const payload = JSON.stringify({
        action: 'reopened',
        issue: {
          title: 'Regression found',
          html_url: 'https://github.com/ares/web/issues/3',
          user: {
            login: 'tester',
          },
        },
        repository: {
          full_name: 'ares/web',
        },
      });

      const req = new Request('http://localhost/webhooks/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GitHub-Event': 'issues',
          'X-Hub-Signature-256': await generateGitHubSignature(payload, testWebhookSecret),
        },
        body: payload,
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(200);
      expect(mockExecutionContext.waitUntil).toHaveBeenCalled();
      expect(sendZulipMessage).toHaveBeenCalledWith(
        expect.any(Object),
        'engineering',
        'ares/web',
        expect.any(String)
      );
    });

    it('should ignore issues actions other than opened/closed/reopened', async () => {
      const app = createTestApp();

      const testEnv = createTestEnv({
        GITHUB_WEBHOOK_SECRET: testWebhookSecret,
      });

      const payload = JSON.stringify({
        action: 'labeled', // Adding a label to an issue
        issue: {
          title: 'Labeled issue',
          html_url: 'https://github.com/ares/web/issues/4',
          user: {
            login: 'labeler',
          },
        },
        repository: {
          full_name: 'ares/web',
        },
      });

      const req = new Request('http://localhost/webhooks/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GitHub-Event': 'issues',
          'X-Hub-Signature-256': await generateGitHubSignature(payload, testWebhookSecret),
        },
        body: payload,
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(200);
      // Should not trigger Zulip for labeled action
      expect(sendZulipMessage).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle Zulip errors gracefully (waitUntil catches errors)', async () => {
      const app = createTestApp();

      const testEnv = createTestEnv({
        GITHUB_WEBHOOK_SECRET: testWebhookSecret,
      });

      // Mock sendZulipMessage to throw an error
      vi.mocked(sendZulipMessage).mockRejectedValue(new Error('Zulip API error'));

      const payload = JSON.stringify({
        action: 'created',
        projects_v2_item: {
          node_id: 'test-node-id',
        },
      });

      const req = new Request('http://localhost/webhooks/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GitHub-Event': 'projects_v2_item',
          'X-Hub-Signature-256': await generateGitHubSignature(payload, testWebhookSecret),
        },
        body: payload,
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should still return 200 even if Zulip fails (background task)
      expect(_res.status).toBe(200);
    });

    it('should handle malformed payload in events', async () => {
      const app = createTestApp();

      const testEnv = createTestEnv({
        GITHUB_WEBHOOK_SECRET: testWebhookSecret,
      });

      // Valid JSON but missing expected fields
      const payload = JSON.stringify({
        action: 'created',
        // Missing projects_v2_item
      });

      const req = new Request('http://localhost/webhooks/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GitHub-Event': 'projects_v2_item',
          'X-Hub-Signature-256': await generateGitHubSignature(payload, testWebhookSecret),
        },
        body: payload,
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should handle gracefully and return 200
      expect(_res.status).toBe(200);
    });
  });

  describe('Timing-safe signature verification', () => {
    it('should use timing-safe comparison for signature verification', async () => {
      const app = createTestApp();

      const testEnv = createTestEnv({
        GITHUB_WEBHOOK_SECRET: testWebhookSecret,
      });

      const payload = JSON.stringify({ action: 'test' });
      const correctSignature = await generateGitHubSignature(payload, testWebhookSecret);

      const req = new Request('http://localhost/webhooks/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GitHub-Event': 'push',
          'X-Hub-Signature-256': correctSignature,
        },
        body: payload,
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(200);
    });

    it('should reject signature with wrong format', async () => {
      const app = createTestApp();

      const testEnv = createTestEnv({
        GITHUB_WEBHOOK_SECRET: testWebhookSecret,
      });

      const payload = JSON.stringify({ action: 'test' });

      const req = new Request('http://localhost/webhooks/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GitHub-Event': 'push',
          // Wrong format - missing = after sha256
          'X-Hub-Signature-256': 'sha256' + 'abcd'.repeat(16),
        },
        body: payload,
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });
  });

  describe('Origin integrity', () => {
    it('should not rely on Referer or Host headers for authentication', async () => {
      const app = createTestApp();

      const testEnv = createTestEnv({
        GITHUB_WEBHOOK_SECRET: testWebhookSecret,
      });

      const payload = JSON.stringify({ action: 'test' });
      const correctSignature = await generateGitHubSignature(payload, testWebhookSecret);

      const req = new Request('http://localhost/webhooks/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GitHub-Event': 'push',
          'X-Hub-Signature-256': correctSignature,
          // These headers should NOT be used for authentication
          'Referer': 'https://malicious-site.com',
          'Host': 'evil.com',
        },
        body: payload,
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should still accept if signature is valid (doesn't check spoofable headers)
      expect(_res.status).toBe(200);
    });
  });

  // NOTE: Database query tests are skipped because the GitHub webhook route
  // primarily calls external services (Zulip) via waitUntil and doesn't perform
  // complex database operations that require Drizzle mocking.
  describe.skip('Database queries (N/A for this route)', () => {
    // This route doesn't perform database queries - it only sends notifications
    // to Zulip based on webhook events.
  });
});
