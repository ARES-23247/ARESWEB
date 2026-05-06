import { typedHandler } from "../utils/handler";
import { AppEnv, ensureAdmin } from "../middleware";
import { Kysely } from "kysely";
import { DB } from "../../../shared/schemas/database";
import { OpenAPIHono } from "@hono/zod-openapi";

import { getLogisticsSummaryRoute, exportLogisticsEmailsRoute } from "../../../shared/routes/logistics";
import { decrypt } from "../../utils/crypto";



export const logisticsRouter = new OpenAPIHono<AppEnv>();

logisticsRouter.use("/admin/*", ensureAdmin);

logisticsRouter.openapi(getLogisticsSummaryRoute, typedHandler<typeof getLogisticsSummaryRoute>(async (c) => {
  const db = c.get("db") as Kysely<DB>;

  try {
    const results = await db.selectFrom("user_profiles as p")
      .innerJoin("user as u", "p.user_id", "u.id")
      .select(["p.dietary_restrictions", "p.tshirt_size", "p.member_type", "u.name"])
      .where("u.role", "!=", "unverified")
      .execute();

    const summary: Record<string, number> = {};
    const tshirtSummary: Record<string, number> = {};
    const memberCounts: Record<string, number> = {};
    const totalMembers = results.length;

    for (const r of results) {
      const mt = r.member_type || "student";
      memberCounts[mt] = (memberCounts[mt] || 0) + 1;

      if (r.tshirt_size) {
        tshirtSummary[r.tshirt_size] = (tshirtSummary[r.tshirt_size] || 0) + 1;
      }

      if (r.dietary_restrictions) {
        const restrictions = r.dietary_restrictions.split(",").map(st => st.trim());
        for (const dr of restrictions) {
          if (dr) summary[dr] = (summary[dr] || 0) + 1;
        }
      }
    }

    return c.json({
      totalCount: totalMembers,
      memberCounts,
      dietary: summary,
      tshirts: tshirtSummary,
    }, 200);
  } catch {
    return c.json({ error: "Logistics fetch failed" }, 500);
  }
}));

logisticsRouter.openapi(exportLogisticsEmailsRoute, typedHandler<typeof exportLogisticsEmailsRoute>(async (c) => {
  const db = c.get("db") as Kysely<DB>;
  const secret = c.env.ENCRYPTION_SECRET;

  try {
    const results = await db.selectFrom("user as u")
      .leftJoin("user_profiles as p", "u.id", "p.user_id")
      .select([
        "u.name", 
        "u.email", 
        "u.role",
        "p.emergency_contact_name",
        "p.emergency_contact_phone"
      ])
      .where("u.role", "!=", "unverified")
      .execute();

    const users: Array<{ name: string; email: string; role: string; emergencyName: string; emergencyPhone: string }> = [];
    for (const r of results) {
      let email = String(r.email);
      let emergencyPhone = r.emergency_contact_phone;

      // Decrypt sensitive fields
      try {
        if (email.includes(":")) email = await decrypt(email, secret);
        if (emergencyPhone && emergencyPhone.includes(":")) {
          emergencyPhone = await decrypt(emergencyPhone, secret);
        }
      } catch { /* ignore fallback */ }
      
      if (email && email.includes("@")) {
        users.push({ 
          name: String(r.name), 
          email, 
          role: String(r.role),
          emergencyName: r.emergency_contact_name || "—",
          emergencyPhone: emergencyPhone || "—"
        });
      }
    }

    return c.json({ users }, 200);
  } catch {
    return c.json({ error: "Failed to export roster" }, 500);
  }
}));

export default logisticsRouter;

