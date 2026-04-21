import { Context } from "hono";
import { AppEnv } from "../api/routes/_shared";


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
  try {
    // 1. Database Persistence
    await c.env.DB.prepare(
      "INSERT INTO notifications (id, user_id, title, message, link) VALUES (?, ?, ?, ?, ?)"
    ).bind(
      crypto.randomUUID(),
      userId,
      title,
      message,
      link || null
    ).run();

    // 2. External Broadcasting (Optional)
    if (external) {
      if (c.env.ZULIP_BOT_EMAIL && c.env.ZULIP_API_KEY) {
         // Log for now, implement Zulip call when needed
         console.log(`[Notification] Broadcasting external notification for ${userId}: ${title}`);
         // Further integration with Zulip client logic goes here
      }
    }
  } catch (err) {
    console.error("[Notification] Failed to emit:", err);
  }
}

/**
 * Broadcast a notification to all users with the 'admin' role.
 */
export async function notifyAdmins(
  c: Context<AppEnv>,
  {
    title,
    message,
    link,
    external = false,
    priority = "medium"
  }: {
    title: string;
    message: string;
    link?: string;
    external?: boolean;
    priority?: "low" | "medium" | "high";
  }
) {
  try {
    // Better-Auth stores roles in the 'user' table
    const { results: admins } = await c.env.DB.prepare(
      "SELECT id FROM user WHERE role = 'admin'"
    ).all();

    if (!admins) return;

    const promises = admins.map(admin => 
      emitNotification(c, {
        userId: admin.id as string,
        title,
        message,
        link,
        external,
        priority
      })
    );

    await Promise.all(promises);
  } catch (err) {
    console.error("[Notification] notifyAdmins failed:", err);
  }
}

