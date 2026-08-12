import { describe, expect, it } from "vitest";
import { isTrustedGoogleDriveUrl } from "@/components/dashboard/DocFormAttachmentFields";

describe("isTrustedGoogleDriveUrl", () => {
  it("accepts only credential-free HTTPS links on the exact Drive host", () => {
    expect(isTrustedGoogleDriveUrl("https://drive.google.com/file/d/1SAFE_FILE_ID_123/view")).toBe(true);
    expect(isTrustedGoogleDriveUrl("  https://drive.google.com/drive/folders/1SAFE_FOLDER_ID_123  ")).toBe(true);
    expect(isTrustedGoogleDriveUrl("http://drive.google.com/file/d/1SAFE_FILE_ID_123/view")).toBe(false);
    expect(isTrustedGoogleDriveUrl("https://drive.google.com.evil.example/file/d/1SAFE_FILE_ID_123/view")).toBe(false);
    expect(isTrustedGoogleDriveUrl("https://drive.google.com@evil.example/file/d/1SAFE_FILE_ID_123/view")).toBe(false);
    expect(isTrustedGoogleDriveUrl("https://drive.google.com:444/file/d/1SAFE_FILE_ID_123/view")).toBe(false);
    expect(isTrustedGoogleDriveUrl("not-a-url")).toBe(false);
  });
});
