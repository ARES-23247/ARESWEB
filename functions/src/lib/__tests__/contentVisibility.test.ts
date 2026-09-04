import { describe, expect, it } from "vitest";
import { hasPublicContentLifecycle, isPublishedContent } from "../contentVisibility";

describe("shared publication lifecycle", () => {
  it.each([undefined, 0, false])("preserves legacy active flag %s", (isDeleted) => {
    for (const approvalStatus of [undefined, "approved"]) {
      const data = { isDeleted, approvalStatus, status: "published" };
      expect(hasPublicContentLifecycle(data)).toBe(true);
      expect(isPublishedContent(data)).toBe(true);
    }
  });
  it.each([true, 1, "1", "0", null, {}, 2])("fails closed for deleted or malformed flag %s", (isDeleted) => {
    expect(isPublishedContent({ status: "published", isDeleted })).toBe(false);
  });
  it.each(["draft", "pending_approval", undefined])("requires published status: %s", (status) => {
    expect(isPublishedContent({ status, isDeleted: 0 })).toBe(false);
  });
  it.each(["pending_approval", "rejected", null])("rejects unapproved content: %s", (approvalStatus) => {
    expect(isPublishedContent({ status: "published", isDeleted: 0, approvalStatus })).toBe(false);
  });
});
