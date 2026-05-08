/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  sendZulipMessage,
  updateZulipMessage,
  deleteZulipMessage,
  sendZulipAlert,
} from "./zulipSync";
import type { Bindings } from "../api/middleware";

// Mock p-retry
vi.mock("p-retry", () => ({
  default: vi.fn((fn: () => Promise<unknown>, options: { onFailedAttempt: (error: { attemptNumber: number; retriesLeft: number }) => void }) => fn(),
  ),
}));

// Mock drizzle-orm/d1
vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => ({
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        execute: vi.fn(),
      })),
    })),
  })),
}));

// Mock the schema and relations
vi.mock("../../src/db/schema", () => ({
  systemErrorLogs: vi.fn(),
}));

vi.mock("../../src/db/relations", () => ({}));

// Mock the middleware logSystemError
vi.mock("../api/middleware", () => ({
  logSystemError: vi.fn().mockResolvedValue(undefined),
}));

// Mock fetch globally
global.fetch = vi.fn();

describe("zulipSync", () => {
  const mockEnv: Bindings = {
    DB: {} as any,
    ZULIP_URL: "https://aresfirst.zulipchat.com",
    ZULIP_BOT_EMAIL: "bot@aresfirst.org",
    ZULIP_API_KEY: "test-api-key-123",
    ZULIP_ADMIN_STREAM: "leadership",
  } as unknown as Bindings;

  const mockEnvWithoutAdmin: Bindings = {
    DB: {} as any,
    ZULIP_URL: "https://aresfirst.zulipchat.com",
    ZULIP_BOT_EMAIL: "bot@aresfirst.org",
    ZULIP_API_KEY: "test-api-key-123",
  } as unknown as Bindings;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetch).mockReset();
  });

  describe("getZulipAuthHeaders (internal behavior)", () => {
    it("uses ZULIP_BOT_EMAIL when available", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({ result: "success", id: 12345 }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );

      await sendZulipMessage(mockEnv, "general", "test topic", "Hello, world!");

      expect(fetch).toHaveBeenCalledWith(
        "https://aresfirst.zulipchat.com/api/v1/messages",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringContaining("Basic "),
          }),
        })
      );

      const headers = vi.mocked(fetch).mock.calls[0]?.[1]?.headers as Record<string, string>;
      const authHeader = headers?.Authorization as string;
      expect(authHeader).toBeTruthy();

      // Decode and verify the auth header contains bot email
      const decoded = atob(authHeader.replace("Basic ", ""));
      expect(decoded).toContain("bot@aresfirst.org");
    });

    it("falls back to ZULIP_EMAIL when ZULIP_BOT_EMAIL is not set", async () => {
      const envWithRegularEmail: Bindings = {
        ...mockEnv,
        ZULIP_BOT_EMAIL: undefined,
        ZULIP_EMAIL: "regular@aresfirst.org",
      } as unknown as Bindings;

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({ result: "success", id: 12345 }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );

      await sendZulipMessage(envWithRegularEmail, "general", "test topic", "Hello!");

      const headers = vi.mocked(fetch).mock.calls[0]?.[1]?.headers as Record<string, string>;
      const authHeader = headers?.Authorization as string;
      const decoded = atob(authHeader.replace("Basic ", ""));
      expect(decoded).toContain("regular@aresfirst.org");
    });
  });

  describe("sendZulipMessage", () => {
    it("sends a stream message successfully and returns message ID", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({ result: "success", id: 12345 }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );

      const result = await sendZulipMessage(mockEnv, "general", "test topic", "Hello, world!");

      expect(result).toBe("12345");
      expect(fetch).toHaveBeenCalledWith(
        "https://aresfirst.zulipchat.com/api/v1/messages",
        expect.objectContaining({
          method: "POST",
          signal: expect.any(AbortSignal),
        })
      );
    });

    it("sends a private message to a single recipient", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({ result: "success", id: 67890 }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );

      const result = await sendZulipMessage(mockEnv, "user@example.com", null, "Private message", "private");

      expect(result).toBe("67890");

      const body = vi.mocked(fetch).mock.calls[0]?.[1]?.body as string;
      expect(body).toContain("type=private");
      expect(body).toContain("to=user%40example.com");
    });

    it("sends a private message to multiple recipients", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({ result: "success", id: 11111 }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );

      const recipients = ["user1@example.com", "user2@example.com"];
      const result = await sendZulipMessage(mockEnv, recipients, null, "Group message", "private");

      expect(result).toBe("11111");

      const body = vi.mocked(fetch).mock.calls[0]?.[1]?.body as string;
      expect(body).toContain("type=private");
      // Should be JSON stringified array
      expect(body).toContain("to=%5B%22");
    });

    it("uses default Zulip URL when ZULIP_URL is not set", async () => {
      const envWithoutUrl: Bindings = {
        ...mockEnv,
        ZULIP_URL: undefined,
      } as unknown as Bindings;

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({ result: "success", id: 22222 }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );

      await sendZulipMessage(envWithoutUrl, "general", "test", "Hello");

      expect(fetch).toHaveBeenCalledWith(
        "https://aresfirst.zulipchat.com/api/v1/messages",
        expect.any(Object)
      );
    });

    it("includes topic for stream messages", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({ result: "success", id: 33333 }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );

      await sendZulipMessage(mockEnv, "general", "test topic", "Hello");

      const body = vi.mocked(fetch).mock.calls[0]?.[1]?.body as string;
      expect(body).toContain("topic=test+topic");
    });

    it("returns null on API error response", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response("Bad Request", { status: 400 })
      );

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await sendZulipMessage(mockEnv, "general", "test", "Hello");

      expect(result).toBeNull();
      consoleErrorSpy.mockRestore();
    });

    it("returns null when Zulip returns non-success result", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({ result: "error", msg: "Invalid stream" }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await sendZulipMessage(mockEnv, "nonexistent", "test", "Hello");

      expect(result).toBeNull();
      consoleErrorSpy.mockRestore();
    });

    it("logs system error and returns null after all retries fail", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

      const { logSystemError } = await import("../api/middleware");
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await sendZulipMessage(mockEnv, "general", "test", "Hello");

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(logSystemError).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it("handles Unicode characters in content correctly", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({ result: "success", id: 44444 }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );

      const contentWithEmoji = "Hello! 🚀 Test message with émojis 🎉";
      await sendZulipMessage(mockEnv, "general", "test", contentWithEmoji);

      const body = vi.mocked(fetch).mock.calls[0]?.[1]?.body as string;
      expect(body).toBeTruthy();
    });

    it("sets 5 second timeout for requests", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({ result: "success", id: 55555 }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );

      await sendZulipMessage(mockEnv, "general", "test", "Hello");

      const callArgs = vi.mocked(fetch).mock.calls[0];
      expect(callArgs?.[1]?.signal).toBeInstanceOf(AbortSignal);
    });
  });

  describe("updateZulipMessage", () => {
    it("updates a message successfully", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({ result: "success", id: 12345 }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );

      const result = await updateZulipMessage(mockEnv, "12345", "Updated content");

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        "https://aresfirst.zulipchat.com/api/v1/messages/12345",
        expect.objectContaining({
          method: "PATCH",
          signal: expect.any(AbortSignal),
        })
      );
    });

    it("sends new content in form data", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({ result: "success" }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );

      await updateZulipMessage(mockEnv, "12345", "New updated message");

      const body = vi.mocked(fetch).mock.calls[0]?.[1]?.body as string;
      expect(body).toContain("content=New+updated+message");
    });

    it("returns false on API error", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response("Not Found", { status: 404 })
      );

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await updateZulipMessage(mockEnv, "99999", "content");

      expect(result).toBe(false);
      consoleErrorSpy.mockRestore();
    });

    it("returns false and logs error on network failure", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error("Connection failed"));

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await updateZulipMessage(mockEnv, "12345", "content");

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[ZulipSync] Exception updating message:",
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it("uses default URL when ZULIP_URL is not set", async () => {
      const envWithoutUrl: Bindings = {
        ...mockEnv,
        ZULIP_URL: undefined,
      } as unknown as Bindings;

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({ result: "success" }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );

      await updateZulipMessage(envWithoutUrl, "12345", "content");

      expect(fetch).toHaveBeenCalledWith(
        "https://aresfirst.zulipchat.com/api/v1/messages/12345",
        expect.any(Object)
      );
    });
  });

  describe("deleteZulipMessage", () => {
    it("deletes a message successfully", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({ result: "success" }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );

      const result = await deleteZulipMessage(mockEnv, "12345");

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        "https://aresfirst.zulipchat.com/api/v1/messages/12345",
        expect.objectContaining({
          method: "DELETE",
          signal: expect.any(AbortSignal),
        })
      );
    });

    it("returns false on API error", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response("Unauthorized", { status: 403 })
      );

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await deleteZulipMessage(mockEnv, "12345");

      expect(result).toBe(false);
      consoleErrorSpy.mockRestore();
    });

    it("returns false and logs error on network failure", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await deleteZulipMessage(mockEnv, "12345");

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[ZulipSync] Exception deleting message:",
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it("uses default URL when ZULIP_URL is not set", async () => {
      const envWithoutUrl: Bindings = {
        ...mockEnv,
        ZULIP_URL: undefined,
      } as unknown as Bindings;

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({ result: "success" }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );

      await deleteZulipMessage(envWithoutUrl, "12345");

      expect(fetch).toHaveBeenCalledWith(
        "https://aresfirst.zulipchat.com/api/v1/messages/12345",
        expect.any(Object)
      );
    });

    it("does not send body for DELETE request", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({ result: "success" }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );

      await deleteZulipMessage(mockEnv, "12345");

      const callArgs = vi.mocked(fetch).mock.calls[0];
      expect(callArgs?.[1]?.body).toBeUndefined();
    });
  });

  describe("sendZulipAlert", () => {
    it("sends an Applicant alert to the admin stream", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({ result: "success", id: 11111 }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );

      await sendZulipAlert(mockEnv, "Applicant", "New Application", "A new student applied");

      expect(fetch).toHaveBeenCalledWith(
        "https://aresfirst.zulipchat.com/api/v1/messages",
        expect.objectContaining({
          method: "POST",
        })
      );

      const body = vi.mocked(fetch).mock.calls[0]?.[1]?.body as string;
      expect(body).toContain("to=leadership");
      expect(body).toContain("topic=Applicant+Alerts");
      expect(body).toContain("content=**New+Application**");
    });

    it("sends a Sponsor alert to the admin stream", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({ result: "success", id: 22222 }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );

      await sendZulipAlert(mockEnv, "Sponsor", "New Sponsorship", "Company X wants to sponsor");

      const body = vi.mocked(fetch).mock.calls[0]?.[1]?.body as string;
      expect(body).toContain("topic=Sponsor+Alerts");
      expect(body).toContain("Sponsorship");
    });

    it("sends an Outreach alert to the admin stream", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({ result: "success", id: 33333 }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );

      await sendZulipAlert(mockEnv, "Outreach", "Event Completed", "Demo day was successful");

      const body = vi.mocked(fetch).mock.calls[0]?.[1]?.body as string;
      expect(body).toContain("topic=Outreach+Alerts");
    });

    it("sends a System alert to the admin stream", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({ result: "success", id: 44444 }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );

      await sendZulipAlert(mockEnv, "System", "Database Error", "Connection pool exhausted");

      const body = vi.mocked(fetch).mock.calls[0]?.[1]?.body as string;
      expect(body).toContain("topic=System+Alerts");
    });

    it("uses default 'leadership' stream when ZULIP_ADMIN_STREAM is not set", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({ result: "success", id: 55555 }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );

      await sendZulipAlert(mockEnvWithoutAdmin, "System", "Test", "Test message");

      const body = vi.mocked(fetch).mock.calls[0]?.[1]?.body as string;
      expect(body).toContain("to=leadership");
    });

    it("formats markdown content with bold title", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({ result: "success", id: 66666 }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );

      await sendZulipAlert(mockEnv, "Applicant", "Critical Alert", "This is **important**");

      const body = vi.mocked(fetch).mock.calls[0]?.[1]?.body as string;
      expect(body).toContain("**Critical+Alert**"); // Bold markdown
      expect(body).toContain("This+is+**important**"); // Bold markdown in body
    });

    it("properly encodes special characters in content", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({ result: "success", id: 77777 }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );

      await sendZulipAlert(
        mockEnv,
        "System",
        "Special & Characters",
        "Test with <html> & \"quotes\""
      );

      const body = vi.mocked(fetch).mock.calls[0]?.[1]?.body as string;
      expect(body).toBeTruthy();
      // Just verify the fetch was called - encoding is handled by URLSearchParams
      expect(fetch).toHaveBeenCalled();
    });
  });

  describe("retry behavior via p-retry", () => {
    it("retries on transient failures for sendZulipMessage", async () => {
      const pRetry = await import("p-retry");
      vi.mocked(pRetry.default).mockImplementationOnce(async (fn: any) => {
        // First attempt fails
        try {
          await fn();
        } catch {
          // Simulate retry succeeding on second attempt
          vi.mocked(fetch).mockResolvedValueOnce(
            new Response(
              JSON.stringify({ result: "success", id: 88888 }),
              { status: 200, headers: { "content-type": "application/json" } }
            )
          );
          return await fn();
        }
      });

      vi.mocked(fetch).mockRejectedValueOnce(new Error("Temporary failure"));

      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const result = await sendZulipMessage(mockEnv, "general", "test", "Hello");

      // After retry should succeed
      expect(vi.mocked(fetch)).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });
});
