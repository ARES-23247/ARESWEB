import { Hono } from "hono";
import { Bindings, getSocialConfig, extractAstText, getSessionUser } from "./_shared";
import { pushEventToGcal, deleteEventFromGcal, pullEventsFromGcal } from "../../utils/gcalSync";
import { dispatchSocials } from "../../utils/socialSync";

const eventsRouter = new Hono<{ Bindings: Bindings }>();

// ── GET /events — list all events ──────────────────────────────────────
eventsRouter.get("/events", async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      "SELECT id, title, date_start, date_end, location, description, cover_image, gcal_event_id, cf_email, is_potluck, is_volunteer FROM events WHERE is_deleted = 0 AND status = 'published' ORDER BY date_start ASC"
    ).all();
    return c.json({ events: results ?? [] });
  } catch (err) {
    console.error("D1 list error (events):", err);
    return c.json({ events: [] });
  }
});

// ── GET /events/:id — single event ─────────────────────────────────────
eventsRouter.get("/events/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const row = await c.env.DB.prepare(
      "SELECT id, title, date_start, date_end, location, description, cover_image, gcal_event_id, cf_email, is_potluck, is_volunteer FROM events WHERE id = ? AND is_deleted = 0 AND status = 'published'"
    ).bind(id).first();

    if (!row) return c.json({ error: "Event not found" }, 404);
    return c.json({ event: row });
  } catch (err) {
    console.error("D1 read error:", err);
    return c.json({ error: "Database error" }, 500);
  }
});

// ── GET /calendar — public calendar configuration ──────────────────────
eventsRouter.get("/calendar", async (c) => {
  try {
    const row = await c.env.DB.prepare("SELECT value FROM settings WHERE key = 'CALENDAR_ID'").first<{value: string}>();
    return c.json({ calendarId: row?.value || "" });
  } catch (err) {
    console.error("D1 read error:", err);
    return c.json({ error: "Database error" }, 500);
  }
});

// ── GET /admin/events — list all events (admin) ─────────────────────────
eventsRouter.get("/admin/events", async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      "SELECT id, title, date_start, date_end, location, description, cover_image, gcal_event_id, cf_email, is_deleted, status, is_potluck, is_volunteer, revision_of FROM events ORDER BY date_start ASC"
    ).all();
    return c.json({ events: results ?? [] });
  } catch (err) {
    console.error("D1 admin list error (events):", err);
    return c.json({ events: [] });
  }
});

// ── GET /admin/events/:id — single event (admin) ────────────────────────
eventsRouter.get("/admin/events/:id", async (c) => {
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
eventsRouter.post("/admin/events", async (c) => {
  try {
    const email = c.req.header("cf-access-authenticated-user-email") || "anonymous_admin";
    const body = await c.req.json();
    const { title, dateStart, dateEnd, location, description, coverImage, socials, isPotluck, isVolunteer } = body;

    if (!title || !dateStart) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    const warnings: string[] = [];
    const genId = crypto.randomUUID();
    
    // Sync to GCal if enabled
    let gcalId: string | null = null;
    const socialConfig = await getSocialConfig(c);
    const gcalEmail = socialConfig["GCAL_SERVICE_ACCOUNT_EMAIL"];
    const gcalKey = socialConfig["GCAL_PRIVATE_KEY"];
    const calId = socialConfig["CALENDAR_ID"];

    if (gcalEmail && gcalKey && calId) {
      try {
        gcalId = (await pushEventToGcal(
           { id: genId, title, date_start: dateStart, date_end: dateEnd, location, description, cover_image: coverImage ?? null },
           { email: gcalEmail, privateKey: gcalKey, calendarId: calId }
        )) || null;
      } catch (err: unknown) {
        console.error("GCal manual POST error:", err);
        warnings.push(`Google Calendar Auth Failed: ${(err as Error)?.message || "Unknown GCal Error"}`);
      }
    }

    const user = await getSessionUser(c);
    const status = user?.role === "admin" ? "published" : "pending";

    await c.env.DB.prepare(
      "INSERT INTO events (id, title, date_start, date_end, location, description, gcal_event_id, cf_email, cover_image, status, is_potluck, is_volunteer) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(genId, title, dateStart, dateEnd || null, location || "", description || "", gcalId, email, coverImage || null, status, isPotluck ? 1 : 0, isVolunteer ? 1 : 0).run();

    // Dispatch Socials
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
         console.error("Event social dispatch failed:", err);
         warnings.push(`Network Syndication Failed: ${(err as Error)?.message || String(err)}`);
       }
    }

    const finalStatus = warnings.length > 0 ? 207 : 200;
    return c.json({ success: true, id: genId, warning: warnings.length > 0 ? warnings.join(" | ") : undefined }, finalStatus as 200 | 207);
  } catch (err: unknown) {
    console.error("D1 manual event creation error:", err);
    return c.json({ error: "Write failed" }, 500);
  }
});

// ── PUT /admin/events/:id — edit an event (admin) ────────────────────────
eventsRouter.put("/admin/events/:id", async (c) => {
  try {
    const paramId = c.req.param("id");
    const body = await c.req.json();
    const { title, dateStart, dateEnd, location, description, coverImage, socials, isPotluck, isVolunteer } = body;

    if (!title || !dateStart) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    const warnings: string[] = [];
    const socialConfig = await getSocialConfig(c);
    const gcalEmail = socialConfig["GCAL_SERVICE_ACCOUNT_EMAIL"];
    const gcalKey = socialConfig["GCAL_PRIVATE_KEY"];
    const calId = socialConfig["CALENDAR_ID"];

    // Attempt GCal update
    let gcalId: string | null = null;
    if (gcalEmail && gcalKey && calId) {
      const row = await c.env.DB.prepare("SELECT gcal_event_id FROM events WHERE id = ?").bind(paramId).first<{gcal_event_id: string}>();
      try {
        gcalId = (await pushEventToGcal(
          { id: paramId, title, date_start: dateStart, date_end: dateEnd, location, description, cover_image: coverImage, gcal_event_id: row?.gcal_event_id },
          { email: gcalEmail, privateKey: gcalKey, calendarId: calId }
        )) || null;
      } catch (err: unknown) {
        console.error("GCal PUT update error:", err);
        warnings.push(`Google Calendar Auth Failed: ${(err as Error)?.message || "Unknown GCal Error"}`);
      }
    }

    const user = await getSessionUser(c);

    if (user?.role !== "admin") {
      // ── Shadow Revision Logic (Student Edits) ──
      const revId = `${paramId}-rev-${Math.random().toString(36).substring(2, 6)}`;
      await c.env.DB.prepare(
        `INSERT INTO events (id, title, date_start, date_end, location, description, cover_image, gcal_event_id, cf_email, status, is_potluck, is_volunteer, revision_of)
         VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, gcal_event_id), ?, 'pending', ?, ?, ?)`
      ).bind(
        revId, title, dateStart, dateEnd || null, location || "", description || "", coverImage || "",
        gcalId || null, user?.email || "anonymous_author", isPotluck ? 1 : 0, isVolunteer ? 1 : 0, paramId
      ).run();
      
      const finalStatus = warnings.length > 0 ? 207 : 200;
      return c.json({ success: true, id: revId, warning: warnings.length > 0 ? warnings.join(" | ") : undefined }, finalStatus as 200 | 207);
    }

    const status = "published";

    await c.env.DB.prepare(
      `UPDATE events SET title = ?, date_start = ?, date_end = ?, location = ?, description = ?, cover_image = ?, gcal_event_id = COALESCE(?, gcal_event_id), status = ?, is_potluck = ?, is_volunteer = ? WHERE id = ?`
    )
      .bind(title, dateStart, dateEnd || null, location || "", description || "", coverImage || "", gcalId || null, status, isPotluck ? 1 : 0, isVolunteer ? 1 : 0, paramId)
      .run();

    // ── Optional Social Syndication ──
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
         console.error("Event update social dispatch failed:", err);
         warnings.push(`Network Syndication Failed: ${(err as Error)?.message || String(err)}`);
       }
    }

    const finalStatus = warnings.length > 0 ? 207 : 200;
    return c.json({ success: true, id: paramId, warning: warnings.length > 0 ? warnings.join(" | ") : undefined }, finalStatus as 200 | 207);
  } catch (err: unknown) {
    console.error("D1 write error (events):", err);
    return c.json({ success: false, error: (err as Error)?.message || "Event update failed" }, 500);
  }
});

// ── DELETE /admin/events/:id — soft-delete (admin) ──────────────────────
eventsRouter.delete("/admin/events/:id", async (c) => {
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
eventsRouter.patch("/admin/events/:id/undelete", async (c) => {
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
eventsRouter.delete("/admin/events/:id/purge", async (c) => {
  try {
    const id = c.req.param("id");
    
    // GCal cleanup if possible
    const { results: settingsRows } = await c.env.DB.prepare("SELECT key, value FROM settings").all();
    const dbSettings: Record<string, string> = {};
    for (const row of settingsRows as { key: string, value: string }[]) {
       dbSettings[row.key] = row.value;
    }
    const gcalEmail = dbSettings["GCAL_SERVICE_ACCOUNT_EMAIL"];
    const gcalKey = dbSettings["GCAL_PRIVATE_KEY"];
    const calId = dbSettings["CALENDAR_ID"];
    
    if (gcalEmail && gcalKey && calId) {
      const row = await c.env.DB.prepare("SELECT gcal_event_id FROM events WHERE id = ?").bind(id).first<{gcal_event_id: string}>();
      if (row && row.gcal_event_id) {
        try {
          await deleteEventFromGcal(row.gcal_event_id, {
            email: gcalEmail,
            privateKey: gcalKey,
            calendarId: calId
          });
        } catch (err: unknown) {
          console.warn("GCal purge cleanup failed (ignoring for DB purge):", err);
        }
      }
    }

    await c.env.DB.prepare("DELETE FROM events WHERE id = ?").bind(id).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 purge error (events):", err);
    return c.json({ error: "Purge failed" }, 500);
  }
});

// ── PATCH /admin/events/:id/approve — approve pending event (admin) ───
eventsRouter.patch("/admin/events/:id/approve", async (c) => {
  try {
    const user = await getSessionUser(c);
    if (user?.role !== "admin") return c.json({ error: "Unauthorized" }, 401);
    const id = c.req.param("id");

    type EventRow = { revision_of?: string; title: string; date_start: string; date_end: string; location: string; description: string; cover_image: string; gcal_event_id: string; is_potluck: number; is_volunteer: number };
    const row = await c.env.DB.prepare("SELECT * FROM events WHERE id = ?").bind(id).first<EventRow>();

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

// ── POST /admin/events/:id/repush — manual social broadcast (admin) ──
eventsRouter.post("/admin/events/:id/repush", async (c) => {
  try {
    const id = c.req.param("id");
    const { socials } = await c.req.json<{ socials: Record<string, boolean> }>();
    
    const event = await c.env.DB.prepare(
      "SELECT title, description, cover_image FROM events WHERE id = ?"
    ).bind(id).first<{ title: string, description: string, cover_image: string }>();

    if (!event) return c.json({ error: "Event not found" }, 404);

    const socialConfig = await getSocialConfig(c);
    
    try {
      await dispatchSocials({
        title: event.title,
        url: `https://aresfirst.org/events`,
        snippet: extractAstText(event.description || "").substring(0, 250) || "Join us for our upcoming event!",
        coverImageUrl: event.cover_image || "/gallery_1.png",
        baseUrl: new URL(c.req.url).origin
      }, socialConfig, socials);
    } catch (err: unknown) {
      console.error("Event repush failed:", err);
      return c.json({ error: `Network Repush Failed: ${(err as Error)?.message || String(err)}` }, 502);
    }

    return c.json({ success: true });
  } catch (err) {
    console.error("Event repush error:", err);
    return c.json({ error: "Repush failed" }, 500);
  }
});

// ── POST /admin/events/sync — Google Calendar Sync (admin) ──────────────
eventsRouter.post("/admin/events/sync", async (c) => {
  try {
    const { results: settingsRows } = await c.env.DB.prepare("SELECT key, value FROM settings").all();
    const dbSettings: Record<string, string> = {};
    for (const row of settingsRows as { key: string, value: string }[]) {
       dbSettings[row.key] = row.value;
    }
    const gcalEmail = dbSettings["GCAL_SERVICE_ACCOUNT_EMAIL"];
    const gcalKey = dbSettings["GCAL_PRIVATE_KEY"];
    const CALENDAR_ID = dbSettings["CALENDAR_ID"] || "af2d297c3425adaeafc13ddd48a582056404cbf16a6156d3925bb8f3b4affaa0@group.calendar.google.com";
    const ICS_URL = `https://calendar.google.com/calendar/ical/${encodeURIComponent(CALENDAR_ID)}/public/basic.ics`;
    const email = c.req.header("cf-access-authenticated-user-email") || "sync";

    let newCount = 0;
    let upCount = 0;

    // Use fast realtime REST API if Authenticated
    if (gcalEmail && gcalKey && CALENDAR_ID) {
      const events = await pullEventsFromGcal({
        email: gcalEmail,
        privateKey: gcalKey,
        calendarId: CALENDAR_ID
      });

      for (const ev of events) {
        const existing = await c.env.DB.prepare("SELECT id FROM events WHERE gcal_event_id = ?").bind(ev.gcal_event_id).first();
        if (existing) {
          await c.env.DB.prepare(
            "UPDATE events SET title = ?, date_start = ?, date_end = ?, location = ?, description = ? WHERE gcal_event_id = ?"
          ).bind(ev.title, ev.date_start, ev.date_end || null, ev.location, ev.description, ev.gcal_event_id).run();
          upCount++;
        } else {
          const genId = crypto.randomUUID();
          await c.env.DB.prepare(
            "INSERT INTO events (id, title, date_start, date_end, location, description, gcal_event_id, cf_email, cover_image, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published')"
          ).bind(genId, ev.title, ev.date_start, ev.date_end || null, ev.location, ev.description, ev.gcal_event_id, email, null).run();
          newCount++;
        }
      }
    } else {
      // Fallback: Public ICS polling
      const icsResponse = await fetch(ICS_URL);
      if (!icsResponse.ok) throw new Error("Failed to fetch Google Calendar ICS");
      const icsText = await icsResponse.text();

      const parseICSDate = (icsDate: string) => {
        if (!icsDate) return null;
        const clean = icsDate.replace(/[^0-9TZ]/g, "");
        if (clean.length === 8) {
          return `${clean.substring(0,4)}-${clean.substring(4,6)}-${clean.substring(6,8)}T00:00:00Z`;
        }
        if (clean.length >= 15) {
          return `${clean.substring(0,4)}-${clean.substring(4,6)}-${clean.substring(6,8)}T${clean.substring(9,11)}:${clean.substring(11,13)}:${clean.substring(13,15)}Z`;
        }
        return null;
      };

      const extractField = (block: string, field: string) => {
        const regex = new RegExp(`^${field}(?:;[^:]+)?:(.*)$`, "m");
        const match = block.match(regex);
        return match ? match[1].trim().replace(/\\,/g, ",").replace(/\\n/g, "\n") : null;
      };

      const blocks = icsText.split("BEGIN:VEVENT");
      blocks.shift();

      for (const block of blocks) {
        const uid = extractField(block, "UID");
        if (!uid) continue;

        const title = extractField(block, "SUMMARY") || "Untitled Event";
        const start = extractField(block, "DTSTART");
        const end = extractField(block, "DTEND");
        const location = extractField(block, "LOCATION") || "";
        const description = extractField(block, "DESCRIPTION") || "";

        const parsedStart = parseICSDate(start || "");
        const parsedEnd = parseICSDate(end || "");

        if (!parsedStart) continue;

        const existing = await c.env.DB.prepare("SELECT id FROM events WHERE gcal_event_id = ?").bind(uid).first();
        if (existing) {
          await c.env.DB.prepare(
            "UPDATE events SET title = ?, date_start = ?, date_end = ?, location = ?, description = ? WHERE gcal_event_id = ?"
          ).bind(title, parsedStart, parsedEnd, location, description, uid).run();
          upCount++;
        } else {
          const genId = crypto.randomUUID();
          await c.env.DB.prepare(
            "INSERT INTO events (id, title, date_start, date_end, location, description, gcal_event_id, cf_email, cover_image, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published')"
          ).bind(genId, title, parsedStart, parsedEnd, location, description, uid, email, null).run();
          newCount++;
        }
      }
    }

    return c.json({ success: true, synced: newCount + upCount, newEvents: newCount, updatedEvents: upCount });
  } catch (err: unknown) {
    console.error("GCal sync error:", err);
    return c.json({ success: false, error: (err as Error)?.message || "Calendar sync failed" }, 500);
  }
});

// ── Event Sign-Ups ────────────────────────────────────────────────────
eventsRouter.get("/events/:id/signups", async (c) => {
  const eventId = c.req.param("id");
  const user = await getSessionUser(c);

  try {
    const isVerified = user && user.role !== "unverified";
    const isManagement = user && (user.role === "admin" || ["coach", "mentor"].includes(user.member_type));

    const { results } = await c.env.DB.prepare(
      `SELECT s.*, p.nickname, u.image as avatar FROM event_signups s
       JOIN user_profiles p ON s.user_id = p.user_id
       JOIN user u ON s.user_id = u.id
       WHERE s.event_id = ? AND u.role NOT IN ('unverified') ORDER BY s.created_at ASC`
    ).bind(eventId).all();

    const signups = (results || []).map((r: { nickname?: string; user_id?: string; attended?: number; prep_hours?: number; [key: string]: unknown }) => ({
      ...r,
      nickname: r.nickname || "ARES Member",
      is_own: user ? r.user_id === user.id : false,
      attended: !!r.attended,
      prep_hours: Number(r.prep_hours || 0),
    }));

    // Aggregate dietary info for verified users (Anonymous)
    const dietarySummary: Record<string, number> = {};
    const teamDietarySummary: Record<string, number> = {};
    if (isVerified) {
      // 1. Dietary restrictions for RSVP'd members
      const { results: profiles } = await c.env.DB.prepare(
        `SELECT p.dietary_restrictions FROM event_signups s
         JOIN user_profiles p ON s.user_id = p.user_id
         JOIN user u ON s.user_id = u.id
         WHERE s.event_id = ? AND u.role NOT IN ('unverified')`
      ).bind(eventId).all();

      for (const p of (profiles || []) as Array<{ dietary_restrictions?: string }>) {
        try {
          const restrictions = JSON.parse(p.dietary_restrictions || "[]") as string[];
          for (const r of restrictions) {
            dietarySummary[r] = (dietarySummary[r] || 0) + 1;
          }
        } catch { /* ignore */ }
      }
      
      // 2. Dietary restrictions for the entire verified team
      const { results: allProfiles } = await c.env.DB.prepare(
        `SELECT p.dietary_restrictions FROM user_profiles p
         JOIN user u ON p.user_id = u.id
         WHERE u.role NOT IN ('unverified')`
      ).all();

      for (const p of (allProfiles || []) as Array<{ dietary_restrictions?: string }>) {
        try {
          const restrictions = JSON.parse(p.dietary_restrictions || "[]") as string[];
          for (const r of restrictions) {
            teamDietarySummary[r] = (teamDietarySummary[r] || 0) + 1;
          }
        } catch { /* ignore */ }
      }
    }

    return c.json({
      signups,
      dietary_summary: isVerified ? dietarySummary : null,
      team_dietary_summary: isVerified ? teamDietarySummary : null,
      authenticated: !!user,
      role: user?.role || null,
      member_type: user?.member_type || null,
      can_manage: isManagement,
    });
  } catch (err) {
    console.error("[Signups GET]", err);
    return c.json({ error: "Failed to fetch signups" }, 500);
  }
});

eventsRouter.post("/events/:id/signups", async (c) => {
  const user = await getSessionUser(c);
  if (!user || user.role === "unverified") {
    return c.json({ error: "Forbidden: Your account is pending team verification." }, 403);
  }
  const eventId = c.req.param("id");
  const { bringing, notes, prep_hours } = await c.req.json() as { bringing: string; notes: string; prep_hours?: number };
  try {
    await c.env.DB.prepare(
      `INSERT INTO event_signups (event_id, user_id, bringing, notes, prep_hours) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(event_id, user_id) DO UPDATE SET bringing=excluded.bringing, notes=excluded.notes, prep_hours=excluded.prep_hours`
    ).bind(eventId, user.id, bringing || "", notes || "", prep_hours || 0).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("[Signups POST]", err);
    return c.json({ error: "Failed" }, 500);
  }
});

eventsRouter.delete("/events/:id/signups/me", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const eventId = c.req.param("id");
  try {
    await c.env.DB.prepare("DELETE FROM event_signups WHERE event_id = ? AND user_id = ?").bind(eventId, user.id).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("[Signups DELETE me]", err);
    return c.json({ error: "Failed" }, 500);
  }
});

// ── PATCH /events/:id/signups/me/attendance — Self Check-in ────────────
eventsRouter.patch("/events/:id/signups/me/attendance", async (c) => {
  const eventId = c.req.param("id");
  const user = await getSessionUser(c);
  if (!user || user.role === "unverified") return c.json({ error: "Unauthorized" }, 401);

  try {
    await c.env.DB.prepare(
      `INSERT INTO event_signups (event_id, user_id, attended) VALUES (?, ?, 1)
       ON CONFLICT(event_id, user_id) DO UPDATE SET attended = 1`
    ).bind(eventId, user.id).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("[Attendance Self PATCH]", err);
    return c.json({ error: "Failed to update attendance" }, 500);
  }
});

// ── PATCH /events/:id/signups/:userId/attendance — Leader Check-in ──────
eventsRouter.patch("/events/:id/signups/:userId/attendance", async (c) => {
  const eventId = c.req.param("id");
  const userId = c.req.param("userId");
  const leader = await getSessionUser(c);

  if (!leader) return c.json({ error: "Unauthorized" }, 401);
  const isManagement = leader.role === "admin" || ["coach", "mentor"].includes(leader.member_type);
  if (!isManagement) return c.json({ error: "Forbidden" }, 403);

  try {
    const body = await c.req.json() as { attended: boolean };
    await c.env.DB.prepare(
      "UPDATE event_signups SET attended = ? WHERE event_id = ? AND user_id = ?"
    ).bind(body.attended ? 1 : 0, eventId, userId).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("[Attendance Leader PATCH]", err);
    return c.json({ error: "Failed to update attendance" }, 500);
  }
});

export default eventsRouter;
