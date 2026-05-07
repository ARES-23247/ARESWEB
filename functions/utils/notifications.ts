import { Context } from "hono";
import { AppEnv, getDb } from "../api/middleware/utils";
import { sendZulipAlert } from "./zulipSync";
import { eq, and, or, exists, inArray } from "drizzle-orm";
import * as schema from "../../src/db/schema";


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
  const db = getDb(c);
  try {
    // 1. Database Persistence
    const id = (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") ? crypto.randomUUID() : `notif-${Date.now()}`;

    await db.insert(schema.notifications)
      .values({
        id,
        userId,
        title,
        message,
        link: link || "",
        priority
      })
      .run();

    // 2. External Broadcasting (Optional)
    if (external) {
      c.executionCtx.waitUntil(
        sendZulipAlert(c.env, "System", title, `${message}\n\n[View Details](${link || "#"})`)
          .catch((e: unknown) => console.error("[Notification] External broadcast failed:", e))
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

  const db = getDb(c);

  try {
    const includeAdmin = audiences.includes("admin");
    const profileTypes = audiences.filter((a) => a !== "admin");

    let query = db.select({
      id: schema.user.id
    })
      .from(schema.user);

    if (includeAdmin && profileTypes.length > 0) {
      query = query.where(or(
        eq(schema.user.role, "admin"),
        and(
          eq(schema.user.role, "unverified").$not(),
          exists(
            db.select({ userId: schema.userProfiles.userId })
              .from(schema.userProfiles)
              .where(eq(schema.userProfiles.userId, schema.user.id))
              .where(inArray(schema.userProfiles.memberType, profileTypes))
          )
        )
      ));
    } else if (includeAdmin) {
      query = query.where(eq(schema.user.role, "admin"));
    } else {
      query = query
        .innerJoin(schema.userProfiles, eq(schema.user.id, schema.userProfiles.userId))
        .where(eq(schema.user.role, "unverified").$not())
        .where(inArray(schema.userProfiles.memberType, profileTypes));
    }

    const results = await query.all();

    if (!results || results.length === 0) return;

    // PERF: Batch all notification inserts
    const MAX_BATCH_SIZE = 100;
    for (let i = 0; i < results.length; i += MAX_BATCH_SIZE) {
      const chunk = results.slice(i, i + MAX_BATCH_SIZE);
      
      const values = chunk
        .filter((row) => row.id !== null)
        .map((row) => ({
          id: (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") ? crypto.randomUUID() : `notif-${Math.random()}`,
          userId: row.id as string,
          title: payload.title,
          message: payload.message,
          link: payload.link || "",
          priority: (payload.priority || "low") as "low" | "high" | "medium"
        }));

      try {
        await db.insert(schema.notifications).values(values).run();
      } catch (chunkErr) {
        console.error(`[Notification] Batch chunk starting at index ${i} failed:`, chunkErr);
      }
    }

    // External broadcasting
    if (payload.external) {
      c.executionCtx.waitUntil(
        sendZulipAlert(c.env, "System", payload.title, `${payload.message}\n\n[View Details](${payload.link || "#"})`)
          .catch((e: unknown) => console.error("[Notification] Role broadcast failed:", e))
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



