import { typedHandler } from "../utils/handler";
import { OpenAPIHono } from "@hono/zod-openapi";

import { eq, and, inArray, or } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import { AppEnv, ensureAuth, logAuditAction, getDb } from "../middleware";
import { getEntityLinksRoute, saveEntityLinkRoute, deleteEntityLinkRoute } from "../../../shared/routes/entities";



export const entitiesRouter = new OpenAPIHono<AppEnv>();

entitiesRouter.use("*", ensureAuth);

entitiesRouter.openapi(getEntityLinksRoute, typedHandler<typeof getEntityLinksRoute>(async (c) => {
  try {
    const db = getDb(c);
    const { type, id } = c.req.valid("query");

    const rawLinks = await db.select({
      id: schema.entityLinks.id,
      source_type: schema.entityLinks.sourceType,
      source_id: schema.entityLinks.sourceId,
      target_type: schema.entityLinks.targetType,
      target_id: schema.entityLinks.targetId,
      link_type: schema.entityLinks.linkType
    })
      .from(schema.entityLinks)
      .where(or(
        and(eq(schema.entityLinks.sourceType, type), eq(schema.entityLinks.sourceId, id)),
        and(eq(schema.entityLinks.targetType, type), eq(schema.entityLinks.targetId, id))
      ))
      .execute();

    // Collect target IDs by type to resolve titles in bulk (Eliminate N+1)
    const targetMap = new Map<string, Set<string>>();
    const links = rawLinks.map((link) => {
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
        const res = await db.select({ slug: schema.docs.slug, title: schema.docs.title }).from(schema.docs).where(inArray(schema.docs.slug, ids)).execute();
        for (const r of res) titleCache.set(`doc:${r.slug}`, r.title);
      } else if (tType === 'task') {
        const res = await db.select({ id: schema.tasks.id, title: schema.tasks.title }).from(schema.tasks).where(inArray(schema.tasks.id, ids)).execute();
        for (const r of res) if (r.id) titleCache.set(`task:${r.id}`, r.title);
      } else if (tType === 'post') {
        const res = await db.select({ slug: schema.posts.slug, title: schema.posts.title }).from(schema.posts).where(inArray(schema.posts.slug, ids)).execute();
        for (const r of res) if (r.slug) titleCache.set(`post:${r.slug}`, r.title);
      } else if (tType === 'outreach') {
        const res = await db.select({ id: schema.outreachLogs.id, title: schema.outreachLogs.title }).from(schema.outreachLogs).where(inArray(schema.outreachLogs.id, ids.map(Number))).execute();
        for (const r of res) if (r.id) titleCache.set(`outreach:${r.id}`, r.title);
      } else if (tType === 'event') {
        const res = await db.select({ id: schema.events.id, title: schema.events.title }).from(schema.events).where(inArray(schema.events.id, ids)).execute();
        for (const r of res) if (r.id) titleCache.set(`event:${r.id}`, r.title);
      }
    }

    const enrichedLinks = links.map((link) => ({
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
}));

entitiesRouter.openapi(saveEntityLinkRoute, typedHandler<typeof saveEntityLinkRoute>(async (c) => {
  try {
    const db = getDb(c);
    const body = c.req.valid("json");
    const id = crypto.randomUUID();

    await db.insert(schema.entityLinks)
      .values({
        id,
        sourceType: body.source_type,
        sourceId: body.source_id,
        targetType: body.target_type,
        targetId: body.target_id,
        linkType: body.link_type
      })
      .execute();

    c.executionCtx.waitUntil(logAuditAction(c, "create_link", "entity_links", id, `Linked ${body.source_type}:${body.source_id} to ${body.target_type}:${body.target_id}`));
    return c.json({ success: true, id }, 200);
  } catch (e) {
    console.error("SAVE_LINK ERROR", e);
    return c.json({ error: "Failed to create link", code: "INTERNAL_SERVER_ERROR" }, 500);
  }
}));

entitiesRouter.openapi(deleteEntityLinkRoute, typedHandler<typeof deleteEntityLinkRoute>(async (c) => {
  try {
    const db = getDb(c);
    const { id } = c.req.valid("param");
    await db.delete(schema.entityLinks).where(eq(schema.entityLinks.id, id)).execute();
    c.executionCtx.waitUntil(logAuditAction(c, "delete_link", "entity_links", id));
    return c.json({ success: true }, 200);
  } catch (_e) {
    return c.json({ error: "Failed to delete link", code: "INTERNAL_SERVER_ERROR" }, 500);
  }
}));

export default entitiesRouter;

