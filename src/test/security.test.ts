import { describe, it, expect } from "vitest";
import {
  sanitizeHtml,
  validateIdParam
} from "../lib/security";

describe("security utilities", () => {
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
