function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Resolves the publicly visible version of a content record (`posts`, `docs`, `documents`).
 * When a published record has a staged pending edit (`status === "published"`,
 * `approvalStatus === "pending_approval"`, and `publishedSnapshot` is a plain object),
 * returns the last approved snapshot so the public website continues serving the
 * approved version until a mentor/coach approves or discards the pending edit.
 */
export function resolvePublishedContentData(
  data: Record<string, unknown>,
): Record<string, unknown> | null {
  if (!hasPublicContentLifecycle(data) || data.status !== "published") {
    return null;
  }
  if (data.approvalStatus === "pending_approval" && isPlainObject(data.publishedSnapshot)) {
    const { publishedSnapshot: _nested, ...snapshotFields } = data.publishedSnapshot;
    return {
      ...data,
      ...snapshotFields,
      status: "published",
      approvalStatus: "approved",
      isDeleted: 0,
    };
  }
  return data;
}

/** Legacy records may omit deletion/approval fields or use false for active.
 * Unknown deletion values fail closed; new writes use numeric 0/1.
 * Use this after a published-only query, or isPublishedContent for direct reads.
 */
export function hasPublicContentLifecycle(data: Record<string, unknown>): boolean {
  const isActive =
    data.isDeleted === undefined || data.isDeleted === 0 || data.isDeleted === false;
  if (!isActive) return false;
  if (data.approvalStatus === undefined || data.approvalStatus === "approved") {
    return true;
  }
  return data.approvalStatus === "pending_approval" && isPlainObject(data.publishedSnapshot);
}

export function isPublishedContent(data: Record<string, unknown>): boolean {
  return resolvePublishedContentData(data) !== null;
}
