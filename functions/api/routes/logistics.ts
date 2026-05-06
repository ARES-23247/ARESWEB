/* eslint-disable @typescript-eslint/no-explicit-any -- ts-rest handler input validated by contract library */
import { AppEnv, ensureAdmin, s } from "../middleware";
import { Kysely } from "kysely";
import { DB } from "../../../shared/schemas/database";
import { Hono } from "hono";
import { createHonoEndpoints } from "ts-rest-hono";
import { logisticsContract } from "../../../shared/schemas/contracts/logisticsContract";
import { decrypt } from "../../utils/crypto";

import type { HonoContext } from "@shared/types/api";

const logisticsRouter = new Hono<AppEnv>();

import { ServerInferRequest } from "../../../shared/types/api";

const logisticsHandlers = {
  getSummary: async (_input: ServerInferRequest<typeof logisticsContract["getSummary"]>, c: HonoContext) => {
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

      return {
        status: 200 as const,
        body: {
          totalCount: totalMembers,
          memberCounts,
          dietary: summary,
          tshirts: tshirtSummary,
        }
      };
    } catch {
      return { status: 500 as const, body: { error: "Logistics fetch failed" } };
    }
  },
  exportEmails: async (_input: ServerInferRequest<typeof logisticsContract["exportEmails"]>, c: HonoContext) => {
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

      return {
        status: 200 as const,
        body: { users }
      };
    } catch {
      return { status: 500 as const, body: { error: "Failed to export roster" } };
    }
  },
};
const logisticsTsRestRouter = s.router(logisticsContract, logisticsHandlers as any);

logisticsRouter.use("/admin/*", ensureAdmin);
createHonoEndpoints(
  logisticsContract,
  logisticsTsRestRouter,
  logisticsRouter,
  {
    responseValidation: true,
    responseValidationErrorHandler: (err, _c) => {
      console.error('[Contract] Response validation failed:', err.cause);
      return { error: { message: 'Internal server error' }, status: 500 };
    }
  }
);

export default logisticsRouter;

