import { Hono, Context } from "hono";
import { createHonoEndpoints, initServer } from "ts-rest-hono";
import { logisticsContract } from "../../../src/schemas/contracts/logisticsContract";
import { AppEnv, ensureAdmin  } from "../middleware";

const s = initServer<AppEnv>();
const logisticsRouter = new Hono<AppEnv>();

const logisticsTsRestRouter = s.router(logisticsContract, {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getSummary: async (_: any, c: Context<AppEnv>) => {
    const db = c.get("db");

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

        try {
          const restrictions = JSON.parse(r.dietary_restrictions || "[]") as string[];
          for (const dr of restrictions) {
            summary[dr] = (summary[dr] || 0) + 1;
          }
        } catch { /* ignore */ }
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
    } catch (err) {
      console.error("D1 logistics summary error:", err);
      return { status: 500 as const, body: { error: "Logistics fetch failed" } };
    }
  },
});

// Hardening: Enforce ensureAdmin for all routes
logisticsRouter.use("/admin", ensureAdmin);
logisticsRouter.use("/admin/*", ensureAdmin);

createHonoEndpoints(logisticsContract, logisticsTsRestRouter, logisticsRouter);

export default logisticsRouter;

