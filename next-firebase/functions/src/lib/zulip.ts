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
    const auth = btoa(`${email}:${apiKey}`);
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
