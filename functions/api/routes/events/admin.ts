import { Hono } from "hono";
import { siteConfig } from "../../../utils/site.config";
import { AppEnv, getSocialConfig, extractAstText, getSessionUser, getDbSettings, parsePagination, createContentLifecycleRouter, rateLimitMiddleware, ensureAdmin } from "../../middleware";
import { pushEventToGcal, deleteEventFromGcal } from "../../../utils/gcalSync";
import { dispatchSocials, PostPayload, SocialConfig } from "../../../utils/socialSync";
import { sendZulipMessage } from "../../../utils/zulipSync";
import { notifyByRole } from "../../../utils/notifications";

const adminRouter = new Hono<AppEnv>();

// Enforce admin privileges across all manual event operations
adminRouter.use("*", ensureAdmin);
// ── GET /admin/events — list all events (admin) ─────────────────────────
adminRouter.get("/", async (c) => {
  try {
    const { limit, offset } = parsePagination(c, 100, 500);
    const { results: events } = await c.env.DB.prepare(
      "SELECT id, title, category, date_start, date_end, location, description, cover_image, tba_event_key, gcal_event_id, cf_email, is_deleted, status, is_potluck, is_volunteer, revision_of, season_id FROM events ORDER BY date_start DESC LIMIT ? OFFSET ?"
    ).bind(limit, offset).all();

    const lastSyncRow = await c.env.DB.prepare("SELECT value FROM settings WHERE key = 'LAST_CALENDAR_SYNC'").first<{value: string}>();
    
    return c.json({ 
      events: events ?? [],
      lastSyncedAt: lastSyncRow?.value || null 
    });
  } catch (err) {
    console.error("D1 admin list error (events):", err);
    return c.json({ error: "Failed to fetch events from database", details: (err as Error).message }, 500);
  }
});

// ── GET /admin/events/:id — single event (admin) ────────────────────────
adminRouter.get("/:id", async (c) => {
  const id = (c.req.param("id") || "");
  try {
    const row = await c.env.DB.prepare(
      "SELECT id, title, category, date_start, date_end, location, description, cover_image, tba_event_key, gcal_event_id, cf_email, is_deleted, status, is_potluck, is_volunteer, published_at, revision_of, season_id FROM events WHERE id = ?"
    ).bind(id).first();

    if (!row) return c.json({ error: "Event not found" }, 404);
    return c.json({ event: row });
  } catch (err) {
    console.error("D1 read error:", err);
    return c.json({ error: "Database error" }, 500);
  }
});

// ── POST /admin/events — manual event creation (admin) ─────────────────
adminRouter.post("/", rateLimitMiddleware(15, 60), async (c) => {
  try {
    let body;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid request payload (malformed JSON or FormData)" }, 400);
    }
    const { title, category, dateStart, dateEnd, location, description, coverImage, socials, isPotluck, isVolunteer, isDraft, publishedAt, seasonId } = body;
    const cat = category || 'internal';

    if (!title || !dateStart) return c.json({ error: "Missing required fields" }, 400);

    const warnings: string[] = [];
    const genId = crypto.randomUUID();
    
    // Sync to GCal if enabled
    let gcalId: string | null = null;
    const socialConfig = await getSocialConfig(c) as SocialConfig;
    const gcalEmail = socialConfig["GCAL_SERVICE_ACCOUNT_EMAIL"];
    const gcalKey = socialConfig["GCAL_PRIVATE_KEY"];
    
    const calKey = `CALENDAR_ID_${cat.toUpperCase()}` as keyof SocialConfig;
    const calId = socialConfig[calKey] || socialConfig["CALENDAR_ID"];

    if (gcalEmail && gcalKey && calId) {
      try {
        gcalId = (await pushEventToGcal(
           { id: genId, title, date_start: dateStart, date_end: dateEnd, location, description, cover_image: coverImage ?? null },
           { email: gcalEmail, privateKey: gcalKey, calendarId: calId as string }
        )) || null;
      } catch (err: unknown) {
        warnings.push(`Google Calendar Auth Failed: ${(err as Error).message || "Unknown GCal Error"}`);
      }
    }

    const user = await getSessionUser(c);
    const email = user?.email || "anonymous_admin";
    const status = isDraft ? "pending" : (user?.role === "admin" ? "published" : "pending");

    await c.env.DB.prepare(
      `INSERT INTO events (id, title, category, date_start, date_end, location, description, cover_image, gcal_event_id, cf_email, status, is_potluck, is_volunteer, published_at, season_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      genId, title, cat, dateStart, dateEnd || null, location || "", description || "", coverImage || "",
      gcalId || null, email, status, isPotluck ? 1 : 0, isVolunteer ? 1 : 0, publishedAt || null, seasonId || null
    ).run();

    const baseUrl = new URL(c.req.url).origin;

    if (socials && status === "published") {
      const payload: PostPayload = {
        title: title, url: `${baseUrl}/events`,
        snippet: extractAstText(description).substring(0, 250) || "New event scheduled!",
        coverImageUrl: coverImage || "/gallery_1.png",
        baseUrl: baseUrl
      };
      try {
        await dispatchSocials(c.env.DB, payload, socialConfig, socials);
      } catch (err) {
        console.error("Event social dispatch failed:", err);
        warnings.push(`Social Syndication Failed: ${(err as Error).message}`);
      }
    }

    // ── Zulip Calendar Notification ──
    if (status === "published") {
      try {
        const eventDate = new Date(dateStart).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        const desc = extractAstText(description || "").substring(0, 200);
        await sendZulipMessage(
          c.env,
          "announcements",
          "Calendar",
          `📅 **New Event:** ${title}\n📍 ${location || "TBD"} • 📆 ${eventDate}\n${desc ? `\n${desc}` : ""}\n\n[View on ${siteConfig.team.name}WEB](${baseUrl}/events)`
        );
      } catch (err) {
        console.error("[Events] Zulip notification failed:", err);
        warnings.push(`Zulip Notification Failed: ${(err as Error).message}`);
      }
    }


    // ── Notify admins and mentors of pending content ──
    if (status === "pending") {
      try {
        await notifyByRole(c, ["admin", "coach", "mentor"], {
          title: "📅 Pending Event",
          message: `"${title}" submitted by ${email} needs review.`,
          link: "/dashboard",
          external: true,
          priority: "medium"
        });
      } catch (err) {
        console.error("[Events] Admin notification failed:", err);
      }
    }

    return c.json({ success: true, id: genId, warning: warnings.length > 0 ? warnings.join(" | ") : undefined }, warnings.length > 0 ? 207 : 200);
  } catch (err: unknown) {
    console.error("D1 manual event creation error:", err);
    return c.json({ error: "Write failed" }, 500);
  }
});

// ── PUT /admin/events/:id — edit an event (admin) ────────────────────────
adminRouter.put("/:id", rateLimitMiddleware(15, 60), async (c) => {
  try {
    const paramId = (c.req.param("id") || "");
    let body;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid request payload (malformed JSON or FormData)" }, 400);
    }
    const { title, category, dateStart, dateEnd, location, description, coverImage, tbaEventKey, socials, isPotluck, isVolunteer, isDraft, publishedAt, seasonId } = body;
    const cat = category || 'internal';
    
    if (!title || !dateStart) return c.json({ error: "Missing required fields" }, 400);
    const warnings: string[] = [];

    const socialConfig = await getSocialConfig(c) as SocialConfig;
    const gcalEmail = socialConfig["GCAL_SERVICE_ACCOUNT_EMAIL"];
    const gcalKey = socialConfig["GCAL_PRIVATE_KEY"];
    
    const calKey = `CALENDAR_ID_${cat.toUpperCase()}` as keyof SocialConfig;
    const calId = socialConfig[calKey] || socialConfig["CALENDAR_ID"];

    let gcalId: string | null = null;
    if (gcalEmail && gcalKey && calId) {
      const row = await c.env.DB.prepare("SELECT gcal_event_id FROM events WHERE id = ?").bind(paramId).first<{gcal_event_id: string | null}>();
      try {
        gcalId = (await pushEventToGcal(
          { id: paramId, title, date_start: dateStart, date_end: dateEnd, location, description, cover_image: coverImage, gcal_event_id: row?.gcal_event_id || undefined },
          { email: gcalEmail, privateKey: gcalKey, calendarId: calId as string }
        )) || null;
      } catch (err: unknown) {
        warnings.push(`Google Calendar Auth Failed: ${(err as Error).message || "Unknown GCal Error"}`);
      }
    }

    const user = await getSessionUser(c);

    if (user?.role !== "admin") {
      const revId = `${paramId}-rev-${Math.random().toString(36).substring(2, 6)}`;
      await c.env.DB.prepare(
        `INSERT INTO events (id, title, category, date_start, date_end, location, description, cover_image, tba_event_key, gcal_event_id, cf_email, status, is_potluck, is_volunteer, revision_of, published_at, season_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, gcal_event_id), ?, 'pending', ?, ?, ?, ?, ?)`
      ).bind(revId, title, cat, dateStart, dateEnd || null, location || "", description || "", coverImage || "", tbaEventKey || null, gcalId || null, user?.email || "anonymous_author", isPotluck ? 1 : 0, isVolunteer ? 1 : 0, paramId, publishedAt || null, seasonId || null).run();
      c.executionCtx.waitUntil(
        notifyByRole(c, ["admin", "coach", "mentor"], {
          title: "📅 Event Revision Pending",
          message: `"${title}" revised by ${user?.email || "unknown"} needs admin approval.`,
          link: "/dashboard",
          external: true,
          priority: "medium"
        }).catch(err => console.error("[Events] Admin revision notification failed:", err))
      );
      return c.json({ success: true, id: revId, warning: warnings.length > 0 ? warnings.join(" | ") : undefined }, warnings.length > 0 ? 207 : 200);
    }

    const status = isDraft ? "pending" : "published";
    await c.env.DB.prepare(
      `UPDATE events SET title = ?, category = ?, date_start = ?, date_end = ?, location = ?, description = ?, cover_image = ?, tba_event_key = ?, gcal_event_id = COALESCE(?, gcal_event_id), status = ?, is_potluck = ?, is_volunteer = ?, published_at = ?, season_id = ? WHERE id = ?`
    ).bind(title, cat, dateStart, dateEnd || null, location || "", description || "", coverImage || "", tbaEventKey || null, gcalId || null, status, isPotluck ? 1 : 0, isVolunteer ? 1 : 0, publishedAt || null, seasonId || null, paramId).run();

    const baseUrl = new URL(c.req.url).origin;

    if (socials && status === "published") {
      const payload: PostPayload = {
        title: title, url: `${baseUrl}/events`,
        snippet: extractAstText(description).substring(0, 250) || "New event scheduled!",
        coverImageUrl: coverImage || "/gallery_1.png",
        baseUrl: baseUrl
      };
      c.executionCtx.waitUntil(
        dispatchSocials(c.env.DB, payload, socialConfig, socials).catch(err => console.error("Event social update failed:", err))
      );
    }

    return c.json({ success: true, id: paramId, warning: warnings.length > 0 ? warnings.join(" | ") : undefined }, warnings.length > 0 ? 207 : 200);
  } catch (err: unknown) {
    console.error("D1 write error (events):", err);
    return c.json({ success: false, error: (err as Error).message || "Event update failed" }, 500);
  }
});

// ── Generic Lifecycle Operations ──────────────────────────────────
adminRouter.route("/", createContentLifecycleRouter("events", {
  onApprove: async (c, id) => {
    interface EventRevisionRow { 
      revision_of: string; 
      title: string; 
      date_start: string; 
      date_end: string; 
      location: string; 
      description: string; 
      cover_image: string; 
      tba_event_key: string;
      gcal_event_id: string; 
      is_potluck: number; 
      is_volunteer: number; 
    }
    const row = await c.env.DB.prepare("SELECT revision_of, title, date_start, date_end, location, description, cover_image, tba_event_key, gcal_event_id, is_potluck, is_volunteer, season_id FROM events WHERE id = ?").bind(id).first<EventRevisionRow & { season_id: string }>();

    if (row && row.revision_of) {
      await c.env.DB.batch([
        c.env.DB.prepare(
          "UPDATE events SET title = ?, date_start = ?, date_end = ?, location = ?, description = ?, cover_image = ?, tba_event_key = ?, gcal_event_id = COALESCE(?, gcal_event_id), status = 'published', is_potluck = ?, is_volunteer = ?, season_id = ? WHERE id = ?"
        ).bind(row.title, row.date_start, row.date_end, row.location, row.description, row.cover_image, row.tba_event_key, row.gcal_event_id, row.is_potluck, row.is_volunteer, row.season_id, row.revision_of),
        c.env.DB.prepare("DELETE FROM events WHERE id = ?").bind(id)
      ]);
      return true; // DB logic handled
    }
    // Let generic router handle simple status update
  },
  onDelete: async (c, id, type) => {
    if (type === "purged") {
      const dbSettings = await getDbSettings(c);
      const gcalEmail = dbSettings["GCAL_SERVICE_ACCOUNT_EMAIL"];
      const gcalKey = dbSettings["GCAL_PRIVATE_KEY"];
      const row = await c.env.DB.prepare("SELECT gcal_event_id, category FROM events WHERE id = ?").bind(id).first<{gcal_event_id: string, category: string}>();

      const calId = dbSettings[`CALENDAR_ID_${row?.category.toUpperCase()}`] || dbSettings["CALENDAR_ID"];

      if (gcalEmail && gcalKey && calId && row?.gcal_event_id) {
        try {
          await deleteEventFromGcal(row.gcal_event_id, { email: gcalEmail, privateKey: gcalKey, calendarId: calId as string });
        } catch (err) { console.warn("GCal purge cleanup failed:", err); }
      }
    }
  },
  onRestore: async (c, id) => {
    // Override the restore route because events frontend expects `/undelete` behavior for restore
    // Wait, the generic route /restore sets is_deleted = 0 AND status = 'draft'
    // But events frontend expects just is_deleted = 0
    await c.env.DB.prepare("UPDATE events SET is_deleted = 0 WHERE id = ?").bind(id).run();
    return true; // We handled the DB update manually
  }
}));

// ── POST /admin/events/:id/repush — manual social broadcast (admin) ──
adminRouter.post("/:id/repush", rateLimitMiddleware(15, 60), async (c) => {
  try {
    const id = (c.req.param("id") || "");
    let json;
    try {
      json = await c.req.json<{ socials: Record<string, boolean> }>();
    } catch {
      return c.json({ error: "Invalid request payload (malformed JSON or FormData)" }, 400);
    }
    const { socials } = json;
    const event = await c.env.DB.prepare("SELECT title, description, cover_image FROM events WHERE id = ?").bind(id).first<{title: string, description: string, cover_image: string}>();
    if (!event) return c.json({ error: "Event not found" }, 404);
    const socialConfig = await getSocialConfig(c) as SocialConfig;
    const baseUrl = new URL(c.req.url).origin;
    
    const payload: PostPayload = { 
      title: event.title, 
      url: `${baseUrl}/events`, 
      snippet: extractAstText(event.description || "").substring(0, 250) || "Join us for our upcoming event!", 
      coverImageUrl: event.cover_image || "/gallery_1.png", 
      baseUrl: baseUrl
    };

    c.executionCtx.waitUntil(
      dispatchSocials(c.env.DB, payload, socialConfig, socials).catch(err => console.error("Event social repush failed:", err))
    );
    
    return c.json({ success: true });
  } catch (err) {
    console.error("Event repush error:", err);
    return c.json({ error: "Repush failed" }, 500);
  }
});

export default adminRouter;
