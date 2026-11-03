import { authenticatedFetch } from "@/lib/api";
import { logger } from "@/utils/logger";

export type ApprovalQueueCollection =
  | "posts"
  | "docs"
  | "documents"
  | "events"
  | "event_locations";

export async function notifyPendingApprovalQueue(
  collection: ApprovalQueueCollection,
  contentId: string,
): Promise<boolean> {
  if (!contentId.trim()) return false;
  try {
    const response = await authenticatedFetch("/api/content-admin/notify-pending", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collection, contentId }),
    });
    if (!response.ok) {
      logger.warn("Pending approval notification request was rejected", {
        collection,
        contentId,
        status: response.status,
      });
      return false;
    }
    const payload = (await response.json()) as { delivered?: unknown };
    return payload.delivered === true;
  } catch (error) {
    logger.warn("Pending approval notification failed", {
      collection,
      contentId,
      error,
    });
    return false;
  }
}
