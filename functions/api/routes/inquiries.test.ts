import { describe, it, expect, vi, beforeEach } from "vitest";
import { inquiriesRouter, adminInquiriesRouter } from "./inquiries";
import { createMockInquiry } from "../../../src/test/factories/logisticsFactory";
import { mockExecutionContext } from "../../../src/test/utils";
import { http, HttpResponse } from "msw";
import { server } from "../../../src/test/setup";

describe("Hono Backend - /inquiries Router", () => {
  const env = {
    DB: {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: [] }),
      run: vi.fn().mockResolvedValue({ success: true }),
      first: vi.fn(),
    } as any,
    DEV_BYPASS: "true",
    TURNSTILE_SECRET_KEY: "secret",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock Turnstile verify endpoint
    server.use(
      http.post("https://challenges.cloudflare.com/turnstile/v0/siteverify", () => {
        return HttpResponse.json({ success: true });
      })
    );
  });

  it("should submit a new inquiry (public)", async () => {
    const payload = { 
      name: "John Doe", 
      email: "john@example.com", 
      subject: "Hello", 
      message: "World", 
      type: "outreach", 
      turnstileToken: "token" 
    };
    const req = new Request("http://localhost/", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    });
    
    const res = await inquiriesRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(env.DB.prepare).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO inquiries"));
  });

  it("should list inquiries (admin)", async () => {
    const mockInquiries = [createMockInquiry()];
    env.DB.all.mockResolvedValue({ results: mockInquiries });

    const req = new Request("http://localhost/", { method: "GET" });
    const res = await adminInquiriesRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.inquiries).toHaveLength(1);
  });
});
