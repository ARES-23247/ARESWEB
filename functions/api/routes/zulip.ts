import { Hono } from "hono";
import { AppEnv, ensureAdmin, getSocialConfig } from "../middleware";
import { initServer, createHonoEndpoints } from "ts-rest-hono";
import { zulipContract } from "../../../src/schemas/contracts/zulipContract";

const s = initServer<AppEnv>();
export const zulipRouter = new Hono<AppEnv>();

import { Context } from "hono";

import { z } from "zod";
import { zulipPresenceSchema } from "../../../src/schemas/contracts/zulipContract";

const zulipHandlers = {
  getPresence: async (_: any, c: Context<AppEnv>) => {
    try {
      const config = await getSocialConfig(c);
      if (!config.ZULIP_BOT_EMAIL || !config.ZULIP_API_KEY) {
        return { status: 500 as const, body: { success: false, error: "Zulip not configured." } as any };
      }
      
      const authHeader = "Basic " + btoa(`${config.ZULIP_BOT_EMAIL}:${config.ZULIP_API_KEY}`);
      const url = `${config.ZULIP_URL || "https://ares.zulipchat.com"}/api/v1/realm/presence`;

      const res = await fetch(url, {
        method: "GET",
        headers: { "Authorization": authHeader }
      });

      if (!res.ok) {
        return { status: 500 as const, body: { success: false, error: await res.text() } as any };
      }

      const data = await res.json() as { result: string; presences: z.infer<typeof zulipPresenceSchema> };
      return { status: 200 as const, body: { success: true, presence: data.presences } as any };
    } catch (err) {
      return { status: 500 as const, body: { success: false, error: (err as Error).message } as any };
    }
  },
};

const zulipTsRestRouter = s.router(zulipContract, zulipHandlers as any);

zulipRouter.use("/presence", ensureAdmin);
createHonoEndpoints(zulipContract, zulipTsRestRouter, zulipRouter);
export default zulipRouter;
