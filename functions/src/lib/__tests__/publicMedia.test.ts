import { describe, expect, it } from "vitest";
import {
  firebaseStorageObjectFromUrl,
  managedSponsorLogoPath,
  safeSponsorLogoPath,
  sponsorLogoGatewayUrl,
} from "../publicMedia";

describe("public media boundaries", () => {
  it("parses canonical Firebase and Google Storage URLs", () => {
    expect(firebaseStorageObjectFromUrl(
      "https://firebasestorage.googleapis.com/v0/b/ares.appspot.com/o/editor%2Fuploads%2Fsponsors%2Flogo.png?alt=media",
    )).toEqual({ bucket: "ares.appspot.com", path: "editor/uploads/sponsors/logo.png" });
    expect(firebaseStorageObjectFromUrl(
      "https://storage.googleapis.com/ares.appspot.com/public-media/sponsors/logo.webp",
    )).toEqual({ bucket: "ares.appspot.com", path: "public-media/sponsors/logo.webp" });
    expect(firebaseStorageObjectFromUrl(
      "https://ares.appspot.com.storage.googleapis.com/public-media/sponsors/logo.webp",
    )).toEqual({ bucket: "ares.appspot.com", path: "public-media/sponsors/logo.webp" });
  });

  it("rejects malformed, non-Google, and traversal URLs", () => {
    for (const value of [
      null,
      "http://storage.googleapis.com/bucket/path.png",
      "https://example.org/logo.png",
      "https://firebasestorage.googleapis.com/v0/b/bucket/o/%E0%A4%A",
    ]) {
      expect(firebaseStorageObjectFromUrl(value)).toBeNull();
    }
    expect(safeSponsorLogoPath("public-media/sponsors/../private.png")).toBeNull();
    expect(safeSponsorLogoPath("gallery/logo.png")).toBeNull();
    expect(safeSponsorLogoPath("public-media/sponsors/logo.svg")).toBeNull();
  });

  it("accepts only sponsor image namespaces in the expected bucket", () => {
    expect(safeSponsorLogoPath("public-media/sponsors/logo.webp"))
      .toBe("public-media/sponsors/logo.webp");
    expect(safeSponsorLogoPath("editor/uploads/sponsors/legacy.gif"))
      .toBe("editor/uploads/sponsors/legacy.gif");
    expect(managedSponsorLogoPath(
      "https://firebasestorage.googleapis.com/v0/b/ares.appspot.com/o/editor%2Fuploads%2Fsponsors%2Flogo.png",
      "ares.appspot.com",
    )).toBe("editor/uploads/sponsors/logo.png");
    expect(managedSponsorLogoPath(
      "https://firebasestorage.googleapis.com/v0/b/other.appspot.com/o/editor%2Fuploads%2Fsponsors%2Flogo.png",
      "ares.appspot.com",
    )).toBeNull();
  });

  it("builds encoded public and administrator gateway URLs", () => {
    expect(sponsorLogoGatewayUrl("sp_one")).toBe("/api/photos/public/sponsor-logo/sp_one");
    expect(sponsorLogoGatewayUrl("sp one", true)).toBe("/api/photos/admin/sponsor-logo/sp%20one");
  });
});
