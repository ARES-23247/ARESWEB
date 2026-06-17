import { describe, it, expect } from "vitest";
import { cleanThumbnailUrl, maskEmail } from "../lib/utils";

describe("utils", () => {
  describe("cleanThumbnailUrl", () => {
    it("should return empty string for empty input", () => {
      expect(cleanThumbnailUrl("")).toBe("");
      expect(cleanThumbnailUrl(undefined)).toBe("");
    });

    it("should pass through already clean URLs", () => {
      const cleanUrl = "https://i9.ytimg.com/vi/BDPfxLz1HcY/hqdefault.jpg";
      expect(cleanThumbnailUrl(cleanUrl)).toBe(cleanUrl);
    });

    it("should extract direct URLs from legacy proxied paths with single slash", () => {
      const proxiedUrl = "https://aresfirst-portal.web.app/api/media/https:/i9.ytimg.com/vi/BDPfxLz1HcY/hqdefault.jpg?sqp=CKD4ktAG";
      const expected = "https://i9.ytimg.com/vi/BDPfxLz1HcY/hqdefault.jpg?sqp=CKD4ktAG";
      expect(cleanThumbnailUrl(proxiedUrl)).toBe(expected);
    });

    it("should extract direct URLs from legacy proxied paths with double slash", () => {
      const proxiedUrl = "https://aresfirst-portal.web.app/api/media/https://i9.ytimg.com/vi/BDPfxLz1HcY/hqdefault.jpg";
      const expected = "https://i9.ytimg.com/vi/BDPfxLz1HcY/hqdefault.jpg";
      expect(cleanThumbnailUrl(proxiedUrl)).toBe(expected);
    });

    it("should extract direct URLs from relative legacy proxied paths", () => {
      const proxiedUrl = "/api/media/https:/i9.ytimg.com/vi/BDPfxLz1HcY/hqdefault.jpg";
      const expected = "https://i9.ytimg.com/vi/BDPfxLz1HcY/hqdefault.jpg";
      expect(cleanThumbnailUrl(proxiedUrl)).toBe(expected);
    });

    it("should handle percent-encoded legacy proxied URLs", () => {
      const encodedUrl = "https://aresfirst-portal.web.app/api/media/https%3A%2F%2Fi9.ytimg.com%2Fvi%2FBDPfxLz1HcY%2Fhqdefault.jpg";
      const expected = "https://i9.ytimg.com/vi/BDPfxLz1HcY/hqdefault.jpg";
      expect(cleanThumbnailUrl(encodedUrl)).toBe(expected);
    });
  });

  describe("maskEmail", () => {
    it("should mask long emails leaving first/last chars", () => {
      expect(maskEmail("david@example.com")).toBe("d***d@example.com");
      expect(maskEmail("john.doe@example.com")).toBe("j******e@example.com");
    });

    it("should mask short emails", () => {
      expect(maskEmail("ab@example.com")).toBe("a***@example.com");
      expect(maskEmail("a@example.com")).toBe("a***@example.com");
    });

    it("should return empty or pass through invalid formats", () => {
      expect(maskEmail(null)).toBe("");
      expect(maskEmail("notanemail")).toBe("notanemail");
    });
  });
});
