import { Hono } from "hono";
import { AppEnv, getSessionUser, turnstileMiddleware  } from "../../middleware";

const signupsRouter = new Hono<AppEnv>();

// ── Event Sign-Ups ────────────────────────────────────────────────────
signupsRouter.get("/:id/signups", async (c) => {
  const eventId = (c.req.param("id") || "");
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

    interface SignupRecord {
      user_id: string;
      nickname?: string;
      attended?: number | boolean;
      prep_hours?: number | string;
      notes?: string;
    }

    const signups = isVerified ? (results || []).map((r: unknown) => {
      const rec = r as SignupRecord;
      const isOwn = user ? rec.user_id === user.id : false;
      
      // PII-S02: Redact notes for non-admin users, unless it's their own signup
      return {
        ...rec,
        nickname: rec.nickname || "ARES Member",
        is_own: isOwn,
        attended: !!rec.attended,
        prep_hours: Number(rec.prep_hours || 0),
        notes: (isManagement || isOwn) ? rec.notes : undefined
      };
    }) : [];

    const dietarySummary: Record<string, number> = {};
    const teamDietarySummary: Record<string, number> = {};
    if (isVerified) {
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
  } catch (err: unknown) {
    console.error("[Signups GET]", err);
    return c.json({ error: "Failed to fetch signups: " + ((err as Error)?.message || String(err)) }, 500);
  }
});

signupsRouter.post("/:id/signups", turnstileMiddleware(), async (c) => {
  const user = await getSessionUser(c);
  if (!user || user.role === "unverified") {
    return c.json({ error: "Forbidden: Your account is pending team verification." }, 403);
  }
  const eventId = (c.req.param("id") || "");
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "Invalid JSON" }, 400);

  const { bringing, notes, prep_hours } = body as { bringing: string; notes: string; prep_hours?: number };
  try {
    await c.env.DB.prepare(
      `INSERT INTO event_signups (event_id, user_id, bringing, notes, prep_hours) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(event_id, user_id) DO UPDATE SET bringing=excluded.bringing, notes=excluded.notes, prep_hours=excluded.prep_hours`
    ).bind(eventId, user.id, bringing || "", notes || "", prep_hours || 0).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("[Signups POST]", err);
    return c.json({ error: "Database error" }, 500);
  }
});

signupsRouter.delete("/:id/signups/me", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const eventId = (c.req.param("id") || "");
  try {
    await c.env.DB.prepare("DELETE FROM event_signups WHERE event_id = ? AND user_id = ?").bind(eventId, user.id).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("[Signups DELETE me]", err);
    return c.json({ error: "Database error" }, 500);
  }
});

signupsRouter.patch("/:id/signups/me/attendance", async (c) => {
  const eventId = (c.req.param("id") || "");
  const user = await getSessionUser(c);
  if (!user || user.role === "unverified") return c.json({ error: "Unauthorized" }, 401);

  try {
    const body = await c.req.json().catch(() => null);
    if (!body || body.attended === undefined) return c.json({ error: "Missing 'attended' field" }, 400);
    const attended = body.attended ? 1 : 0;
    
    await c.env.DB.prepare(
      `INSERT INTO event_signups (event_id, user_id, attended) VALUES (?, ?, ?)
       ON CONFLICT(event_id, user_id) DO UPDATE SET attended = ?`
    ).bind(eventId, user.id, attended, attended).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("[Attendance Self PATCH]", err);
    return c.json({ error: "Failed to update attendance" }, 500);
  }
});

signupsRouter.patch("/:id/signups/:userId/attendance", async (c) => {
  try {
    const eventId = (c.req.param("id") || "");
    const userId = (c.req.param("userId") || "");
    const user = await getSessionUser(c);
    if (user?.role !== "admin" && !["coach", "mentor"].includes(user?.member_type || "")) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const body = await c.req.json().catch(() => null);
    if (!body || body.attended === undefined) return c.json({ error: "Missing 'attended' field" }, 400);
    const attended = body.attended ? 1 : 0;
    
    await c.env.DB.prepare(
      `INSERT INTO event_signups (event_id, user_id, attended) VALUES (?, ?, ?)
       ON CONFLICT(event_id, user_id) DO UPDATE SET attended = ?`
    ).bind(eventId, userId, attended, attended).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("[Attendance Leader PATCH]", err);
    return c.json({ error: "Failed to update attendance" }, 500);
  }
});

export default signupsRouter;
