/* eslint-disable @typescript-eslint/no-explicit-any */
import { Bindings, logSystemError } from "../api/middleware";
import pRetry from "p-retry";
import { z } from "zod";

/**
 * Minimal credentials needed for Zulip API calls.
 */

// ... (interface remains same)

const ZulipResponseSchema = z.object({
  result: z.string(),
  id: z.number().optional(),
  msg: z.string().optional(),
});

type ZulipCredentials = any;
type ZulipEnv = Bindings | ZulipCredentials;
const getZulipAuthHeaders = (env: any) => ({ 
  "Authorization": "Basic " + btoa(unescape(encodeURIComponent(env.ZULIP_EMAIL + ":" + env.ZULIP_API_KEY))) 
});

// ... (headers and url helpers remain same)

/**
 * Sends a message to a specific Zulip stream and topic.
 */
export async function sendZulipMessage(
  env: Bindings | ZulipCredentials,
  stream: string,
  topic: string,
  content: string
): Promise<string | null> {
  const runDispatch = async () => {
    const url = `${(env.ZULIP_URL || "https://ares.zulipchat.com")}/api/v1/messages`;
    const formData = new URLSearchParams();
    formData.append("type", "stream");
    formData.append("to", stream);
    formData.append("topic", topic);
    formData.append("content", content);

    const headers: Record<string, string> = { 
      ...getZulipAuthHeaders(env) as Record<string, string>,
      "Content-Type": "application/x-www-form-urlencoded"
    };

    const res = await fetch(url, { signal: AbortSignal.timeout(5000),
      method: "POST",
      headers,
      body: formData.toString()
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Zulip API Error ${res.status}: ${errorText}`);
    }

    const rawData = await res.json();
    const data = ZulipResponseSchema.parse(rawData);

    if (data.result !== "success") {
      throw new Error(`Zulip Business Error: ${data.msg || "unknown"}`);
    }

    return String(data.id);
  };

  try {
    return await pRetry(runDispatch, {
      retries: 3,
      onFailedAttempt: error => {
        console.warn(`[ZulipSync] Attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`);
      }
    });
  } catch (err) {
    console.error("[ZulipSync] Critical failure after retries:", err);
    const db = 'DB' in env ? env.DB : undefined;
    if (db) await logSystemError(db as any, "Zulip", "Critical failure after retries", String(err));
    return null;
  }
}

/**
 * Updates an existing Zulip message.
 */
export async function updateZulipMessage(
  env: ZulipEnv,
  messageId: string,
  newContent: string
): Promise<boolean> {
  const runUpdate = async () => {
    const url = `${(env.ZULIP_URL || "https://ares.zulipchat.com")}/api/v1/messages/${messageId}`;
    const formData = new URLSearchParams();
    formData.append("content", newContent);

    const headers: Record<string, string> = { 
      ...getZulipAuthHeaders(env) as Record<string, string>,
      "Content-Type": "application/x-www-form-urlencoded"
    };

    const res = await fetch(url, { signal: AbortSignal.timeout(5000),
      method: "PATCH",
      headers,
      body: formData.toString()
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Zulip Update Error ${res.status}: ${errorText}`);
    }
    return true;
  };

  try {
    return await pRetry(runUpdate, {
      retries: 2,
      onFailedAttempt: error => {
        console.warn(`[ZulipSync] Update attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`);
      }
    });
  } catch (err) {
    console.error("[ZulipSync] Exception updating message:", err);
    return false;
  }
}

/**
 * Deletes a Zulip message.
 */
export async function deleteZulipMessage(
  env: ZulipEnv,
  messageId: string
): Promise<boolean> {
  const runDelete = async () => {
    const url = `${(env.ZULIP_URL || "https://ares.zulipchat.com")}/api/v1/messages/${messageId}`;
    const headers = getZulipAuthHeaders(env);

    const res = await fetch(url, { signal: AbortSignal.timeout(5000),
      method: "DELETE",
      headers
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Zulip Delete Error ${res.status}: ${errorText}`);
    }
    return true;
  };

  try {
    return await pRetry(runDelete, {
      retries: 2,
      onFailedAttempt: error => {
        console.warn(`[ZulipSync] Delete attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`);
      }
    });
  } catch (err) {
    console.error("[ZulipSync] Exception deleting message:", err);
    return false;
  }
}

/**
 * Convenience method to send administrative alerts (inquiries/applications) to Zulip
 */
export async function sendZulipAlert(
  env: ZulipEnv,
  type: "Applicant" | "Sponsor" | "Outreach" | "System",
  title: string,
  markdownBody: string
) {
  const adminStream = env.ZULIP_ADMIN_STREAM || "leadership";
  const topic = `${type} Alerts`;
  
  const content = `**${title}**\n\n${markdownBody}`;
  
  await sendZulipMessage(env, adminStream, topic, content);
}
