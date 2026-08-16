import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "../logger";

describe("redacting functions logger", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it("redacts identity, contact, and credential fields recursively", () => {
    logger.info("test", "Processed member@example.com", {
      actorUid: "firebase-uid",
      nested: { email: "student@example.com", status: 201 },
      authorization: "Bearer visible-token",
    });

    const output = vi.mocked(console.log).mock.calls[0][0] as string;
    expect(output).not.toContain("member@example.com");
    expect(output).not.toContain("student@example.com");
    expect(output).not.toContain("firebase-uid");
    expect(output).not.toContain("visible-token");
    expect(output).toContain('"status":201');
  });

  it("serializes errors without exposing contact details", () => {
    logger.error("test", "Request failed", new Error("Account student@example.com failed"));

    const output = vi.mocked(console.error).mock.calls[0][0] as string;
    expect(output).toContain('"type":"Error"');
    expect(output).not.toContain("student@example.com");
  });

  it("redacts phone-shaped digit runs in free text while preserving dates", () => {
    logger.warn("test", "Caller left a number: 555-867-5309 and +1 (304) 555-0100 on 2026-08-16");

    const output = vi.mocked(console.warn).mock.calls[0][0] as string;
    expect(output).not.toContain("555-867-5309");
    expect(output).not.toContain("(304) 555-0100");
    expect(output).toContain("2026-08-16");
  });
});
