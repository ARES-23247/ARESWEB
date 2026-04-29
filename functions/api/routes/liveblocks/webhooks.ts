import { Hono } from "hono";
import { AppEnv } from "../../middleware";
import { WebhookHandler } from "@liveblocks/node";
import { Liveblocks } from "@liveblocks/node";
import { Kysely } from "kysely";
import { DB } from "../../../../shared/schemas/database";
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
  const db = c.get("db") as Kysely<DB>;

  try {
    if (event.type === "ydocUpdated") {
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

      if (event.type === "ydocUpdated") {
        // Rate limit: Check latest snapshot time for this room
        const latestSnapshot = await db.selectFrom("document_history")
          .select("created_at")
          .where("room_id", "=", roomId)
          .orderBy("created_at", "desc")
          .limit(1)
          .executeTakeFirst();
          
        let shouldSave = true;
        if (latestSnapshot && latestSnapshot.created_at) {
          // created_at is returned as YYYY-MM-DD HH:MM:SS in UTC
          const lastSaveTime = new Date(latestSnapshot.created_at + 'Z').getTime(); 
          const now = Date.now();
          // 10 minutes in milliseconds = 600000
          if (now - lastSaveTime < 600000) {
            shouldSave = false;
          }
        }

        if (shouldSave) {
          // Create history snapshot
          await db.insertInto("document_history")
            .values({
              room_id: roomId,
              content,
              created_by: "system"
            })
            .execute();
        }

        // Auto-purge old drafts (> 30 days) asynchronously to keep DB lean
        const THIRTY_DAYS_AGO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
        c.executionCtx.waitUntil(
          db.deleteFrom("document_history")
            .where("created_at", "<", THIRTY_DAYS_AGO)
            .execute()
        );
      }
    } else if (event.type === "userEntered") {
      const roomId = event.data.roomId;
      const userId = event.data.userId;
      const userInfo = event.data.userInfo as Record<string, string>;

      if (userId && userInfo) {
        // SQLite uses DATETIME for CURRENT_TIMESTAMP, but JS Date works too.
        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
        await db.insertInto("document_contributors")
          .values({
            room_id: roomId,
            user_id: userId,
            user_name: userInfo.name || "Unknown",
            user_avatar: userInfo.avatar || null,
            last_contributed_at: now
          })
          .onConflict((oc) => oc
            .columns(["room_id", "user_id"])
            .doUpdateSet({
              user_name: userInfo.name || "Unknown",
              user_avatar: userInfo.avatar || null,
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
