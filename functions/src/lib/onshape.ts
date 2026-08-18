/**
 * Formats verified Onshape webhook events into Zulip team messages.
 *
 * Onshape webhooks only guarantee event type and document identifiers; every
 * human-readable field is optional, so all copy falls back to identifier-based
 * phrasing. Free-text fields are stripped of markdown metacharacters because
 * they render inside Zulip messages, and document ids are shape-validated by
 * the route schema before they reach the link template.
 */

export interface OnshapeEvent {
  eventType: string;
  documentId: string;
  documentName?: string;
  userName?: string;
  versionName?: string;
}

export interface OnshapeZulipMessage {
  stream: string;
  topic: string;
  content: string;
}

const DOCUMENT_URL_BASE = "https://cad.onshape.com/documents/";
const MAX_TOPIC_LENGTH = 60;

/** Remove markdown metacharacters from untrusted display text. */
export function sanitizeOnshapeText(value: string | undefined): string {
  if (typeof value !== "string") return "";
  return value.replace(/[[\]()`*_~>#]/g, "").replace(/\s+/g, " ").trim();
}

function truncateTopic(value: string): string {
  return value.length <= MAX_TOPIC_LENGTH
    ? value
    : `${value.slice(0, MAX_TOPIC_LENGTH - 1)}\u2026`;
}

/**
 * Returns the Zulip message for an event, or null when the event type is
 * intentionally not relayed (for example noisy document-modified events).
 */
export function formatOnshapeEvent(
  event: OnshapeEvent,
  stream: string,
): OnshapeZulipMessage | null {
  const actor = sanitizeOnshapeText(event.userName) || "A team member";
  const documentName =
    sanitizeOnshapeText(event.documentName) || `document ${event.documentId}`;
  const versionName = sanitizeOnshapeText(event.versionName);

  const action = (() => {
    switch (event.eventType) {
      case "version.created":
        return versionName
          ? `created version ${versionName} in *${documentName}*`
          : `created a new version in *${documentName}*`;
      case "document.created":
        return `created the CAD document *${documentName}*`;
      case "comment.created":
        return `commented on *${documentName}*`;
      case "revision.created":
        return `released a revision of *${documentName}*`;
      default:
        return null;
    }
  })();
  if (!action) return null;

  return {
    stream,
    topic: truncateTopic(`CAD \u00b7 ${documentName}`),
    content: `**[CAD]** ${actor} ${action}\n\n[Open in Onshape](${DOCUMENT_URL_BASE}${event.documentId})`,
  };
}
