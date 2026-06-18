import { describe, it, expect } from "vitest";
import {
  signTutorialProgress,
  verifyTutorialProgress,
  sanitizeHtml,
  validateUrlParam,
  validateIdParam
} from "../lib/security";

describe("security utilities", () => {
  describe("HMAC Tutorial Progress", () => {
    it("should sign and verify valid progress data", async () => {
      const progress = ["step1", "step2", "step3"];
      const signed = await signTutorialProgress(progress);
      
      expect(signed).toBeDefined();
      expect(signed.progress).toEqual(progress);
      expect(signed.signature).toBeTypeOf("string");

      const verified = await verifyTutorialProgress(signed);
      expect(verified).toEqual(progress);
    });

    it("should fail validation if signature is modified", async () => {
      const progress = ["step1", "step2"];
      const signed = await signTutorialProgress(progress);
      
      const tampered = {
        progress: signed.progress,
        signature: signed.signature.slice(0, -2) + "00" // Tamper signature
      };

      const verified = await verifyTutorialProgress(tampered);
      expect(verified).toBeNull();
    });

    it("should fail validation if progress items are modified", async () => {
      const progress = ["step1", "step2"];
      const signed = await signTutorialProgress(progress);
      
      const tampered = {
        progress: ["step1", "step2", "tampered_step"],
        signature: signed.signature
      };

      const verified = await verifyTutorialProgress(tampered);
      expect(verified).toBeNull();
    });

    it("should return null for invalid inputs", async () => {
      expect(await verifyTutorialProgress(null)).toBeNull();
      expect(await verifyTutorialProgress({})).toBeNull();
      expect(await verifyTutorialProgress({ progress: [] })).toBeNull();
    });
  });

  describe("sanitizeHtml", () => {
    it("should pass through clean text and safe tags", () => {
      const clean = "<p>Hello <strong>World</strong></p>";
      expect(sanitizeHtml(clean)).toBe(clean);
    });

    it("should strip malicious script tags", () => {
      const dirty = "<p>Hello <script>alert('xss')</script>World</p>";
      const expected = "<p>Hello World</p>";
      expect(sanitizeHtml(dirty)).toBe(expected);
    });

    it("should strip onload and onerror attributes", () => {
      const dirty = `<img src="x" onerror="alert('xss')" />`;
      const expected = `<img src="x">`;
      expect(sanitizeHtml(dirty)).toBe(expected);
    });

    it("should return empty string for empty input", () => {
      expect(sanitizeHtml("")).toBe("");
    });
  });

  describe("validateUrlParam", () => {
    it("should return validated safe string", () => {
      expect(validateUrlParam("about")).toBe("about");
      expect(validateUrlParam("page-name_1")).toBe("page-name_1");
    });

    it("should reject traversals and scripts", () => {
      expect(validateUrlParam("../about")).toBeNull();
      expect(validateUrlParam("<script>")).toBeNull();
      expect(validateUrlParam("javascript:alert(1)")).toBeNull();
      expect(validateUrlParam("data:text/html,xss")).toBeNull();
    });

    it("should reject unsafe characters", () => {
      expect(validateUrlParam("about?name=test")).toBeNull();
      expect(validateUrlParam("about#hash")).toBeNull();
      expect(validateUrlParam("about;select")).toBeNull();
    });

    it("should reject inputs exceeding length limit", () => {
      const longInput = "a".repeat(257);
      expect(validateUrlParam(longInput)).toBeNull();
    });

    it("should handle undefined and empty input", () => {
      expect(validateUrlParam(undefined)).toBeNull();
      expect(validateUrlParam("")).toBeNull();
    });
  });

  describe("validateIdParam", () => {
    it("should allow UUID format", () => {
      const uuid = "123e4567-e89b-12d3-a456-426614174000";
      expect(validateIdParam(uuid)).toBe(uuid);
    });

    it("should allow numeric IDs", () => {
      expect(validateIdParam("12345")).toBe("12345");
    });

    it("should allow slug-like formats", () => {
      expect(validateIdParam("valid-slug-name-123")).toBe("valid-slug-name-123");
    });

    it("should reject invalid/unsafe IDs", () => {
      expect(validateIdParam("invalid_id/name")).toBeNull();
      expect(validateIdParam("../traversal")).toBeNull();
      expect(validateIdParam("invalid--slug--format")).toBeNull();
      expect(validateIdParam("invalid@slug")).toBeNull();
    });

    it("should reject inputs exceeding length limit", () => {
      const longInput = "a".repeat(129);
      expect(validateIdParam(longInput)).toBeNull();
    });

    it("should handle undefined and empty input", () => {
      expect(validateIdParam(undefined)).toBeNull();
      expect(validateIdParam("")).toBeNull();
    });
  });
});
