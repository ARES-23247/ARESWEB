import { typedHandler } from "../utils/handler";
import { AppEnv, ensureAdmin, getDb } from "../middleware";
import { eq, ne } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import { OpenAPIHono } from "@hono/zod-openapi";

import { getLogisticsSummaryRoute, exportLogisticsEmailsRoute } from "../../../shared/routes/logistics";
import { decrypt } from "../../utils/crypto";



export const logisticsRouter = new OpenAPIHono<AppEnv>();

logisticsRouter.use("/admin/*", ensureAdmin);

logisticsRouter.openapi(getLogisticsSummaryRoute, typedHandler<typeof getLogisticsSummaryRoute>(async (c) => {
  const db = getDb(c);

    const results = await db.select({
      dietary_restrictions: schema.userProfiles.dietaryRestrictions,
      tshirt_size: schema.userProfiles.tshirtSize,
      member_type: schema.userProfiles.memberType,
      name: schema.user.name
    })
    .from(schema.userProfiles)
    .innerJoin(schema.user, eq(schema.userProfiles.userId, schema.user.id))
    .where(ne(schema.user.role, "unverified"))
    .all();

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
        const restrictions = r.dietary_restrictions.split(",").map((st: string) => st.trim());
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
}));

logisticsRouter.openapi(exportLogisticsEmailsRoute, typedHandler<typeof exportLogisticsEmailsRoute>(async (c) => {
  const db = getDb(c);
  const secret = c.env.ENCRYPTION_SECRET;

    const results = await db.select({
      name: schema.user.name,
      email: schema.user.email,
      role: schema.user.role,
      emergency_contact_name: schema.userProfiles.emergencyContactName,
      emergency_contact_phone: schema.userProfiles.emergencyContactPhone
    })
    .from(schema.user)
    .leftJoin(schema.userProfiles, eq(schema.user.id, schema.userProfiles.userId))
    .where(ne(schema.user.role, "unverified"))
    .all();

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
}));

export default logisticsRouter;

