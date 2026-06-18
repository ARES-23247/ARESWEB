import crypto from "crypto";

export async function sendZulipMessage(
  stream: string,
  topic: string,
  content: string
): Promise<boolean> {
  const url = process.env.ZULIP_URL || "https://aresfirst.zulipchat.com";
  const email = process.env.ZULIP_BOT_EMAIL;
  const apiKey = process.env.ZULIP_API_KEY;

  if (!email || !apiKey) {
    console.warn("[Zulip] Integration not active: ZULIP_BOT_EMAIL and/or ZULIP_API_KEY missing.");
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
      console.error("[Zulip] Failed to send message:", res.status, errorText);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[Zulip] Exception sending message:", err);
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

export async function getZulipUsers(): Promise<any[] | null> {
  const url = process.env.ZULIP_URL || "https://aresfirst.zulipchat.com";
  const email = process.env.ZULIP_BOT_EMAIL;
  const apiKey = process.env.ZULIP_API_KEY;

  if (!email || !apiKey) {
    console.warn("[Zulip] Integration not active: ZULIP_BOT_EMAIL and/or ZULIP_API_KEY missing.");
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
      console.error("[Zulip] Failed to fetch users:", res.status, errorText);
      return null;
    }

    const data = await res.json();
    return data.members || [];
  } catch (err) {
    console.error("[Zulip] Exception fetching users:", err);
    return null;
  }
}

export async function createZulipUser(
  userEmail: string,
  fullName: string
): Promise<{ success: boolean; error?: string }> {
  const url = process.env.ZULIP_URL || "https://aresfirst.zulipchat.com";
  const email = process.env.ZULIP_BOT_EMAIL;
  const apiKey = process.env.ZULIP_API_KEY;

  if (!email || !apiKey) {
    return { success: false, error: "Zulip integration is not active (missing bot email or api key)." };
  }

  try {
    const auth = Buffer.from(`${email}:${apiKey}`).toString("base64");
    const endpoint = `${url}/api/v1/users`;

    // Generate a secure random password
    const password = crypto.randomBytes(16).toString("hex") + "aA1!";

    const params = new URLSearchParams();
    params.append("email", userEmail.trim().toLowerCase());
    params.append("password", password);
    params.append("full_name", fullName.trim());

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const errorMsg = errorData.msg || `Zulip API returned status ${res.status}`;
      console.error("[Zulip] Failed to create user:", res.status, errorData);
      return { success: false, error: errorMsg };
    }

    return { success: true };
  } catch (err: any) {
    console.error("[Zulip] Exception creating user:", err);
    return { success: false, error: err.message || "Internal server error." };
  }
}
