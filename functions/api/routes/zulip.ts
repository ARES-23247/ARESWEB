import { Hono } from "hono";
import { AppEnv, ensureAdmin, getSocialConfig } from "../middleware";
import { initServer, createHonoEndpoints } from "ts-rest-hono";
import { zulipContract } from "../../../src/schemas/contracts/zulipContract";

const s = initServer<AppEnv>();
const zulipRouter = new Hono<AppEnv>();

// @ts-expect-error - ts-rest-hono inference quirk with complex AppEnv
const zulipTsRestRouter = s.router(zulipContract, {
  getPresence: async (_: any, c: any) => {
    try {
      const config = await getSocialConfig(c);
      if (!config.ZULIP_BOT_EMAIL || !config.ZULIP_API_KEY) {
        return { status: 500, body: { success: false, error: "Zulip not configured." } };
      }
      
      const authHeader = "Basic " + btoa(`${config.ZULIP_BOT_EMAIL}:${config.ZULIP_API_KEY}`);
      const url = `${config.ZULIP_URL || "https://ares.zulipchat.com"}/api/v1/realm/presence`;

      const res = await fetch(url, {
        method: "GET",
        headers: { "Authorization": authHeader }
      });

      if (!res.ok) {
        return { status: 500, body: { success: false, error: await res.text() } };
      }

      const data = await res.json() as { result: string; presences: any };
      return { status: 200, body: { success: true, presence: data.presences } };
    } catch (err) {
      return { status: 500, body: { success: false, error: (err as Error).message } };
    }
  },
});

zulipRouter.use("/presence", ensureAdmin);
createHonoEndpoints(zulipContract, zulipTsRestRouter, zulipRouter);
export default zulipRouter;
