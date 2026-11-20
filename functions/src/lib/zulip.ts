import { logger } from "./logger";

export function escapeZulipMarkdown(value: string): string {
  return value
    .replace(/@/gu, "@\u200B")
    .replace(/([\\`*_{}\[\]()<>#+.!|~-])/gu, "\\$1");
}

/**
 * Removes Zulip user/group/wildcard mentions across arbitrary nesting depths
 * and neutralizes any remaining `@` symbol so untrusted member text can never
 * trigger mentions or channel-wide pings under the workspace bot identity.
 */
export function sanitizeZulipUserText(value: string): string {
  let cleaned = value.replace(/[\p{Cc}\u202a-\u202e\u2066-\u2069]+/gu, " ");
  let previous = "";
  while (cleaned !== previous) {
    previous = cleaned;
    let innerPrev = "";
    while (cleaned !== innerPrev) {
      innerPrev = cleaned;
      cleaned = cleaned
        .replace(/@_?\*\*[^*@]+\*\*/gu, "")
        .replace(/@_?\*[^*@]+\*/gu, "");
    }
    cleaned = cleaned
      .replace(/@_?\*\*[^*]+\*\*/gu, "")
      .replace(/@_?\*[^*]+\*/gu, "")
      .replace(/(^|\s)@(?:all|everyone|channel|stream)\b/giu, "$1");
  }
  return cleaned
    .replace(/@/gu, "@\u200B")
    .replace(/\s+/gu, " ")
    .trim();
}

export function getZulipCredentials() {
  let url = (process.env.ZULIP_URL || "").trim();
  const configuredEmail = (process.env.ZULIP_BOT_EMAIL || "").trim();
  const configuredApiKey = (process.env.ZULIP_API_KEY || "").trim();

  if (!url || !url.startsWith("http")) {
    url = "https://aresfirst.zulipchat.com";
  }
  const email = configuredEmail.includes("@") && !["disabled", "none"].includes(configuredEmail.toLowerCase())
    ? configuredEmail
    : "";
  const apiKey = configuredApiKey.length >= 10 && !["disabled", "none"].includes(configuredApiKey.toLowerCase())
    ? configuredApiKey
    : "";

  return { url, email, apiKey };
}

export async function sendZulipMessage(
  stream: string,
  topic: string,
  content: string
): Promise<boolean> {
  const { url, email, apiKey } = getZulipCredentials();

  if (!email || !apiKey) {
    logger.warn("zulip", "Integration not active: ZULIP_BOT_EMAIL and/or ZULIP_API_KEY missing.");
    return false;
  }

  try {
    const auth = Buffer.from(`${email}:${apiKey}`).toString("base64");
    const endpoint = `${url}/api/v1/messages`;

    const params = new URLSearchParams();
    params.append("type", "stream");
    params.append("to", stream);
    params.append("topic", topic);
    params.append("content", content);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      logger.error("zulip", "Failed to send message", { status: res.status });
      return false;
    }

    return true;
  } catch (err) {
    logger.error("zulip", "Exception sending message", { error: err });
    return false;
  }
}

export async function sendZulipAlert(
  type: string,
  title: string,
  body: string
): Promise<boolean> {
  const adminStream = process.env.ZULIP_ADMIN_STREAM || "leadership";
  const topic = `${type} Alerts`;
  const content = `**${title}**\n\n${body}`;

  return sendZulipMessage(adminStream, topic, content);
}

export interface ApprovalQueueNotificationInput {
  section: string;
  title: string;
  contentId: string;
  authorLabel?: string;
  dashboardPath: string;
  isStagedEdit?: boolean;
}

export async function sendZulipApprovalQueueNotification(
  input: ApprovalQueueNotificationInput,
): Promise<boolean> {
  const adminStream = process.env.ZULIP_ADMIN_STREAM || "leadership";
  const topic = "Content Approval Queue";
  const actionLabel = input.isStagedEdit
    ? "submitted a pending edit to a published item"
    : "submitted an item for mentor/coach review";
  const formatInline = (text: string) =>
    escapeZulipMarkdown(
      text.replace(/[\s\p{Cc}\u202a-\u202e\u2066-\u2069]+/gu, " ").trim(),
    );
  const safeSection = formatInline(input.section);
  const safeTitle = formatInline(input.title);
  const safeContentId = input.contentId
    .replace(/[`@\r\n\p{Cc}\u202a-\u202e\u2066-\u2069]/gu, "")
    .trim();
  const actor = formatInline(input.authorLabel?.trim() || "An ARES team member");
  const safePath =
    typeof input.dashboardPath === "string" &&
    input.dashboardPath.startsWith("/") &&
    !input.dashboardPath.startsWith("//") &&
    !/[\s\p{Cc}]/u.test(input.dashboardPath)
      ? input.dashboardPath
      : "/dashboard";
  const portalUrl = `https://aresfirst.org${safePath}`;
  const content = [
    `**[${safeSection}] Pending Review: ${safeTitle}**`,
    `${actor} ${actionLabel} (\`${safeContentId}\`).`,
    `Review in dashboard: ${portalUrl}`,
  ].join("\n\n");

  return sendZulipMessage(adminStream, topic, content);
}

export interface ZulipUser {
  user_id?: number;
  email?: string;
  full_name?: string;
  is_active?: boolean;
  [key: string]: unknown;
}

export async function getZulipUsers(): Promise<ZulipUser[] | null> {
  const { url, email, apiKey } = getZulipCredentials();

  if (!email || !apiKey) {
    logger.warn("zulip", "Integration not active: ZULIP_BOT_EMAIL and/or ZULIP_API_KEY missing.");
    return null;
  }

  try {
    const auth = Buffer.from(`${email}:${apiKey}`).toString("base64");
    const endpoint = `${url}/api/v1/users`;

    const res = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const errorText = await res.text();
      logger.error("zulip", "Failed to fetch users", { status: res.status, error: errorText });
      return null;
    }

    const data = await res.json() as { members?: ZulipUser[] };
    return data.members || [];
  } catch (err) {
    logger.error("zulip", "Exception fetching users", { error: err });
    return null;
  }
}

