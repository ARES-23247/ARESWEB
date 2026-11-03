import { logger } from "./logger";

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
      const errorText = await res.text();
      logger.error("zulip", "Failed to send message", { status: res.status, error: errorText });
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
  const actor = input.authorLabel?.trim() || "An ARES team member";
  const portalUrl = `https://aresfirst.org${input.dashboardPath}`;
  const content = [
    `**[${input.section}] Pending Review: ${input.title}**`,
    `${actor} ${actionLabel} (\`${input.contentId}\`).`,
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

