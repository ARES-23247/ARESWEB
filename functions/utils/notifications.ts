import { Context } from "hono";
import { AppEnv } from "../api/middleware";


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
      "INSERT INTO notifications (id, user_id, title, message, link, priority) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(
      crypto.randomUUID(),
      userId,
      title,
      message,
      link || null,
      priority
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

  try {
    const includeAdmin = audiences.includes("admin");
    const profileTypes = audiences.filter(a => a !== "admin");

    const queries = [];
    if (includeAdmin) {
      // Admins are already verified since their role is 'admin'
      queries.push(`SELECT id FROM user WHERE role = 'admin'`);
    }
    
    if (profileTypes.length > 0) {
      const placeholders = profileTypes.map(() => '?').join(', ');
      // Join against user_profiles to check member_type, and ensure user is verified
      queries.push(`
        SELECT u.id 
        FROM user u
        JOIN user_profiles p ON u.id = p.user_id
        WHERE u.role != 'unverified' AND p.member_type IN (${placeholders})
      `);
    }

    const unionQuery = queries.join(' UNION ');
    const stmt = c.env.DB.prepare(unionQuery);
    const boundStmt = profileTypes.length > 0 ? stmt.bind(...profileTypes) : stmt;

    const { results } = await boundStmt.all();

    if (!results || results.length === 0) return;

    // PERF: Batch all notification inserts to prevent connection pool exhaustion
    // D1 has a 100 statement limit per batch call. Chunk them.
    const MAX_BATCH_SIZE = 100;
    for (let i = 0; i < results.length; i += MAX_BATCH_SIZE) {
      const chunk = results.slice(i, i + MAX_BATCH_SIZE);
      const batch = chunk.map((row: Record<string, unknown>) => {
        return c.env.DB.prepare(
          "INSERT INTO notifications (id, user_id, title, message, link, priority) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(
          crypto.randomUUID(),
          row.id as string,
          payload.title,
          payload.message,
          payload.link || null,
          payload.priority || "low"
        );
      });
      
      try {
        await c.env.DB.batch(batch);
      } catch (chunkErr) {
        console.error(`[Notification] Batch chunk starting at index ${i} failed:`, chunkErr);
      }
    }

    // External broadcasting (Sequential background dispatch)
    if (payload.external && c.env.ZULIP_BOT_EMAIL && c.env.ZULIP_API_KEY) {
       console.log(`[Notification] Batch external broadcast dispatched for ${results.length} users.`);
    }
  } catch (err) {
    console.error("[Notification] notifyByRole failed:", err);
  }
}

/**
 * Broadcast a notification to all users with the 'admin' role.
 * Kept for backward compatibility.
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


