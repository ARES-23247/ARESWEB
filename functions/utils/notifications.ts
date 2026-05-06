import { Context } from "hono";
import { AppEnv } from "../api/middleware/utils";
import { sendZulipAlert } from "./zulipSync";


/**
 * Centrally emit a user notification and broadcast to external channels if needed.
 */
export async function emitNotification(
  c: Context<AppEnv>,
  {
    userId,
    title,
    message,
    link,
    external = false,
    priority = "low"
  }: {
    userId: string;
    title: string;
    message: string;
    link?: string;
    external?: boolean;
    priority?: "low" | "medium" | "high";
  }
) {
  const db = c.get("db");
  try {
    // 1. Database Persistence
    const id = (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") ? crypto.randomUUID() : `notif-${Date.now()}`;
    
    await db.insertInto("notifications")
      .values({
        id,
        user_id: userId,
        title,
        message,
        link: link || "",
        priority
      })
      .execute();

    // 2. External Broadcasting (Optional)
    if (external) {
      c.executionCtx.waitUntil(
        sendZulipAlert(c.env, "System", title, `${message}\n\n[View Details](${link || "#"})`)
          .catch(e => console.error("[Notification] External broadcast failed:", e))
      );
    }
  } catch (err) {
    console.error("[Notification] Failed to emit:", err);
  }
}

export type NotifyAudience = "admin" | "coach" | "mentor" | "student";

/**
 * Broadcast a notification to users with matching roles or member types.
 * Will only notify verified users (role != 'unverified').
 */
export async function notifyByRole(
  c: Context<AppEnv>,
  audiences: NotifyAudience[],
  payload: {
    title: string;
    message: string;
    link?: string;
    external?: boolean;
    priority?: "low" | "medium" | "high";
  }
) {
  if (audiences.length === 0) return;

  const db = c.get("db");

  try {
    const includeAdmin = audiences.includes("admin");
    const profileTypes = audiences.filter(a => a !== "admin");

    let query = db.selectFrom("user as u")
      .select("u.id");

    if (includeAdmin && profileTypes.length > 0) {
      query = query.where((eb) => eb.or([
        eb("u.role", "=", "admin"),
        eb.and([
          eb("u.role", "!=", "unverified"),
          eb.exists(
            db.selectFrom("user_profiles as p")
              .select("p.user_id")
              .whereRef("p.user_id", "=", eb.ref("u.id"))
              .where("p.member_type", "in", profileTypes)
          )
        ])
      ]));
    } else if (includeAdmin) {
      query = query.where("u.role", "=", "admin");
    } else {
      query = query
        .innerJoin("user_profiles as p", "u.id", "p.user_id")
        .where("u.role", "!=", "unverified")
        .where("p.member_type", "in", profileTypes);
    }

    const results = await query.execute();

    if (!results || results.length === 0) return;

    // PERF: Batch all notification inserts
    const MAX_BATCH_SIZE = 100;
    for (let i = 0; i < results.length; i += MAX_BATCH_SIZE) {
      const chunk = results.slice(i, i + MAX_BATCH_SIZE);
      
      const values = chunk
        .filter(row => row.id !== null)
        .map(row => ({
          id: (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") ? crypto.randomUUID() : `notif-${Math.random()}`,
          user_id: row.id as string,
          title: payload.title,
          message: payload.message,
          link: payload.link || "",
          priority: (payload.priority || "low") as "low" | "high" | "medium"
        }));

      try {
        await db.insertInto("notifications").values(values).execute();
      } catch (chunkErr) {
        console.error(`[Notification] Batch chunk starting at index ${i} failed:`, chunkErr);
      }
    }

    // External broadcasting
    if (payload.external) {
      c.executionCtx.waitUntil(
        sendZulipAlert(c.env, "System", payload.title, `${payload.message}\n\n[View Details](${payload.link || "#"})`)
          .catch(e => console.error("[Notification] Role broadcast failed:", e))
      );
    }
  } catch (err) {
    console.error("[Notification] notifyByRole failed:", err);
  }
}

/**
 * Broadcast a notification to all users with the 'admin' role.
 */
export async function notifyAdmins(
  c: Context<AppEnv>,
  payload: {
    title: string;
    message: string;
    link?: string;
    external?: boolean;
    priority?: "low" | "medium" | "high";
  }
) {
  return notifyByRole(c, ["admin"], payload);
}



