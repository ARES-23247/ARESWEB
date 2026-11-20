import { adminDb } from "./firebase-admin";
import { getPublishedAnnouncement, SETTINGS_DOCUMENT, type AnnouncementDocument } from "./siteAnnouncement";
import { escapeZulipMarkdown, sendZulipMessage } from "./zulip";

// Longer than the Function timeout. A later tick can recover an abandoned send.
const LEASE_MS = 90_000;
const MAX_DELIVERY_ATTEMPTS = 5;
const MAX_BACKOFF_MS = 15 * 60_000;

function formatText(text: string): string {
  return escapeZulipMarkdown(text.replace(/[\s\p{Cc}\u202a-\u202e\u2066-\u2069]+/gu, " ").trim());
}

export async function deliverPendingAnnouncement(): Promise<void> {
  const ref = adminDb.collection("settings").doc(SETTINGS_DOCUMENT);
  const snapshot = await ref.get();
  const data = snapshot.data();
  const now = Date.now();
  if (data?.zulipDelivery !== "pending" || data.zulipLeaseUntil > now) return;
  const notice = getPublishedAnnouncement(data as AnnouncementDocument, now);
  if (!notice) return;

  const priorAttempts =
    typeof data.zulipAttempts === "number" && Number.isFinite(data.zulipAttempts) && data.zulipAttempts >= 0
      ? Math.floor(data.zulipAttempts)
      : 0;
  const attempt = priorAttempts + 1;

  // Both writes are conditional so overlapping runs and edits cannot claim
  // the same snapshot or acknowledge a newer publication.
  try {
    const claim = await ref.update(
      { zulipLeaseUntil: now + LEASE_MS, zulipAttempts: attempt },
      { lastUpdateTime: snapshot.updateTime },
    );
    if (notice.endsAt && Date.parse(notice.endsAt) <= Date.now()) return;
    const url = new URL(notice.link ?? "/", "https://aresfirst.org").href
      .replaceAll("(", "%28").replaceAll(")", "%29");
    const label = formatText(notice.linkLabel ?? "Visit the team website");
    const priority = { info: "Information", important: "Important", urgent: "Urgent" }[notice.severity];
    const content = `@**all** **${priority}**\n\n${formatText(notice.message)}\n\n[${label}](${url})`;
    const delivered = await sendZulipMessage("announcements", "Site announcements", content);
    if (!delivered) {
      if (attempt >= MAX_DELIVERY_ATTEMPTS) {
        await ref.update(
          { zulipDelivery: "failed", zulipLeaseUntil: 0 },
          { lastUpdateTime: claim.writeTime },
        );
        return;
      }
      const backoffMs = Math.min(LEASE_MS * Math.pow(2, attempt - 1), MAX_BACKOFF_MS);
      await ref.update(
        { zulipLeaseUntil: Date.now() + backoffMs },
        { lastUpdateTime: claim.writeTime },
      );
      throw new Error("Zulip did not accept the site announcement.");
    }
    await ref.update(
      { zulipDelivery: "sent", zulipLeaseUntil: 0, zulipDeliveredAt: new Date().toISOString() },
      { lastUpdateTime: claim.writeTime },
    );
  } catch (error) {
    // Firestore NOT_FOUND or FAILED_PRECONDITION means the notice changed.
    if (error && typeof error === "object" && "code" in error && (error.code === 5 || error.code === 9)) return;
    throw error;
  }
}
