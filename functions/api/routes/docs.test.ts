/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockExecutionContext } from "../../../src/test/utils";
import docsRouter from "./docs";
import { createMockDoc } from "../../../src/test/factories/contentFactory";

// Mock external utilities
vi.mock("../../utils/zulipSync", () => ({
  sendZulipMessage: vi.fn().mockResolvedValue(true),
}));
vi.mock("../../utils/notifications", () => ({
  emitNotification: vi.fn().mockResolvedValue(true),
  notifyByRole: vi.fn().mockResolvedValue(true),
}));
vi.mock("../../utils/auth", () => ({
  getAuth: vi.fn().mockReturnValue({
    api: {
      getSession: vi.fn().mockResolvedValue({ user: { id: "1", email: "student@test.com", name: "Student" } })
    }
  })
}));

describe("Hono Backend - /docs Router", () => {
  let env: any;

  beforeEach(() => {
    vi.clearAllMocks();
    env = {
      DB: {
        prepare: vi.fn().mockReturnThis(),
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ success: true }),
      } as any,
      DEV_BYPASS: "true",
      TURNSTILE_SECRET_KEY: "test-secret",
    };
    // SEC-DoW: Mock Cloudflare Edge Cache for tests
    vi.stubGlobal("caches", {
      default: {
        match: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
      }
    });
  });

  it("GET / - list published docs", async () => {
    const mockDocs = [createMockDoc(), createMockDoc()];
    env.DB.all.mockResolvedValue({ results: mockDocs });

    const req = new Request("http://localhost/", { method: "GET" });
    const res = await docsRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.docs).toHaveLength(2);
  });

  it("GET /search - search docs", async () => {
    env.DB.all.mockResolvedValue({ results: [{ slug: "test", title: "Test", description: "desc" }] });
    const req = new Request("http://localhost/search?q=test", { method: "GET" });
    const res = await docsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.results).toHaveLength(1);
  });

  it("POST /:slug/feedback - submit feedback", async () => {
    // Mock fetch for Turnstile
    (globalThis as Record<string, unknown>).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    } as any);

    const req = new Request("http://localhost/test/feedback", {
      method: "POST",
      body: JSON.stringify({ isHelpful: true, comment: "Nice", turnstileToken: "token" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await docsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(env.DB.prepare).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO docs_feedback"));
  });

  it("GET /:slug - get single doc with contributors", async () => {
    env.DB.first.mockResolvedValue(createMockDoc());
    env.DB.all.mockResolvedValue({ results: [{ author_email: "test@test.com", nickname: "Tester" }] });

    const req = new Request("http://localhost/test-doc", { method: "GET" });
    const res = await docsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.contributors).toHaveLength(1);
  });

  it("GET /list - admin list", async () => {
    const req = new Request("http://localhost/list", { method: "GET" });
    const res = await docsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /export-all - admin export", async () => {
    env.DB.all.mockResolvedValue({ results: [createMockDoc()] });
    const req = new Request("http://localhost/export-all", { method: "GET" });
    const res = await docsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/json");
  });

  it("POST /save - create/update doc", async () => {
    const docData = {
      slug: "new-doc",
      title: "New Doc",
      category: "software",
      content: "...",
    };
    const req = new Request("http://localhost/save", {
      method: "POST",
      body: JSON.stringify(docData),
      headers: { "Content-Type": "application/json" },
    });
    const res = await docsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("DELETE /:slug - soft delete", async () => {
    const req = new Request("http://localhost/test-doc", { method: "DELETE" });
    const res = await docsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("PATCH /:slug/sort - update sort order", async () => {
    const req = new Request("http://localhost/test-doc/sort", {
      method: "PATCH",
      body: JSON.stringify({ sortOrder: 5 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await docsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("PATCH /:slug/approve - approve doc", async () => {
    env.DB.first.mockResolvedValue({ title: "Doc", cf_email: "test@test.com" });
    const req = new Request("http://localhost/test-doc/approve", { method: "PATCH" });
    const res = await docsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("PATCH /:slug/reject - reject doc", async () => {
    env.DB.first.mockResolvedValue({ title: "Doc", cf_email: "test@test.com" });
    const req = new Request("http://localhost/test-doc/reject", {
      method: "PATCH",
      body: JSON.stringify({ reason: "No" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await docsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /:slug/history - get history", async () => {
    const req = new Request("http://localhost/test-doc/history", { method: "GET" });
    const res = await docsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("PATCH /:slug/history/:id/restore - restore history", async () => {
    env.DB.first.mockResolvedValue({ title: "Old", category: "cat", content: "..." });
    const req = new Request("http://localhost/test-doc/history/1/restore", { method: "PATCH" });
    const res = await docsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });
});
