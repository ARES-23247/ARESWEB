import { Hono } from "hono";
import { Bindings, getSocialConfig, extractAstText, getSessionUser, getDbSettings } from "../_shared";
import { pushEventToGcal, deleteEventFromGcal } from "../../../utils/gcalSync";
import { dispatchSocials } from "../../../utils/socialSync";

const adminRouter = new Hono<{ Bindings: Bindings }>();

// ── GET /admin/events — list all events (admin) ─────────────────────────
adminRouter.get("/", async (c) => {
  try {
    const limit = Math.min(Number(c.req.query("limit") || "100"), 500);
    const offset = Number(c.req.query("offset") || "0");
    const { results: events } = await c.env.DB.prepare(
      "SELECT id, title, category, date_start, date_end, location, description, cover_image, gcal_event_id, cf_email, is_deleted, status, is_potluck, is_volunteer, revision_of FROM events ORDER BY date_start ASC LIMIT ? OFFSET ?"
    ).bind(limit, offset).all();

    const lastSyncRow = await c.env.DB.prepare("SELECT value FROM settings WHERE key = 'LAST_CALENDAR_SYNC'").first<{value: string}>();
    
    return c.json({ 
      events: events ?? [],
      lastSyncedAt: lastSyncRow?.value || null 
    });
  } catch (err) {
    console.error("D1 admin list error (events):", err);
    return c.json({ events: [], lastSyncedAt: null });
  }
});

// ── GET /admin/events/:id — single event (admin) ────────────────────────
adminRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const row = await c.env.DB.prepare(
      "SELECT id, title, date_start, date_end, location, description, cover_image, gcal_event_id, cf_email, is_deleted, status, is_potluck, is_volunteer FROM events WHERE id = ?"
    ).bind(id).first();

    if (!row) return c.json({ error: "Event not found" }, 404);
    return c.json({ event: row });
  } catch (err) {
    console.error("D1 read error:", err);
    return c.json({ error: "Database error" }, 500);
  }
});

// ── POST /admin/events — manual event creation (admin) ─────────────────
adminRouter.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const { title, category, dateStart, dateEnd, location, description, coverImage, socials, isPotluck, isVolunteer, isDraft } = body;
    const cat = category || 'internal';

    if (!title || !dateStart) return c.json({ error: "Missing required fields" }, 400);

    const warnings: string[] = [];
    const genId = crypto.randomUUID();
    
    // Sync to GCal if enabled
    let gcalId: string | null = null;
    const socialConfig = await getSocialConfig(c);
    const gcalEmail = socialConfig["GCAL_SERVICE_ACCOUNT_EMAIL"];
    const gcalKey = socialConfig["GCAL_PRIVATE_KEY"];
    const calId = socialConfig[`CALENDAR_ID_${cat.toUpperCase()}` as keyof typeof socialConfig] || socialConfig["CALENDAR_ID"];

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
    const status = isDraft ? "pending" : "published";

    await c.env.DB.prepare(
      `INSERT INTO events (id, title, category, date_start, date_end, location, description, cover_image, gcal_event_id, cf_email, status, is_potluck, is_volunteer)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      genId, title, cat, dateStart, dateEnd || null, location || "", description || "", coverImage || "",
      gcalId || null, email, status, isPotluck ? 1 : 0, isVolunteer ? 1 : 0
    ).run();

    if (socials) {
       try {
         await dispatchSocials({
            title: title,
            url: `https://aresfirst.org/events`,
            snippet: extractAstText(description).substring(0, 250) || "New event scheduled!",
            coverImageUrl: coverImage || "/gallery_1.png",
            baseUrl: new URL(c.req.url).origin
         }, socialConfig, socials);
       } catch (err: unknown) {
         warnings.push(`Network Syndication Failed: ${(err as Error).message || String(err)}`);
       }
    }

    return c.json({ success: true, id: genId, warning: warnings.length > 0 ? warnings.join(" | ") : undefined }, warnings.length > 0 ? 207 : 200);
  } catch (err: unknown) {
    console.error("D1 manual event creation error:", err);
    return c.json({ error: "Write failed" }, 500);
  }
});

// ── PUT /admin/events/:id — edit an event (admin) ────────────────────────
adminRouter.put("/:id", async (c) => {
  try {
    const paramId = c.req.param("id");
    const body = await c.req.json();
    const { title, category, dateStart, dateEnd, location, description, coverImage, socials, isPotluck, isVolunteer, isDraft } = body;
    const cat = category || 'internal';
    
    if (!title || !dateStart) return c.json({ error: "Missing required fields" }, 400);
    const warnings: string[] = [];

    const socialConfig = await getSocialConfig(c);
    const gcalEmail = socialConfig["GCAL_SERVICE_ACCOUNT_EMAIL"];
    const gcalKey = socialConfig["GCAL_PRIVATE_KEY"];
    const calId = socialConfig[`CALENDAR_ID_${cat.toUpperCase()}` as keyof typeof socialConfig] || socialConfig["CALENDAR_ID"];

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
        `INSERT INTO events (id, title, category, date_start, date_end, location, description, cover_image, gcal_event_id, cf_email, status, is_potluck, is_volunteer, revision_of)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, gcal_event_id), ?, 'pending', ?, ?, ?)`
      ).bind(revId, title, cat, dateStart, dateEnd || null, location || "", description || "", coverImage || "", gcalId || null, user?.email || "anonymous_author", isPotluck ? 1 : 0, isVolunteer ? 1 : 0, paramId).run();
      return c.json({ success: true, id: revId, warning: warnings.length > 0 ? warnings.join(" | ") : undefined }, warnings.length > 0 ? 207 : 200);
    }

    const status = isDraft ? "pending" : "published";
    await c.env.DB.prepare(
      `UPDATE events SET title = ?, category = ?, date_start = ?, date_end = ?, location = ?, description = ?, cover_image = ?, gcal_event_id = COALESCE(?, gcal_event_id), status = ?, is_potluck = ?, is_volunteer = ? WHERE id = ?`
    ).bind(title, cat, dateStart, dateEnd || null, location || "", description || "", coverImage || "", gcalId || null, status, isPotluck ? 1 : 0, isVolunteer ? 1 : 0, paramId).run();

     if (socials) {
       try {
         await dispatchSocials({
            title: title,
            url: `https://aresfirst.org/events`,
            snippet: extractAstText(description).substring(0, 250) || "New event scheduled!",
            coverImageUrl: coverImage || "/gallery_1.png",
            baseUrl: new URL(c.req.url).origin
         }, socialConfig, socials);
       } catch (err: unknown) {
         warnings.push(`Network Syndication Failed: ${(err as Error).message || String(err)}`);
       }
    }

    return c.json({ success: true, id: paramId, warning: warnings.length > 0 ? warnings.join(" | ") : undefined }, warnings.length > 0 ? 207 : 200);
  } catch (err: unknown) {
    console.error("D1 write error (events):", err);
    return c.json({ success: false, error: (err as Error).message || "Event update failed" }, 500);
  }
});

// ── DELETE /admin/events/:id — soft-delete (admin) ──────────────────────
adminRouter.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await c.env.DB.prepare("UPDATE events SET is_deleted = 1 WHERE id = ?").bind(id).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 soft-delete error (events):", err);
    return c.json({ error: "Soft-delete failed" }, 500);
  }
});

// ── PATCH /admin/events/:id/undelete — restore (admin) ──────────────────
adminRouter.patch("/:id/undelete", async (c) => {
  try {
    const id = c.req.param("id");
    await c.env.DB.prepare("UPDATE events SET is_deleted = 0 WHERE id = ?").bind(id).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 undelete error (events):", err);
    return c.json({ error: "Undelete failed" }, 500);
  }
});

// ── DELETE /admin/events/:id/purge — PERMANENTLY delete (admin) ────────
adminRouter.delete("/:id/purge", async (c) => {
  try {
    const id = c.req.param("id");
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

    await c.env.DB.prepare("DELETE FROM events WHERE id = ?").bind(id).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 purge error (events):", err);
    return c.json({ error: "Purge failed" }, 500);
  }
});

// ── PATCH /admin/events/:id/approve — approve pending event (admin) ───
adminRouter.patch("/:id/approve", async (c) => {
  try {
    const user = await getSessionUser(c);
    if (user?.role !== "admin") return c.json({ error: "Unauthorized" }, 401);
    const id = c.req.param("id");

    interface EventRevisionRow { 
      revision_of: string; 
      title: string; 
      date_start: string; 
      date_end: string; 
      location: string; 
      description: string; 
      cover_image: string; 
      gcal_event_id: string; 
      is_potluck: number; 
      is_volunteer: number; 
    }
    const row = await c.env.DB.prepare("SELECT revision_of, title, date_start, date_end, location, description, cover_image, gcal_event_id, is_potluck, is_volunteer FROM events WHERE id = ?").bind(id).first<EventRevisionRow>();

    if (row && row.revision_of) {
      await c.env.DB.prepare(
        "UPDATE events SET title = ?, date_start = ?, date_end = ?, location = ?, description = ?, cover_image = ?, gcal_event_id = COALESCE(?, gcal_event_id), status = 'published', is_potluck = ?, is_volunteer = ? WHERE id = ?"
      ).bind(row.title, row.date_start, row.date_end, row.location, row.description, row.cover_image, row.gcal_event_id, row.is_potluck, row.is_volunteer, row.revision_of).run();
      await c.env.DB.prepare("DELETE FROM events WHERE id = ?").bind(id).run();
      return c.json({ success: true });
    }

    await c.env.DB.prepare("UPDATE events SET status = 'published' WHERE id = ?").bind(id).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 approve error (events):", err);
    return c.json({ error: "Approval failed" }, 500);
  }
});

// ── PATCH /admin/events/:id/reject — reject pending event (admin) ───
adminRouter.patch("/:id/reject", async (c) => {
  try {
    const user = await getSessionUser(c);
    if (user?.role !== "admin") return c.json({ error: "Unauthorized" }, 401);
    const id = c.req.param("id");
    const body = (await c.req.json().catch(() => ({}))) as { reason?: string };
    await c.env.DB.prepare("UPDATE events SET status = 'rejected' WHERE id = ?").bind(id).run();
    return c.json({ success: true, reason: body.reason || "No reason provided" });
  } catch (err) {
    console.error("D1 reject error (events):", err);
    return c.json({ error: "Rejection failed" }, 500);
  }
});

// ── POST /admin/events/:id/repush — manual social broadcast (admin) ──
adminRouter.post("/:id/repush", async (c) => {
  try {
    const id = c.req.param("id");
    const { socials } = await c.req.json<{ socials: Record<string, boolean> }>();
    const event = await c.env.DB.prepare("SELECT title, description, cover_image FROM events WHERE id = ?").bind(id).first<{title: string, description: string, cover_image: string}>();
    if (!event) return c.json({ error: "Event not found" }, 404);
    const socialConfig = await getSocialConfig(c);
    try {
      await dispatchSocials({ title: event.title, url: `https://aresfirst.org/events`, snippet: extractAstText(event.description || "").substring(0, 250) || "Join us for our upcoming event!", coverImageUrl: event.cover_image || "/gallery_1.png", baseUrl: new URL(c.req.url).origin }, socialConfig, socials);
    } catch (err: unknown) { return c.json({ error: `Network Repush Failed: ${(err as Error).message || String(err)}` }, 502); }
    return c.json({ success: true });
  } catch (err) {
    console.error("Event repush error:", err);
    return c.json({ error: "Repush failed" }, 500);
  }
});

export default adminRouter;
