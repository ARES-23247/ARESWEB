import { adminDb } from "./firebase-admin";
import { getPublishedAnnouncement, SETTINGS_DOCUMENT, type AnnouncementDocument } from "./siteAnnouncement";
import { escapeZulipMarkdown, sendZulipMessage } from "./zulip";

// Longer than the Function timeout. A later tick can recover an abandoned send.
const LEASE_MS = 90_000;

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

  // Both writes are conditional so overlapping runs and edits cannot claim
  // the same snapshot or acknowledge a newer publication.
  try {
    const claim = await ref.update({ zulipLeaseUntil: now + LEASE_MS }, {
      lastUpdateTime: snapshot.updateTime,
    });
    if (notice.endsAt && Date.parse(notice.endsAt) <= Date.now()) return;
    const url = new URL(notice.link ?? "/", "https://aresfirst.org").href
      .replaceAll("(", "%28").replaceAll(")", "%29");
    const label = formatText(notice.linkLabel ?? "Visit the team website");
    const priority = { info: "Information", important: "Important", urgent: "Urgent" }[notice.severity];
    const content = `@**all** **${priority}**\n\n${formatText(notice.message)}\n\n[${label}](${url})`;
    if (!await sendZulipMessage("announcements", "Site announcements", content)) {
      throw new Error("Zulip did not accept the site announcement.");
    }
    await ref.update({ zulipDelivery: "sent", zulipLeaseUntil: 0 }, { lastUpdateTime: claim.writeTime });
  } catch (error) {
    // Firestore NOT_FOUND or FAILED_PRECONDITION means the notice changed.
    if (error && typeof error === "object" && "code" in error && (error.code === 5 || error.code === 9)) return;
    throw error;
  }
}
