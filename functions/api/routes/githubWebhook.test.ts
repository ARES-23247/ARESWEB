 
import { describe, it, expect, vi, beforeEach } from "vitest";
import githubWebhookRouter from "./githubWebhook";
import { mockExecutionContext } from "../../../src/test/utils";

describe("GitHub Webhook Router", () => {
  const env = {
    GITHUB_WEBHOOK_SECRET: "test-secret",
    DB: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should reject requests with invalid signature", async () => {
    const payload = JSON.stringify({ action: "created" });
    const req = new Request("http://localhost/", {
      method: "POST",
      body: payload,
      headers: {
        "X-Hub-Signature-256": "sha256=invalid",
        "X-GitHub-Event": "push",
      },
    });

    const res = await githubWebhookRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(401);
  });

  it("should fail-closed if secret is missing", async () => {
    const req = new Request("http://localhost/", { method: "POST" });
    const res = await githubWebhookRouter.request(req, {}, { ...env, GITHUB_WEBHOOK_SECRET: "" }, mockExecutionContext);
    expect(res.status).toBe(503);
  });

  describe("Valid Webhook Processing", () => {
    beforeEach(() => {
      vi.spyOn(globalThis.crypto.subtle, "verify").mockResolvedValue(true as any);
    });

    it("should process push event", async () => {
      const payload = JSON.stringify({
        ref: "refs/heads/main",
        commits: [{ message: "Fix bug", author: { name: "Alice" } }],
        repository: { full_name: "org/repo" }
      });
      const req = new Request("http://localhost/", {
        method: "POST",
        body: payload,
        headers: {
          "X-Hub-Signature-256": "sha256=valid",
          "X-GitHub-Event": "push",
        },
      });

      const res = await githubWebhookRouter.request(req, {}, env, mockExecutionContext);
      expect(res.status).toBe(200);
      expect(mockExecutionContext.waitUntil).toHaveBeenCalled();
    });

    it("should process pull_request event", async () => {
      const payload = JSON.stringify({
        action: "opened",
        pull_request: { title: "New Feature", html_url: "url", user: { login: "bob" } },
        repository: { full_name: "org/repo" }
      });
      const req = new Request("http://localhost/", {
        method: "POST",
        body: payload,
        headers: {
          "X-Hub-Signature-256": "sha256=valid",
          "X-GitHub-Event": "pull_request",
        },
      });

      const res = await githubWebhookRouter.request(req, {}, env, mockExecutionContext);
      expect(res.status).toBe(200);
      expect(mockExecutionContext.waitUntil).toHaveBeenCalled();
    });

    it("should process issues event", async () => {
      const payload = JSON.stringify({
        action: "closed",
        issue: { title: "Old Issue", html_url: "url", user: { login: "charlie" } },
        repository: { full_name: "org/repo" }
      });
      const req = new Request("http://localhost/", {
        method: "POST",
        body: payload,
        headers: {
          "X-Hub-Signature-256": "sha256=valid",
          "X-GitHub-Event": "issues",
        },
      });

      const res = await githubWebhookRouter.request(req, {}, env, mockExecutionContext);
      expect(res.status).toBe(200);
      expect(mockExecutionContext.waitUntil).toHaveBeenCalled();
    });

    it("should process projects_v2_item created event", async () => {
      const payload = JSON.stringify({
        action: "created",
        projects_v2_item: { node_id: "node123" }
      });
      const req = new Request("http://localhost/", {
        method: "POST",
        body: payload,
        headers: {
          "X-Hub-Signature-256": "sha256=valid",
          "X-GitHub-Event": "projects_v2_item",
        },
      });

      const res = await githubWebhookRouter.request(req, {}, env, mockExecutionContext);
      expect(res.status).toBe(200);
      expect(mockExecutionContext.waitUntil).toHaveBeenCalled();
    });
    
    it("should process projects_v2_item edited event", async () => {
      const payload = JSON.stringify({
        action: "edited",
        projects_v2_item: { node_id: "node123" },
        changes: { status: { from: "Todo", to: "Done" } }
      });
      const req = new Request("http://localhost/", {
        method: "POST",
        body: payload,
        headers: {
          "X-Hub-Signature-256": "sha256=valid",
          "X-GitHub-Event": "projects_v2_item",
        },
      });

      const res = await githubWebhookRouter.request(req, {}, env, mockExecutionContext);
      expect(res.status).toBe(200);
      expect(mockExecutionContext.waitUntil).toHaveBeenCalled();
    });

    it("should process projects_v2_item deleted event", async () => {
      const payload = JSON.stringify({
        action: "deleted",
        projects_v2_item: { node_id: "node123" }
      });
      const req = new Request("http://localhost/", {
        method: "POST",
        body: payload,
        headers: {
          "X-Hub-Signature-256": "sha256=valid",
          "X-GitHub-Event": "projects_v2_item",
        },
      });

      const res = await githubWebhookRouter.request(req, {}, env, mockExecutionContext);
      expect(res.status).toBe(200);
      expect(mockExecutionContext.waitUntil).toHaveBeenCalled();
    });

    it("should handle invalid JSON", async () => {
      const req = new Request("http://localhost/", {
        method: "POST",
        body: "invalid json",
        headers: {
          "X-Hub-Signature-256": "sha256=valid",
          "X-GitHub-Event": "push",
        },
      });

      const res = await githubWebhookRouter.request(req, {}, env, mockExecutionContext);
      expect(res.status).toBe(400);
    });

    it("should handle unknown event", async () => {
      const req = new Request("http://localhost/", {
        method: "POST",
        body: JSON.stringify({}),
        headers: {
          "X-Hub-Signature-256": "sha256=valid",
          "X-GitHub-Event": "unknown_event",
        },
      });

      const res = await githubWebhookRouter.request(req, {}, env, mockExecutionContext);
      expect(res.status).toBe(200);
    });
  });
});
