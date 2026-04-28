 
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import githubWebhookRouter from "./githubWebhook";
import { mockExecutionContext, flushWaitUntil } from "../../../src/test/utils";
import * as zulipSync from "../../utils/zulipSync";

vi.mock("../../utils/zulipSync", () => ({
  sendZulipMessage: vi.fn().mockResolvedValue(true)
}));

describe("GitHub Webhook Router", () => {
  const env = {
    GITHUB_WEBHOOK_SECRET: "test-secret",
    DB: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it("should reject requests with missing signature", async () => {
    const payload = JSON.stringify({ action: "created" });
    const req = new Request("http://localhost/", {
      method: "POST",
      body: payload,
      headers: {
        "X-GitHub-Event": "push",
      },
    });

    const res = await githubWebhookRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(401);
  });

  it("should process requests with missing event header", async () => {
    vi.spyOn(globalThis.crypto.subtle, "verify").mockResolvedValue(true as any);
    const payload = JSON.stringify({ action: "created" });
    const req = new Request("http://localhost/", {
      method: "POST",
      body: payload,
      headers: {
        "X-Hub-Signature-256": "sha256=valid",
      },
    });

    const res = await githubWebhookRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
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

    it("should process projects_v2_item edited event with no field changes", async () => {
      const payload = JSON.stringify({
        action: "edited",
        projects_v2_item: { node_id: "node123" },
        changes: {}
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
    });

    it("should process projects_v2_item edited without changes array", async () => {
      const payload = JSON.stringify({
        action: "edited",
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
    });

    it("should ignore projects_v2_item unknown action", async () => {
      const payload = JSON.stringify({
        action: "restored",
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
    });

    it("should process pull_request reopened event", async () => {
      const payload = JSON.stringify({
        action: "reopened",
        pull_request: { title: "New Feature", html_url: "url", user: { login: "bob" }, merged: false },
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
    });

    it("should process pull_request merged event", async () => {
      const payload = JSON.stringify({
        action: "closed",
        pull_request: { title: "New Feature", html_url: "url", user: { login: "bob" }, merged: true },
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
    });

    it("should ignore issues assigned event", async () => {
      const payload = JSON.stringify({
        action: "assigned",
        issue: { title: "New Issue", html_url: "url", user: { login: "bob" } },
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
    });

    it("should process push event", async () => {
      const payload = JSON.stringify({
        ref: "refs/heads/main",
        commits: [
          { message: "First commit", author: { name: "Alice" } },
          { message: "Second commit\nwith details", author: { name: "Alice" } }
        ],
        repository: { full_name: "ares/test" }
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

    it("should process push event with > 5 commits and missing ref/repo", async () => {
      const payload = JSON.stringify({
        commits: [
          { message: "c1", author: { name: "Alice" } },
          { message: "c2", author: { name: "Alice" } },
          { message: "c3", author: { name: "Alice" } },
          { message: "c4", author: { name: "Alice" } },
          { message: "c5", author: { name: "Alice" } },
          { message: "c6", author: { name: "Alice" } }
        ]
        // missing ref and repository
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

    it("should process projects_v2_item edited event without node_id", async () => {
      const payload = JSON.stringify({
        action: "edited",
        projects_v2_item: {}, // missing node_id
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

    it("should process push event with no commits", async () => {
      const payload = JSON.stringify({
        ref: "refs/heads/main",
        commits: [],
        repository: { full_name: "ares/test" }
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

    it("should catch errors in processing event", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      
      const payload = JSON.stringify({
        action: "created",
        projects_v2_item: null
      });
      
      const req = new Request("http://localhost/", {
        method: "POST",
        body: payload,
        headers: {
          "X-Hub-Signature-256": "sha256=valid",
          "X-GitHub-Event": "projects_v2_item",
        },
      });
      
      // We force an error by making JSON.parse valid but causing a TypeError down the line,
      // actually the easiest way is to mock executionCtx.waitUntil to throw
      const badCtx = {
        waitUntil: () => { throw new Error("Forced error in processing"); }
      };

      const res = await githubWebhookRouter.request(req, {}, env, badCtx as any);
      expect(res.status).toBe(200);
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should handle zulip message rejection in pull_request", async () => {
      vi.mocked(zulipSync.sendZulipMessage).mockRejectedValueOnce(new Error("Zulip fail"));
      
      const payload = JSON.stringify({
        action: "opened",
        pull_request: { title: "New Feature" }
      });
      const req = new Request("http://localhost/", {
        method: "POST",
        body: payload,
        headers: { "X-Hub-Signature-256": "sha256=valid", "X-GitHub-Event": "pull_request" },
      });

      const res = await githubWebhookRouter.request(req, {}, env, mockExecutionContext);
      expect(res.status).toBe(200);
      await flushWaitUntil();
    });

    it("should handle zulip message rejection in issues", async () => {
      vi.mocked(zulipSync.sendZulipMessage).mockRejectedValueOnce(new Error("Zulip fail"));
      
      const payload = JSON.stringify({
        action: "opened",
        issue: { title: "New Issue" }
      });
      const req = new Request("http://localhost/", {
        method: "POST",
        body: payload,
        headers: { "X-Hub-Signature-256": "sha256=valid", "X-GitHub-Event": "issues" },
      });

      const res = await githubWebhookRouter.request(req, {}, env, mockExecutionContext);
      expect(res.status).toBe(200);
      await flushWaitUntil();
    });

    it("should handle zulip message rejection in push", async () => {
      vi.mocked(zulipSync.sendZulipMessage).mockRejectedValueOnce(new Error("Zulip fail"));
      const payload = JSON.stringify({
        ref: "refs/heads/main",
        commits: [{ message: "Fix bug", author: { name: "Alice" } }],
        repository: { full_name: "org/repo" }
      });
      const req = new Request("http://localhost/", {
        method: "POST",
        body: payload,
        headers: { "X-Hub-Signature-256": "sha256=valid", "X-GitHub-Event": "push" },
      });
      const res = await githubWebhookRouter.request(req, {}, env, mockExecutionContext);
      expect(res.status).toBe(200);
      await flushWaitUntil();
    });

    it("should handle zulip message rejection in projects_v2_item created", async () => {
      vi.mocked(zulipSync.sendZulipMessage).mockRejectedValueOnce(new Error("Zulip fail"));
      const payload = JSON.stringify({ action: "created", projects_v2_item: { node_id: "node123" } });
      const req = new Request("http://localhost/", {
        method: "POST",
        body: payload,
        headers: { "X-Hub-Signature-256": "sha256=valid", "X-GitHub-Event": "projects_v2_item" },
      });
      const res = await githubWebhookRouter.request(req, {}, env, mockExecutionContext);
      expect(res.status).toBe(200);
      await flushWaitUntil();
    });

    it("should handle zulip message rejection in projects_v2_item edited", async () => {
      vi.mocked(zulipSync.sendZulipMessage).mockRejectedValueOnce(new Error("Zulip fail"));
      const payload = JSON.stringify({ action: "edited", projects_v2_item: { node_id: "node123" }, changes: { status: { from: "Todo", to: "Done" } } });
      const req = new Request("http://localhost/", {
        method: "POST",
        body: payload,
        headers: { "X-Hub-Signature-256": "sha256=valid", "X-GitHub-Event": "projects_v2_item" },
      });
      const res = await githubWebhookRouter.request(req, {}, env, mockExecutionContext);
      expect(res.status).toBe(200);
      await flushWaitUntil();
    });

    it("should handle zulip message rejection in projects_v2_item deleted", async () => {
      vi.mocked(zulipSync.sendZulipMessage).mockRejectedValueOnce(new Error("Zulip fail"));
      const payload = JSON.stringify({ action: "deleted", projects_v2_item: { node_id: "node123" } });
      const req = new Request("http://localhost/", {
        method: "POST",
        body: payload,
        headers: { "X-Hub-Signature-256": "sha256=valid", "X-GitHub-Event": "projects_v2_item" },
      });
      const res = await githubWebhookRouter.request(req, {}, env, mockExecutionContext);
      expect(res.status).toBe(200);
      await flushWaitUntil();
    });
    it("should handle ignored pull_request action", async () => {
      const payload = JSON.stringify({
        action: "labeled",
        pull_request: { title: "Fix bug" },
        repository: { full_name: "org/repo" }
      });
      const req = new Request("http://localhost/", {
        method: "POST",
        body: payload,
        headers: { "X-Hub-Signature-256": "sha256=valid", "X-GitHub-Event": "pull_request" },
      });
      const res = await githubWebhookRouter.request(req, {}, env, mockExecutionContext);
      expect(res.status).toBe(200);
      await flushWaitUntil();
    });

    it("should handle ignored issues action", async () => {
      const payload = JSON.stringify({
        action: "assigned",
        issue: { title: "New issue" },
        repository: { full_name: "org/repo" }
      });
      const req = new Request("http://localhost/", {
        method: "POST",
        body: payload,
        headers: { "X-Hub-Signature-256": "sha256=valid", "X-GitHub-Event": "issues" },
      });
      const res = await githubWebhookRouter.request(req, {}, env, mockExecutionContext);
      expect(res.status).toBe(200);
      await flushWaitUntil();
    });

    it("should handle unknown github events gracefully", async () => {
      const payload = JSON.stringify({});
      const req = new Request("http://localhost/", {
        method: "POST",
        body: payload,
        headers: { "X-Hub-Signature-256": "sha256=valid", "X-GitHub-Event": "unknown_event" },
      });

      const res = await githubWebhookRouter.request(req, {}, env, mockExecutionContext);
      expect(res.status).toBe(200);
    });

    it("should handle pull_request closed merged", async () => {
      const payload = JSON.stringify({
        action: "closed",
        pull_request: { title: "Fix bug", html_url: "url", user: { login: "alice" }, merged: true },
        repository: { full_name: "org/repo" }
      });
      const req = new Request("http://localhost/", {
        method: "POST",
        body: payload,
        headers: { "X-Hub-Signature-256": "sha256=valid", "X-GitHub-Event": "pull_request" },
      });
      const res = await githubWebhookRouter.request(req, {}, env, mockExecutionContext);
      expect(res.status).toBe(200);
      await flushWaitUntil();
    });

    it("should handle pull_request closed not merged", async () => {
      const payload = JSON.stringify({
        action: "closed",
        pull_request: { title: "Fix bug", html_url: "url", user: { login: "alice" }, merged: false },
        repository: { full_name: "org/repo" }
      });
      const req = new Request("http://localhost/", {
        method: "POST",
        body: payload,
        headers: { "X-Hub-Signature-256": "sha256=valid", "X-GitHub-Event": "pull_request" },
      });
      const res = await githubWebhookRouter.request(req, {}, env, mockExecutionContext);
      expect(res.status).toBe(200);
      await flushWaitUntil();
    });

    it("should handle pull_request reopened with missing fields", async () => {
      const payload = JSON.stringify({
        action: "reopened"
      });
      const req = new Request("http://localhost/", {
        method: "POST",
        body: payload,
        headers: { "X-Hub-Signature-256": "sha256=valid", "X-GitHub-Event": "pull_request" },
      });
      const res = await githubWebhookRouter.request(req, {}, env, mockExecutionContext);
      expect(res.status).toBe(200);
      await flushWaitUntil();
    });

    it("should handle issues closed", async () => {
      const payload = JSON.stringify({
        action: "closed",
        issue: { title: "New issue", html_url: "url", user: { login: "bob" } },
        repository: { full_name: "org/repo" }
      });
      const req = new Request("http://localhost/", {
        method: "POST",
        body: payload,
        headers: { "X-Hub-Signature-256": "sha256=valid", "X-GitHub-Event": "issues" },
      });
      const res = await githubWebhookRouter.request(req, {}, env, mockExecutionContext);
      expect(res.status).toBe(200);
      await flushWaitUntil();
    });

    it("should handle issues reopened with missing fields", async () => {
      const payload = JSON.stringify({
        action: "reopened"
      });
      const req = new Request("http://localhost/", {
        method: "POST",
        body: payload,
        headers: { "X-Hub-Signature-256": "sha256=valid", "X-GitHub-Event": "issues" },
      });
      const res = await githubWebhookRouter.request(req, {}, env, mockExecutionContext);
      expect(res.status).toBe(200);
      await flushWaitUntil();
    });
  });

  it("should catch errors in verifyGitHubSignature (e.g. malformed hex)", async () => {
    const payload = JSON.stringify({ action: "created" });
    const req = new Request("http://localhost/", {
      method: "POST",
      body: payload,
      headers: {
        "X-Hub-Signature-256": "sha256=", // Empty hex string triggers TypeError
        "X-GitHub-Event": "push",
      },
    });

    const res = await githubWebhookRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(401);
  });
});
