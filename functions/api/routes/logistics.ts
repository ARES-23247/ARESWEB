import { Hono } from "hono";
import { createHonoEndpoints, initServer } from "ts-rest-hono";
import { logisticsContract } from "../../../src/schemas/contracts/logisticsContract";
import { AppEnv, ensureAdmin  } from "../middleware";
import { Kysely } from "kysely";
import { DB } from "../../../src/schemas/database";

const s = initServer<AppEnv>();
const logisticsRouter = new Hono<AppEnv>();

// @ts-expect-error - ts-rest-hono inference quirk with complex AppEnv
const logisticsTsRestRouter = s.router(logisticsContract, {
  getSummary: async (_: any, c: any) => {
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
        status: 200,
        body: {
          totalCount: totalMembers,
          memberCounts,
          dietary: summary,
          tshirts: tshirtSummary,
        }
      };
    } catch (_err) {
      return { status: 500, body: { error: "Logistics fetch failed" } };
    }
  },
});

logisticsRouter.use("/admin/*", ensureAdmin);
createHonoEndpoints(logisticsContract, logisticsTsRestRouter, logisticsRouter);

export default logisticsRouter;
