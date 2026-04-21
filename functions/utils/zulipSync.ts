import { Bindings, logSystemError } from "../api/routes/_shared";

function getZulipAuthHeaders(env: Bindings): HeadersInit {
  if (!env.ZULIP_BOT_EMAIL || !env.ZULIP_API_KEY) {
    throw new Error("Missing ZULIP credentials in bindings");
  }
  // btoa is available in Cloudflare Workers
  const authHeader = "Basic " + btoa(`${env.ZULIP_BOT_EMAIL}:${env.ZULIP_API_KEY}`);
  return {
    "Authorization": authHeader,
  };
}

function getZulipBaseUrl(env: Bindings): string {
  return env.ZULIP_URL || "https://ares.zulipchat.com";
}

/**
 * Sends a message to a specific Zulip stream and topic.
 * Returns the Zulip message ID if successful.
 */
export async function sendZulipMessage(
  env: Bindings,
  stream: string,
  topic: string,
  content: string
): Promise<string | null> {
  try {
    const url = `${getZulipBaseUrl(env)}/api/v1/messages`;
    const formData = new URLSearchParams();
    formData.append("type", "stream");
    formData.append("to", stream);
    formData.append("topic", topic);
    formData.append("content", content);

    const headers: Record<string, string> = { 
      ...getZulipAuthHeaders(env) as Record<string, string>,
      "Content-Type": "application/x-www-form-urlencoded"
    };

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: formData.toString()
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("[ZulipSync] Failed to send message:", errorText);
      await logSystemError(env.DB, "Zulip", "Failed to send message", errorText);
      return null;
    }

    const data = await res.json() as { result: string; id: number };
    if (data.result === "success") {
      return String(data.id);
    }
    await logSystemError(env.DB, "Zulip", "Zulip API returned non-success", JSON.stringify(data));
    return null;
  } catch (err) {
    console.error("[ZulipSync] Exception sending message:", err);
    await logSystemError(env.DB, "Zulip", "Exception in sendZulipMessage", String(err));
    return null;
  }
}

/**
 * Updates an existing Zulip message.
 */
export async function updateZulipMessage(
  env: Bindings,
  messageId: string,
  newContent: string
): Promise<boolean> {
  try {
    const url = `${getZulipBaseUrl(env)}/api/v1/messages/${messageId}`;
    const formData = new URLSearchParams();
    formData.append("content", newContent);

    const headers: Record<string, string> = { 
      ...getZulipAuthHeaders(env) as Record<string, string>,
      "Content-Type": "application/x-www-form-urlencoded"
    };

    const res = await fetch(url, {
      method: "PATCH",
      headers,
      body: formData.toString()
    });

    if (!res.ok) {
      console.error("[ZulipSync] Failed to update message:", await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[ZulipSync] Exception updating message:", err);
    return false;
  }
}

/**
 * Deletes a Zulip message.
 */
export async function deleteZulipMessage(
  env: Bindings,
  messageId: string
): Promise<boolean> {
  try {
    const url = `${getZulipBaseUrl(env)}/api/v1/messages/${messageId}`;
    const headers = getZulipAuthHeaders(env);

    const res = await fetch(url, {
      method: "DELETE",
      headers
    });

    if (!res.ok) {
      console.error("[ZulipSync] Failed to delete message:", await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[ZulipSync] Exception deleting message:", err);
    return false;
  }
}

/**
 * Convenience method to send administrative alerts (inquiries/applications) to Zulip
 */
export async function sendZulipAlert(
  env: Bindings,
  type: "Applicant" | "Sponsor" | "Outreach" | "System",
  title: string,
  markdownBody: string
) {
  const adminStream = env.ZULIP_ADMIN_STREAM || "leadership";
  const topic = `${type} Alerts`;
  
  const content = `**${title}**\n\n${markdownBody}`;
  
  await sendZulipMessage(env, adminStream, topic, content);
}
