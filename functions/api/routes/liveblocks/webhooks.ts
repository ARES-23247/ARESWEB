import { Hono } from "hono";
import { AppEnv } from "../../middleware";
import { WebhookHandler } from "@liveblocks/node";
import { Liveblocks } from "@liveblocks/node";
import { getDb } from "../../../database";
import { extractTiptapHtmlFromYjs } from "./yjsExtraction";

const webhooksRouter = new Hono<AppEnv>();

webhooksRouter.post("/", async (c) => {
  const secret = c.env.LIVEBLOCKS_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[Liveblocks Webhook] Secret not configured.");
    return c.text("Webhook secret not configured", 500);
  }

  const webhookHandler = new WebhookHandler(secret);
  const rawBody = await c.req.text();
  const headers = c.req.raw.headers;

  let event;
  try {
    event = webhookHandler.verifyRequest({
      headers,
      rawBody
    });
  } catch (err) {
    console.error("[Liveblocks Webhook] Verification failed", err);
    return c.text("Unauthorized", 401);
  }

  const liveblocks = new Liveblocks({ secret: c.env.LIVEBLOCKS_SECRET_KEY });
  const db = getDb(c.env.DB);

  try {
    if (event.type === "YjsDocumentUpdated" || event.type === "RoomOutdated") {
      const roomId = event.data.roomId;
      
      // Fetch the current Yjs state as a binary update
      const yDocBinary = await liveblocks.getYjsDocumentAsBinaryUpdate(roomId);
      const content = extractTiptapHtmlFromYjs(new Uint8Array(yDocBinary));

      // Determine entity type and ID from roomId (e.g. "event_abc", "post_slug")
      const parts = roomId.split("_");
      const entityType = parts[0];
      const entityId = parts.slice(1).join("_");

      if (entityType === "event") {
        await db.updateTable("events").set({ content_draft: content }).where("id", "=", entityId).execute();
      } else if (entityType === "post") {
        await db.updateTable("posts").set({ content_draft: content }).where("slug", "=", entityId).execute();
      } else if (entityType === "doc") {
        await db.updateTable("docs").set({ content_draft: content }).where("slug", "=", entityId).execute();
      }

      if (event.type === "RoomOutdated") {
        // Create history snapshot
        await db.insertInto("document_history")
          .values({
            room_id: roomId,
            content,
            created_by: "system"
          })
          .execute();
      }
    } else if (event.type === "UserEntered") {
      const roomId = event.data.roomId;
      const userId = event.data.userId;
      const info = event.data.info as Record<string, string>;

      if (userId && info) {
        // SQLite uses DATETIME for CURRENT_TIMESTAMP, but JS Date works too.
        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
        await db.insertInto("document_contributors")
          .values({
            room_id: roomId,
            user_id: userId,
            user_name: info.name || "Unknown",
            user_avatar: info.avatar || null,
            last_contributed_at: now
          })
          .onConflict((oc) => oc
            .columns(["room_id", "user_id"])
            .doUpdateSet({
              user_name: info.name || "Unknown",
              user_avatar: info.avatar || null,
              last_contributed_at: now
            })
          )
          .execute();
      }
    }
  } catch (err) {
    console.error("[Liveblocks Webhook] Error processing event:", err);
    return c.text("Internal Error", 500);
  }

  return c.text("OK", 200);
});

export default webhooksRouter;
