import { OpenAPIHono } from "@hono/zod-openapi";
import { zulipWebhookRoute } from "../../../shared/routes/zulip";
import { getSocialConfig, AppEnv, getDb } from "../middleware";
import { eq, and } from "drizzle-orm";
import * as schema from "../../../src/db/schema";

export const zulipWebhookRouter = new OpenAPIHono<AppEnv>();

function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const aBuf = new TextEncoder().encode(a);
  const bBuf = new TextEncoder().encode(b);
  const MAX_TOKEN_LENGTH = Math.max(aBuf.length, bBuf.length);
  let result = 0;
  for (let i = 0; i < MAX_TOKEN_LENGTH; i++) {
    const aByte = i < aBuf.length ? aBuf[i] : 0;
    const bByte = i < bBuf.length ? bBuf[i] : 0;
    result |= aByte ^ bByte;
  }
  return result === 0 && aBuf.length === bBuf.length;
}

// POST /webhooks/zulip — Handle outgoing webhook from Zulip
zulipWebhookRouter.openapi(zulipWebhookRoute, async (c) => {
  const body = c.req.valid("json");
  const config = await getSocialConfig(c);
  const expectedToken = config.ZULIP_WEBHOOK_TOKEN;

  if (!expectedToken) {
    return c.json({ content: "❌ Webhook token not configured on server." }, 200);
  }
  if (!timingSafeEqual(body.token, expectedToken)) {
    return c.json({ content: "❌ Unauthorized: Invalid webhook token." }, 200);
  }

  const { message, trigger } = body;
  if (!message || trigger !== "private_message") {
    return c.json({ content: "I only respond to private messages right now!" }, 200);
  }

  const content = message.content.toLowerCase().trim();
  const db = getDb(c);

  if (content === "ping") {
    return c.json({ content: "Pong! 🏓" }, 200);
  }

  if (content.startsWith("stats")) {
    const userCount = (await db.select().from(schema.user).all()).length;
    return c.json({ content: `Current user count: ${userCount}` }, 200);
  }

  return c.json({ content: "Hello from ARES! I received your message: " + message.content }, 200);
});

export default zulipWebhookRouter;
