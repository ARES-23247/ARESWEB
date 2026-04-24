 
import { Hono } from "hono";
import { AppEnv, getSessionUser, turnstileMiddleware  } from "../../middleware";

const signupsRouter = new Hono<AppEnv>();

// ── Event Sign-Ups ────────────────────────────────────────────────────
signupsRouter.get("/:id/signups", async (c: any) => {
  const eventId = (c.req.param("id") || "");
  const user = await getSessionUser(c);
  const db = c.get("db");

  try {
    const isVerified = user && user.role !== "unverified";
    const isManagement = user && (user.role === "admin" || ["coach", "mentor"].includes(user.member_type || ""));

    const results = await db.selectFrom("event_signups as s")
      .innerJoin("user_profiles as p", "s.user_id", "p.user_id")
      .innerJoin("user as u", "s.user_id", "u.id")
      .select(["s.id", "s.user_id", "s.bringing", "s.notes", "s.attended", "s.prep_hours", "s.created_at", "p.nickname", "u.image as avatar"])
      .where("s.event_id", "=", eventId)
      .where("u.role", "!=", "unverified")
      .orderBy("s.created_at", "asc")
      .execute();

    const signups = isVerified ? (results || []).map((rec: Record<string, unknown>) => {
      const isOwn = user ? rec.user_id === user.id : false;
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
      const profiles = await db.selectFrom("event_signups as s")
        .innerJoin("user_profiles as p", "s.user_id", "p.user_id")
        .innerJoin("user as u", "s.user_id", "u.id")
        .select("p.dietary_restrictions")
        .where("s.event_id", "=", eventId)
        .where("u.role", "!=", "unverified")
        .execute();

      for (const p of profiles) {
        try {
          const restrictions = JSON.parse(p.dietary_restrictions || "[]") as string[];
          for (const r of restrictions) {
            dietarySummary[r] = (dietarySummary[r] || 0) + 1;
          }
        } catch { /* ignore */ }
      }
      
      const allProfiles = await db.selectFrom("user_profiles as p")
        .innerJoin("user as u", "p.user_id", "u.id")
        .select("p.dietary_restrictions")
        .where("u.role", "!=", "unverified")
        .execute();

      for (const p of allProfiles) {
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
  } catch {
    return c.json({ error: "Failed to fetch signups" }, 500);
  }
});

signupsRouter.post("/:id/signups", turnstileMiddleware(), async (c: any) => {
  const user = await getSessionUser(c);
  if (!user || user.role === "unverified") return c.json({ error: "Forbidden" }, 403);
  const eventId = (c.req.param("id") || "");
  const db = c.get("db");

  try {
    const body = await c.req.json();
    const { bringing, notes, prep_hours } = body;
    await db.insertInto("event_signups")
      .values({
        id: crypto.randomUUID(),
        event_id: eventId,
        user_id: user.id,
        bringing: bringing || "",
        notes: notes || "",
        prep_hours: prep_hours || 0,
        created_at: new Date().toISOString()
      } as any)
      .onConflict((oc: any) => oc.columns(["event_id", "user_id"]).doUpdateSet({
        bringing: bringing || "",
        notes: notes || "",
        prep_hours: prep_hours || 0
      }))
      .execute();
    return c.json({ success: true });
  } catch {
    return c.json({ error: "Database error" }, 500);
  }
});

signupsRouter.delete("/:id/signups/me", async (c: any) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const eventId = (c.req.param("id") || "");
  const db = c.get("db");
  try {
    await db.deleteFrom("event_signups")
      .where("event_id", "=", eventId)
      .where("user_id", "=", user.id)
      .execute();
    return c.json({ success: true });
  } catch {
    return c.json({ error: "Database error" }, 500);
  }
});

signupsRouter.patch("/:id/signups/me/attendance", async (c: any) => {
  const eventId = (c.req.param("id") || "");
  const user = await getSessionUser(c);
  if (!user || user.role === "unverified") return c.json({ error: "Unauthorized" }, 401);
  const db = c.get("db");

  try {
    const body = await c.req.json();
    const attended = body.attended ? 1 : 0;
    
    await db.insertInto("event_signups")
      .values({ id: crypto.randomUUID(), event_id: eventId, user_id: user.id, attended } as any)
      .onConflict((oc: any) => oc.columns(["event_id", "user_id"]).doUpdateSet({ attended }))
      .execute();
    return c.json({ success: true });
  } catch {
    return c.json({ error: "Failed to update attendance" }, 500);
  }
});

signupsRouter.patch("/:id/signups/:userId/attendance", async (c: any) => {
  const eventId = (c.req.param("id") || "");
  const userId = (c.req.param("userId") || "");
  const user = await getSessionUser(c);
  const db = c.get("db");

  if (user?.role !== "admin" && !["coach", "mentor"].includes(user?.member_type || "")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json();
    const attended = body.attended ? 1 : 0;
    
    await db.insertInto("event_signups")
      .values({ id: crypto.randomUUID(), event_id: eventId, user_id: userId, attended } as any)
      .onConflict((oc: any) => oc.columns(["event_id", "user_id"]).doUpdateSet({ attended }))
      .execute();
    return c.json({ success: true });
  } catch {
    return c.json({ error: "Failed to update attendance" }, 500);
  }
});

export default signupsRouter;

