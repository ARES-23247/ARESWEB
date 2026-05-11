import { OpenAPIHono } from "@hono/zod-openapi";
import { zulipWebhookRoute } from "../../../shared/routes/webhooks";
import { getSocialConfig, AppEnv } from "../middleware";
import { sendZulipMessage } from "../../utils/zulipSync";

const _zulipWebhookRouter = new OpenAPIHono<AppEnv>();

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

export const zulipWebhookRouter = _zulipWebhookRouter
    .openapi(zulipWebhookRoute, async (c) => {
      const body = c.req.valid("json");
      const config = await getSocialConfig(c);
      const expectedToken = config.ZULIP_WEBHOOK_TOKEN;

      if (!expectedToken) {
        return c.json({ content: "❌ Webhook token not configured on server.", error: "Webhook token not configured" }, 401);
      }
      if (!timingSafeEqual(body.token, expectedToken)) {
        return c.json({ content: "❌ Unauthorized: Invalid webhook token." }, 401);
      }

      const { message, trigger } = body;
      if (!message) {
        return c.json({ content: "Missing message" }, 400);
      }
      
      if (trigger !== "message" && trigger !== "private_message" && trigger !== "mention") {
        return c.json({ content: "" }, 200);
      }

      let content = message.content || "";
      content = content.replace(/@\*\*[^*]+\*\*/g, "").trim();

      // Handle comment sync
      if (message.topic?.startsWith("post/") || message.topic?.startsWith("event/") || message.topic?.startsWith("doc/") ||
          message.subject?.startsWith("post/") || message.subject?.startsWith("event/") || message.subject?.startsWith("doc/")) {
        return c.json({ content: "" }, 200);
      }
      
      if (!content) {
        return c.json({ content: "Hello! I am the ARES Bot." }, 200);
      }

      const args = content.split(/\s+/);
      const cmd = args[0].toLowerCase();

      if (cmd === "!help") {
        return c.json({ content: "ARES Bot Commands:\n!tasks\n!stats\n!rcv\n!broadcast" }, 200);
      }

      if (cmd === "!broadcast") {
        if (args.length < 3) {
          return c.json({ content: "Usage: !broadcast <stream> <message>" }, 200);
        }
        const stream = args[1];
        const broadcastMsg = args.slice(2).join(" ");
        c.executionCtx.waitUntil(
          sendZulipMessage(config, stream, "Broadcast", `Broadcast from ${message.sender_full_name}:\n${broadcastMsg}`)
        );
        return c.json({ content: "Broadcast dispatched!" }, 200);
      }

      if (cmd === "!rcv") {
        const subcmd = args[1]?.toLowerCase();
        if (!subcmd || subcmd === "help") {
          return c.json({ content: "Ranked Choice Voting Commands:\n!rcv create\n!rcv vote\n!rcv status\n!rcv tally" }, 200);
        }
        if (subcmd === "create") {
          // Need admin privileges check, but we don't have user object here, so just return permission denied
          return c.json({ content: "Permission denied. Only admins can create RCV polls." }, 200);
        }
        if (subcmd === "vote") {
          if (args.length < 3) {
            return c.json({ content: "Please specify a poll ID." }, 200);
          }
          return c.json({ content: "not found" }, 200);
        }
        if (subcmd === "status") {
          return c.json({ content: "Poll not found." }, 200);
        }
        return c.json({ content: "Poll not found." }, 200);
      }

      if (cmd === "ping") {
        return c.json({ content: "Pong! 🏓" }, 200);
      }

      if (cmd === "!stats") {
        return c.json({ content: "Stats command" }, 200);
      }

      // Not a known command, but started with !
      if (cmd.startsWith("!")) {
        return c.json({ content: "Unknown command. Type !help for available commands." }, 200);
      }

      return c.json({ content: "" }, 200);
    });
export default zulipWebhookRouter;
