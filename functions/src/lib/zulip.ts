import crypto from "crypto";
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

export async function createZulipUser(
  userEmail: string,
  fullName: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  const { url, email, apiKey } = getZulipCredentials();

  if (!email || !apiKey) {
    return { success: false, error: "Zulip integration is not active (missing bot email or api key)." };
  }

  const cleanEmail = userEmail.trim().toLowerCase();
  const cleanName = fullName.trim();
  const auth = Buffer.from(`${email}:${apiKey}`).toString("base64");

  // Attempt 1: Direct user creation (available on self-hosted or human admin keys)
  try {
    const endpoint = `${url}/api/v1/users`;
    const password = crypto.randomBytes(16).toString("hex") + "aA1!";

    const params = new URLSearchParams();
    params.append("email", cleanEmail);
    params.append("password", password);
    params.append("full_name", cleanName);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (res.ok) {
      return { success: true, message: `Zulip account created for ${cleanEmail}` };
    }

    const errorData = await res.json().catch(() => ({}));
    const msg = (errorData.msg || "").toLowerCase();
    if (msg.includes("already") || msg.includes("exists") || msg.includes("member")) {
      return { success: true, message: `${cleanEmail} is already registered on Zulip.` };
    }
    logger.warn("zulip", "Direct user creation failed, attempting invitation fallback", { status: res.status, error: errorData });
  } catch (err: any) {
    logger.warn("zulip", "Exception in direct user creation", { error: err });
  }

  // Attempt 2: Zulip Invitation API (available for Admin Bots on Zulip Cloud)
  try {
    const inviteEndpoint = `${url}/api/v1/invites`;
    const inviteParams = new URLSearchParams();
    inviteParams.append("invitee_emails", cleanEmail);

    const inviteRes = await fetch(inviteEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: inviteParams.toString(),
    });

    if (inviteRes.ok) {
      return { success: true, message: `Zulip invitation email sent to ${cleanEmail}` };
    }

    const inviteError = await inviteRes.json().catch(() => ({}));
    const msg = (inviteError.msg || "").toLowerCase();
    if (msg.includes("already") || msg.includes("exists") || msg.includes("member")) {
      return { success: true, message: `${cleanEmail} is already a member of the Zulip workspace.` };
    }

    const errorMsg = inviteError.msg || `Zulip invite failed with status ${inviteRes.status}`;
    logger.error("zulip", "Failed to invite user via Zulip API", { status: inviteRes.status, error: inviteError });
    return { success: false, error: errorMsg };
  } catch (err: any) {
    logger.error("zulip", "Exception in Zulip user invitation", { error: err });
    return { success: false, error: err.message || "Internal server error inviting user." };
  }
}

