import { typedHandler } from "../utils/handler";
import { ApiError } from "../middleware/errorHandler";

import { OpenAPIHono } from "@hono/zod-openapi";

import { AppEnv, ensureAdmin, ensureAuth, getSocialConfig, getDb } from "../middleware";
import {
  getPresenceRoute,
  sendMessageRoute,
  getTopicMessagesRoute,
  auditMissingUsersRoute,
  inviteUsersRoute,
  zulipPresenceSchema,
} from "../../../shared/routes/zulip";
import { z } from "zod";
import { ne } from "drizzle-orm";
import * as schema from "../../../src/db/schema";



export const zulipRouter = new OpenAPIHono<AppEnv>();

// Normalize emails by removing dots for Google Workspace / Gmail domains
// Gmail ignores dots in the local part, so these are the same address
function normalizeEmail(email: string): string {
  const cleanEmail = email.trim().toLowerCase();
  const isGoogleBacked =
    cleanEmail.endsWith("@gmail.com") ||
    cleanEmail.endsWith("@googlemail.com") ||
    cleanEmail.endsWith("@aresfirst.org");

  if (!isGoogleBacked) {
    return cleanEmail;
  }
  const [local, domain] = cleanEmail.split("@");
  return `${local.replace(/\./g, "")}@${domain}`;
}

// CR-07 FIX: Apply authentication to all Zulip routes
// Admin-only routes override the base authentication
zulipRouter.use("*", ensureAuth);
zulipRouter.use("/presence", ensureAdmin);
zulipRouter.use("/invites/*", ensureAdmin);

zulipRouter.openapi(getPresenceRoute, typedHandler<typeof getPresenceRoute>(async (c) => {
    const config = await getSocialConfig(c);
    if (!config.ZULIP_BOT_EMAIL || !config.ZULIP_API_KEY) {
      throw new ApiError("Zulip not configured.", 500);
    }

    const credentials = `${config.ZULIP_BOT_EMAIL}:${config.ZULIP_API_KEY}`;
    const authHeader = "Basic " + btoa(unescape(encodeURIComponent(credentials)));
    const url = `${config.ZULIP_URL || "https://aresfirst.zulipchat.com"}/api/v1/realm/presence`;

    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: authHeader },
    });

    if (!res.ok) {
      return c.json({ success: false, error: await res.text() }, 500);
    }

    const usersRes = await fetch(
      `${config.ZULIP_URL || "https://aresfirst.zulipchat.com"}/api/v1/users`,
      {
        method: "GET",
        headers: { Authorization: authHeader },
      }
    );

    let userNames: Record<string, string> = {};
    if (usersRes.ok) {
      const usersData = (await usersRes.json()) as {
        members: Array<{ email: string; full_name: string }>;
      };
      if (usersData.members) {
        userNames = usersData.members.reduce((acc: Record<string, string>, user: { email: string; full_name: string }) => {
          acc[user.email] = user.full_name;
          return acc;
        }, {} as Record<string, string>);
      }
    }

    const data = (await res.json()) as {
      result: string;
      presences: z.infer<typeof zulipPresenceSchema>;
    };
    return c.json({ success: true, presence: data.presences, userNames }, 200);
}));

zulipRouter.openapi(sendMessageRoute, typedHandler<typeof sendMessageRoute>(async (c) => {
    const body = c.req.valid("json");
    const { sendZulipMessage } = await import("../../utils/zulipSync");
    const config = await getSocialConfig(c);

    if (!config.ZULIP_BOT_EMAIL || !config.ZULIP_API_KEY) {
      throw new ApiError("Zulip not configured.", 500);
    }

    const sessionUser = c.get("sessionUser") as
      | { nickname?: string; name?: string; email?: string }
      | undefined;
    const senderName = sessionUser?.nickname || sessionUser?.name || "ARES Member";
    const attributedContent = `**${senderName}** (via ARES Web):\n\n${body.content}`;

    const res = await sendZulipMessage(
      {
        ZULIP_EMAIL: config.ZULIP_BOT_EMAIL,
        ZULIP_API_KEY: config.ZULIP_API_KEY,
        ZULIP_URL: config.ZULIP_URL,
      },
      body.stream,
      body.topic,
      attributedContent,
      "stream"
    );

    if (!res) {
      throw new ApiError("Failed to send message", 500);
    }

    return c.json({ success: true }, 200);
}));

zulipRouter.openapi(getTopicMessagesRoute, typedHandler<typeof getTopicMessagesRoute>(async (c) => {
    const query = c.req.valid("query");
    const config = await getSocialConfig(c);
    if (!config.ZULIP_BOT_EMAIL || !config.ZULIP_API_KEY) {
      throw new ApiError("Zulip not configured.", 500);
    }

    const credentials = `${config.ZULIP_BOT_EMAIL}:${config.ZULIP_API_KEY}`;
    const authHeader = "Basic " + btoa(unescape(encodeURIComponent(credentials)));
    const url = new URL(
      `${config.ZULIP_URL || "https://aresfirst.zulipchat.com"}/api/v1/messages`
    );

    const narrow = [
      { operator: "stream", operand: query.stream },
      { operator: "topic", operand: query.topic },
    ];

    url.searchParams.append("narrow", JSON.stringify(narrow));
    url.searchParams.append("anchor", "newest");
    url.searchParams.append("num_before", "100");
    url.searchParams.append("num_after", "0");

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { Authorization: authHeader },
    });

    if (!res.ok) {
      if (res.status === 403) {
        return c.json(
          {
            success: false,
            error: "Zulip bot is not subscribed to this stream.",
          },
          403
        );
      }
      return c.json({ success: false, error: await res.text() }, 500);
    }

    const data = (await res.json()) as {
      result: string;
      messages: unknown[];
    };
    return c.json({ success: true, messages: data.messages }, 200);
}));

zulipRouter.openapi(auditMissingUsersRoute, typedHandler<typeof auditMissingUsersRoute>(async (c) => {
    const config = await getSocialConfig(c);
    if (!config.ZULIP_BOT_EMAIL || !config.ZULIP_API_KEY) {
      return c.json(
        {
          success: false,
          error: "Zulip not configured. Set ZULIP_BOT_EMAIL and ZULIP_API_KEY in settings.",
        },
        500
      );
    }

    const credentials = `${config.ZULIP_BOT_EMAIL}:${config.ZULIP_API_KEY}`;
    const authHeader = "Basic " + btoa(unescape(encodeURIComponent(credentials)));
    const baseUrl = config.ZULIP_URL || "https://aresfirst.zulipchat.com";

    const zulipEmails = new Set<string>();
    let page = 1;
    const maxPages = 10;
    let hasMore = true;

    while (hasMore && page <= maxPages) {
      const url = new URL(`${baseUrl}/api/v1/users`);
      url.searchParams.append("client_gravatar", "false");
      url.searchParams.append("page", String(page));

      const zulipRes = await fetch(url.toString(), {
        method: "GET",
        headers: { Authorization: authHeader },
      });

      if (!zulipRes.ok) {
        const errText = (await zulipRes.text().catch(() => "(no body)"));
        return c.json(
          {
            success: false,
            error: `Zulip API returned ${zulipRes.status}: ${errText.slice(0, 200)}`,
          },
          500
        );
      }

      const zulipData = (await zulipRes.json()) as {
        members: Array<{
          email: string;
          delivery_email?: string | null;
          is_bot?: boolean;
          is_active?: boolean;
        }>;
      };

      if (!zulipData.members || !Array.isArray(zulipData.members)) {
        return c.json(
          {
            success: false,
            error: "Zulip returned invalid data — no members array",
          },
          500
        );
      }

      for (const m of zulipData.members) {
        if (m.is_active !== false && !m.is_bot) {
          const email = normalizeEmail(m.delivery_email || m.email || "");
          zulipEmails.add(email);
        }
      }
      if (zulipData.members.length === 0) {
        hasMore = false;
      } else {
        page++;
      }
    }

    const db = getDb(c);
    const aresUsers = await db
      .select({ email: schema.user.email })
      .from(schema.user)
      .where(ne(schema.user.role, "unverified"))
      .all();

    const missingEmails = aresUsers
      .map((u: { email: string | null }) => u.email)
      .filter((email): email is string => {
        if (!email) return false;
        const normalized = normalizeEmail(email);
        return !zulipEmails.has(normalized);
      });

    const sampleZulip = Array.from(zulipEmails).slice(0, 10);
    const sampleMissing = missingEmails.slice(0, 10);

    return c.json(
      {
        success: true,
        missingEmails,
        debug: {
          totalZulipUsers: zulipEmails.size,
          totalAresUsers: aresUsers.length,
          sampleZulipEmails: sampleZulip,
          sampleMissingEmails: sampleMissing,
        },
      },
      200
    );
}));

zulipRouter.openapi(inviteUsersRoute, typedHandler<typeof inviteUsersRoute>(async (c) => {
    const body = c.req.valid("json");
    const config = await getSocialConfig(c);
    if (!config.ZULIP_BOT_EMAIL || !config.ZULIP_API_KEY) {
      throw new ApiError("Zulip not configured.", 500);
    }

    const { emails } = body;
    if (!emails || emails.length === 0) {
      return c.json({ success: true, invitedCount: 0 }, 200);
    }

    const credentials = `${config.ZULIP_BOT_EMAIL}:${config.ZULIP_API_KEY}`;
    const authHeader = "Basic " + btoa(unescape(encodeURIComponent(credentials)));
    const baseUrl = config.ZULIP_URL || "https://aresfirst.zulipchat.com";

    const streamsRes = await fetch(`${baseUrl}/api/v1/default_streams`, {
      method: "GET",
      headers: { Authorization: authHeader },
    });

    let streamIds: number[] = [];
    if (streamsRes.ok) {
      const streamsData = (await streamsRes.json()) as {
        default_streams?: Array<{ stream_id: number }>;
      };
      streamIds = (streamsData.default_streams || []).map((s: { stream_id: number }) => s.stream_id);
    }

    const BATCH_SIZE = 10;
    let totalInvited = 0;
    const allErrors: string[] = [];

    for (let i = 0; i < emails.length; i += BATCH_SIZE) {
      const batch = emails.slice(i, i + BATCH_SIZE);
      const params = new URLSearchParams();
      params.append("invitee_emails", batch.join(","));
      params.append("stream_ids", JSON.stringify(streamIds));
      params.append("include_realm_default_subscriptions", "true");
      params.append("invite_as", "400");

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const inviteRes = await fetch(`${baseUrl}/api/v1/invites`, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const resText = await inviteRes.text();

        if (inviteRes.ok) {
          totalInvited += batch.length;
        } else {
          try {
            const errJson = JSON.parse(resText);
            if (errJson.sent_invitations === true) {
              totalInvited += batch.length;
            } else {
              allErrors.push(errJson.msg || resText.slice(0, 200));
            }
          } catch {
            allErrors.push(`HTTP ${inviteRes.status}: ${resText.slice(0, 200)}`);
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        allErrors.push(msg);
      }
    }

    if (allErrors.length > 0 && totalInvited === 0) {
      return c.json({ success: false, error: allErrors.join("; ") }, 500);
    }

    return c.json({ success: true, invitedCount: totalInvited }, 200);
}));

export default zulipRouter;
