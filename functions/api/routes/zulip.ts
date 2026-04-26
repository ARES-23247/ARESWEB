import { Hono } from "hono";
import { AppEnv, ensureAdmin, getSocialConfig } from "../middleware";
import { initServer, createHonoEndpoints } from "ts-rest-hono";
import { zulipContract } from "../../../shared/schemas/contracts/zulipContract";

const s = initServer<AppEnv>();
export const zulipRouter = new Hono<AppEnv>();

import { Context } from "hono";

import { z } from "zod";
import { zulipPresenceSchema } from "../../../shared/schemas/contracts/zulipContract";

const zulipHandlers = {
  getPresence: async (_: any, c: Context<AppEnv>) => {
    try {
      const config = await getSocialConfig(c);
      if (!config.ZULIP_BOT_EMAIL || !config.ZULIP_API_KEY) {
        return { status: 500 as const, body: { success: false, error: "Zulip not configured." } as any };
      }
      
      // Unicode-safe Base64 encoding to prevent "btoa() can only operate on characters in the Latin1 range" errors
      // if credentials contain hidden unicode characters or non-breaking spaces.
      const credentials = `${config.ZULIP_BOT_EMAIL}:${config.ZULIP_API_KEY}`;
      const authHeader = "Basic " + btoa(unescape(encodeURIComponent(credentials)));
      const url = `${config.ZULIP_URL || "https://ares.zulipchat.com"}/api/v1/realm/presence`;

      const res = await fetch(url, {
        method: "GET",
        headers: { "Authorization": authHeader }
      });

      if (!res.ok) {
        return { status: 500 as const, body: { success: false, error: await res.text() } as any };
      }

      const usersRes = await fetch(`${config.ZULIP_URL || "https://ares.zulipchat.com"}/api/v1/users`, {
        method: "GET",
        headers: { "Authorization": authHeader }
      });

      let userNames: Record<string, string> = {};
      if (usersRes.ok) {
        const usersData = await usersRes.json() as { members: Array<{ email: string; full_name: string }> };
        if (usersData.members) {
          userNames = usersData.members.reduce((acc, user) => {
            acc[user.email] = user.full_name;
            return acc;
          }, {} as Record<string, string>);
        }
      }

      const data = await res.json() as { result: string; presences: z.infer<typeof zulipPresenceSchema> };
      return { status: 200 as const, body: { success: true, presence: data.presences, userNames } as any };
    } catch (err) {
      return { status: 500 as const, body: { success: false, error: (err as Error).message } as any };
    }
  },
  sendMessage: async ({ body }: any, c: Context<AppEnv>) => {
    try {
      const { sendZulipMessage } = await import("../../utils/zulipSync");
      const config = await getSocialConfig(c);
      
      if (!config.ZULIP_BOT_EMAIL || !config.ZULIP_API_KEY) {
        return { status: 500 as const, body: { success: false, error: "Zulip not configured." } as any };
      }

      const res = await sendZulipMessage(
        { ZULIP_EMAIL: config.ZULIP_BOT_EMAIL, ZULIP_API_KEY: config.ZULIP_API_KEY, ZULIP_URL: config.ZULIP_URL },
        body.stream,
        body.topic,
        body.content
      );

      if (!res) {
        return { status: 500 as const, body: { success: false, error: "Failed to send message" } as any };
      }

      return { status: 200 as const, body: { success: true } as any };
    } catch (err) {
      return { status: 500 as const, body: { success: false, error: (err as Error).message } as any };
    }
  },
};

const zulipTsRestRouter = s.router(zulipContract, zulipHandlers as any);

zulipRouter.use("/presence", ensureAdmin);
createHonoEndpoints(zulipContract, zulipTsRestRouter, zulipRouter);
export default zulipRouter;
