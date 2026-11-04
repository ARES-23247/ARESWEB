import { describe, expect, it } from "vitest";
import {
  hasPublicContentLifecycle,
  isPublishedContent,
  resolvePublishedContentData,
} from "../contentVisibility";

describe("shared publication lifecycle", () => {
  it.each([undefined, 0, false])("preserves legacy active flag %s", (isDeleted) => {
    for (const approvalStatus of [undefined, "approved"]) {
      const data = { isDeleted, approvalStatus, status: "published" };
      expect(hasPublicContentLifecycle(data)).toBe(true);
      expect(isPublishedContent(data)).toBe(true);
      expect(resolvePublishedContentData(data)).toEqual(data);
    }
  });
  it.each([true, 1, "1", "0", null, {}, 2])("fails closed for deleted or malformed flag %s", (isDeleted) => {
    expect(isPublishedContent({ status: "published", isDeleted })).toBe(false);
    expect(resolvePublishedContentData({ status: "published", isDeleted })).toBeNull();
  });
  it.each(["draft", "pending_approval", undefined])("requires published status: %s", (status) => {
    expect(isPublishedContent({ status, isDeleted: 0 })).toBe(false);
    expect(resolvePublishedContentData({ status, isDeleted: 0 })).toBeNull();
  });
  it.each(["pending_approval", "rejected", null])("rejects unapproved content without snapshot: %s", (approvalStatus) => {
    expect(isPublishedContent({ status: "published", isDeleted: 0, approvalStatus })).toBe(false);
    expect(resolvePublishedContentData({ status: "published", isDeleted: 0, approvalStatus })).toBeNull();
  });
  it("resolves publishedSnapshot when a published record has a staged pending edit", () => {
    const staged = {
      status: "published",
      isDeleted: 0,
      approvalStatus: "pending_approval",
      title: "Student Pending Title",
      content: "Student Pending Body",
      publishedSnapshot: {
        title: "Live Approved Title",
        content: "Live Approved Body",
      },
    };
    expect(hasPublicContentLifecycle(staged)).toBe(true);
    expect(isPublishedContent(staged)).toBe(true);
    expect(resolvePublishedContentData(staged)).toMatchObject({
      status: "published",
      isDeleted: 0,
      approvalStatus: "approved",
      title: "Live Approved Title",
      content: "Live Approved Body",
    });
  });
  it("rejects non-object publishedSnapshot values on pending_approval records", () => {
    expect(
      isPublishedContent({
        status: "published",
        isDeleted: 0,
        approvalStatus: "pending_approval",
        publishedSnapshot: ["invalid"],
      }),
    ).toBe(false);
  });
});
