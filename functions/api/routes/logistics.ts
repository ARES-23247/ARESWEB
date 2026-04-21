import { Hono } from "hono";
import { AppEnv, getSessionUser  } from "./_shared";

const logisticsRouter = new Hono<AppEnv>();

// ── GET /summary — aggregated logistics for event planning ──
logisticsRouter.get("/summary", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  // Only admin/parent/coach/mentor can see logistics
  // Note: member_type is stored in user_profiles, which we fetch for the session in _shared.ts
  const isManagement = user.role === "admin" || ["parent", "coach", "mentor"].includes(user.member_type || "");
  if (!isManagement) return c.json({ error: "Forbidden" }, 403);

  try {
    const { results } = await c.env.DB.prepare(
      `SELECT p.dietary_restrictions, p.tshirt_size, p.member_type, u.name
       FROM user_profiles p
       JOIN user u ON p.user_id = u.id
       WHERE u.role NOT IN ('unverified')`
    ).all();

    const summary: Record<string, number> = {};
    const tshirtSummary: Record<string, number> = {};
    const memberCounts: Record<string, number> = {};
    const totalMembers = results.length;

    for (const r of results as { dietary_restrictions?: string; tshirt_size?: string; member_type?: string; name?: string }[]) {
      const mt = r.member_type || "student";
      memberCounts[mt] = (memberCounts[mt] || 0) + 1;

      if (r.tshirt_size) {
        tshirtSummary[r.tshirt_size] = (tshirtSummary[r.tshirt_size] || 0) + 1;
      }

      try {
        const restrictions = JSON.parse(r.dietary_restrictions || "[]") as string[];
        for (const dr of restrictions) {
          summary[dr] = (summary[dr] || 0) + 1;
        }
      } catch { /* ignore */ }
    }

    return c.json({
      totalCount: totalMembers,
      memberCounts,
      dietary: summary,
      tshirts: tshirtSummary,
    });
  } catch (err) {
    console.error("D1 logistics summary error:", err);
    return c.json({ error: "Logistics fetch failed" }, 500);
  }
});

export default logisticsRouter;
