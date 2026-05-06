import { OpenAPIHono } from "@hono/zod-openapi";
import type { RouteConfig, RouteHandler } from "@hono/zod-openapi";
import { Kysely } from "kysely";
import { DB } from "../../../shared/schemas/database";
import { AppEnv, ensureAuth, logAuditAction } from "../middleware";
import { getEntityLinksRoute, saveEntityLinkRoute, deleteEntityLinkRoute } from "../../../shared/routes/entities";

type AppRouteHandler<T extends RouteConfig> = RouteHandler<T, AppEnv>;

export const entitiesRouter = new OpenAPIHono<AppEnv>();

entitiesRouter.use("*", ensureAuth);

entitiesRouter.openapi(getEntityLinksRoute, (async (c) => {
  try {
    const db = c.get("db") as Kysely<DB>;
    const { type, id } = c.req.valid("query");

    const rawLinks = await db.selectFrom("entity_links")
      .select(["id", "source_type", "source_id", "target_type", "target_id", "link_type"])
      .where((eb) => eb.or([
        eb.and([eb("source_type", "=", type), eb("source_id", "=", id)]),
        eb.and([eb("target_type", "=", type), eb("target_id", "=", id)])
      ]))
      .execute();

    // Collect target IDs by type to resolve titles in bulk (Eliminate N+1)
    const targetMap = new Map<string, Set<string>>();
    const links = rawLinks.map(link => {
      const isSource = link.source_type === type && link.source_id === id;
      const targetType = isSource ? link.target_type : link.source_type;
      const targetId = isSource ? link.target_id : link.source_id;
      
      if (!targetMap.has(targetType)) targetMap.set(targetType, new Set());
      targetMap.get(targetType)!.add(targetId);
      
      return { ...link, resolvedTargetType: targetType, resolvedTargetId: targetId };
    });

    const titleCache = new Map<string, string | null>();
    
    // Bulk resolve titles for each type
    for (const [tType, tIds] of targetMap.entries()) {
      const ids = Array.from(tIds);
      if (tType === 'doc') {
        const res = await db.selectFrom("docs").select(["slug", "title"]).where("slug", "in", ids).execute();
        for (const r of res) titleCache.set(`doc:${r.slug}`, r.title);
      } else if (tType === 'task') {
        const res = await db.selectFrom("tasks").select(["id", "title"]).where("id", "in", ids).execute();
        for (const r of res) if (r.id) titleCache.set(`task:${r.id}`, r.title);
      } else if (tType === 'post') {
        const res = await db.selectFrom("posts").select(["slug", "title"]).where("slug", "in", ids).execute();
        for (const r of res) if (r.slug) titleCache.set(`post:${r.slug}`, r.title);
      } else if (tType === 'outreach') {
        const res = await db.selectFrom("outreach_logs").select(["id", "title"]).where("id", "in", ids.map(Number) ).execute();
        for (const r of res) if (r.id) titleCache.set(`outreach:${r.id}`, r.title);
      } else if (tType === 'event') {
        const res = await db.selectFrom("events").select(["id", "title"]).where("id", "in", ids).execute();
        for (const r of res) if (r.id) titleCache.set(`event:${r.id}`, r.title);
      }
    }

    const enrichedLinks = links.map(link => ({
      id: link.id!,
      target_type: link.resolvedTargetType,
      target_id: link.resolvedTargetId,
      target_title: titleCache.get(`${link.resolvedTargetType}:${link.resolvedTargetId}`) || null,
      link_type: link.link_type || 'reference'
    }));

    return c.json({ links: enrichedLinks }, 200);
  } catch (e) {
    console.error("GET_LINKS ERROR", e);
    return c.json({ error: "Failed to fetch links", code: "INTERNAL_SERVER_ERROR" }, 500);
  }
}) as AppRouteHandler<typeof getEntityLinksRoute>);

entitiesRouter.openapi(saveEntityLinkRoute, (async (c) => {
  try {
    const db = c.get("db") as Kysely<DB>;
    const body = c.req.valid("json");
    const id = crypto.randomUUID();

    await db.insertInto("entity_links")
      .values({
        id,
        source_type: body.source_type,
        source_id: body.source_id,
        target_type: body.target_type,
        target_id: body.target_id,
        link_type: body.link_type
      })
      .execute();

    c.executionCtx.waitUntil(logAuditAction(c, "create_link", "entity_links", id, `Linked ${body.source_type}:${body.source_id} to ${body.target_type}:${body.target_id}`));
    return c.json({ success: true, id }, 200);
  } catch (e) {
    console.error("SAVE_LINK ERROR", e);
    return c.json({ error: "Failed to create link", code: "INTERNAL_SERVER_ERROR" }, 500);
  }
}) as AppRouteHandler<typeof saveEntityLinkRoute>);

entitiesRouter.openapi(deleteEntityLinkRoute, (async (c) => {
  try {
    const db = c.get("db") as Kysely<DB>;
    const { id } = c.req.valid("param");
    await db.deleteFrom("entity_links").where("id", "=", id).execute();
    c.executionCtx.waitUntil(logAuditAction(c, "delete_link", "entity_links", id));
    return c.json({ success: true }, 200);
  } catch (_e) {
    return c.json({ error: "Failed to delete link", code: "INTERNAL_SERVER_ERROR" }, 500);
  }
}) as AppRouteHandler<typeof deleteEntityLinkRoute>);

export default entitiesRouter;

