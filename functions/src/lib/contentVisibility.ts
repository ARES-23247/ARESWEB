/** Legacy records may omit deletion/approval fields or use false for active.
 * Unknown deletion values fail closed; new writes use numeric 0/1.
 * Use this after a published-only query, or isPublishedContent for direct reads.
 */
export function hasPublicContentLifecycle(data: Record<string, unknown>): boolean {
  return (data.isDeleted === undefined || data.isDeleted === 0 || data.isDeleted === false)
    && (data.approvalStatus === undefined || data.approvalStatus === "approved");
}

export function isPublishedContent(data: Record<string, unknown>): boolean {
  return data.status === "published" && hasPublicContentLifecycle(data);
}
