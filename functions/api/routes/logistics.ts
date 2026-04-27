import { AppEnv, ensureAdmin } from "../middleware";
import { Kysely } from "kysely";
import { DB } from "../../../shared/schemas/database";
import { Hono, Context } from "hono";
import { createHonoEndpoints, initServer } from "ts-rest-hono";
import { logisticsContract } from "../../../shared/schemas/contracts/logisticsContract";
import { decrypt } from "../../utils/crypto";
const s = initServer<AppEnv>();
const logisticsRouter = new Hono<AppEnv>();

const logisticsHandlers = {
  getSummary: async (_: any, c: Context<AppEnv>) => {
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
        } as any
      };
    } catch {
      return { status: 500 as const, body: { error: "Logistics fetch failed" } as any };
    }
  },
  exportEmails: async (_: any, c: Context<AppEnv>) => {
    const db = c.get("db") as Kysely<DB>;
    const secret = c.env.ENCRYPTION_SECRET;

    try {
      const results = await db.selectFrom("user")
        .select(["email"])
        .where("role", "!=", "unverified")
        .execute();

      const emails: string[] = [];
      for (const r of results) {
        let email = String(r.email);
        try {
          if (email.includes(":")) {
            email = await decrypt(email, secret);
          }
        } catch { /* ignore fallback to plaintext */ }
        
        if (email && email.includes("@")) {
          emails.push(email);
        }
      }

      return {
        status: 200 as const,
        body: { emails }
      };
    } catch (e) {
      console.error("EXPORT_EMAILS ERROR", e);
      return { status: 500 as const, body: { error: "Failed to export emails" } as any };
    }
  },
};

const logisticsTsRestRouter = s.router(logisticsContract, logisticsHandlers as any);

logisticsRouter.use("/admin/*", ensureAdmin);
createHonoEndpoints(logisticsContract, logisticsTsRestRouter, logisticsRouter);

export default logisticsRouter;
