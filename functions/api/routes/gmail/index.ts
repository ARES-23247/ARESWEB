import { OpenAPIHono } from "@hono/zod-openapi";
import { z } from "zod";
import type { AppEnv } from "../../middleware/utils";
import { ensureAdmin } from "../../middleware";
import {
  checkAuthStatusRoute,
  listMessagesRoute,
  getMessageRoute,
  getThreadRoute,
  listLabelsRoute,
  sendMessageRoute,
} from "../../../../shared/routes/gmail";
import { getDb } from "../../middleware";
import { settings } from "../../../../src/db/schema";
import { eq } from "drizzle-orm";
import { getUnifiedOAuthToken } from "../../utils/googleAuth";

const adminApp = new OpenAPIHono<AppEnv>();

// Only allow coaches and mentors to access Gmail
adminApp.use("*", ensureAdmin);

const routes = adminApp
  .openapi(checkAuthStatusRoute, async (c) => {
    const db = getDb(c);
    const tokenSetting = await db
      .select()
      .from(settings)
      .where(eq(settings.key, "youtube_refresh_token"))
      .execute()
      .then((res: Array<{ key: string; value: string | null }>) => res[0]);

    const user = c.get("sessionUser");
    return c.json(
      {
        isAuthenticated: !!tokenSetting?.value,
        memberType: user?.memberType as "student" | "mentor" | "coach" | undefined,
      },
      200
    );
  })
  .openapi(listLabelsRoute, async (c) => {
    const db = getDb(c);
    const env = c.env;

    const accessToken = await getUnifiedOAuthToken(env, db);

    const response = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/labels`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to list Gmail labels:", errorText);
      throw new Error(`Gmail API Error: ${errorText}`);
    }

    const data = await response.json();
    return c.json(data, 200);
  })
  .openapi(listMessagesRoute, async (c) => {
    const db = getDb(c);
    const env = c.env;
    const { labelIds = "INBOX", maxResults = 20, pageToken, q } = c.req.valid("query");

    const accessToken = await getUnifiedOAuthToken(env, db);

    const url = new URL(`https://www.googleapis.com/gmail/v1/users/me/messages`);
    if (labelIds) url.searchParams.append("labelIds", labelIds);
    url.searchParams.append("maxResults", maxResults.toString());
    if (pageToken) url.searchParams.append("pageToken", pageToken);
    if (q) url.searchParams.append("q", q);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to list Gmail messages:", errorText);
      throw new Error(`Gmail API Error: ${errorText}`);
    }

    const data = await response.json();

    // Fetch snippets for each message (Gmail API doesn't return them in list)
    const messages = data.messages
      ? await Promise.all(
          (data.messages as Array<{ id: string; threadId: string }>).map(
            async (msg) => {
              try {
                const msgRes = await fetch(
                  `https://www.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
                  {
                    headers: {
                      Authorization: `Bearer ${accessToken}`,
                    },
                  }
                );
                if (msgRes.ok) {
                  const msgData = await msgRes.json();
                  return {
                    id: msg.id,
                    threadId: msg.threadId,
                    snippet: msgData.snippet || "",
                    labelIds: msgData.labelIds || [],
                    payload: msgData.payload,
                    internalDate: msgData.internalDate,
                  };
                }
                return { ...msg, snippet: "" };
              } catch {
                return { ...msg, snippet: "" };
              }
            }
          )
        )
      : [];

    return c.json(
      {
        messages,
        nextPageToken: data.nextPageToken,
        resultSizeEstimate: data.resultSizeEstimate,
      },
      200
    );
  })
  .openapi(getMessageRoute, async (c) => {
    const db = getDb(c);
    const env = c.env;
    const { id } = c.req.valid("param");

    const accessToken = await getUnifiedOAuthToken(env, db);

    const response = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages/${id}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to get Gmail message:", errorText);
      throw new Error(`Gmail API Error: ${errorText}`);
    }

    const data = await response.json();
    return c.json(data, 200);
  })
  .openapi(getThreadRoute, async (c) => {
    const db = getDb(c);
    const env = c.env;
    const { id } = c.req.valid("param");

    const accessToken = await getUnifiedOAuthToken(env, db);

    const response = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/threads/${id}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to get Gmail thread:", errorText);
      throw new Error(`Gmail API Error: ${errorText}`);
    }

    const data = await response.json();
    return c.json(data, 200);
  })
  .openapi(sendMessageRoute, async (c) => {
    const db = getDb(c);
    const env = c.env;
    const body = c.req.valid("json");

    const accessToken = await getUnifiedOAuthToken(env, db);

    // Build RFC 2822 email message
    const to = body.to.join(", ");
    let email = "";
    email += `To: ${to}\r\n`;
    email += `Subject: ${body.subject}\r\n`;
    email += `Content-Type: text/plain; charset=utf-8\r\n`;
    if (body.cc && body.cc.length > 0) {
      email += `Cc: ${body.cc.join(", ")}\r\n`;
    }
    if (body.bcc && body.bcc.length > 0) {
      email += `Bcc: ${body.bcc.join(", ")}\r\n`;
    }
    email += `\r\n`;
    email += body.body;

    // Base64 encode the email
    const base64Email = Buffer.from(email)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const url = body.threadId
      ? `https://www.googleapis.com/gmail/v1/users/me/messages/send?threadId=${body.threadId}`
      : `https://www.googleapis.com/gmail/v1/users/me/messages/send`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw: base64Email,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to send Gmail message:", errorText);
      throw new Error(`Gmail API Error: ${errorText}`);
    }

    const data = await response.json();
    return c.json(data, 200);
  });

export const gmailRouter = routes;
export default gmailRouter;
