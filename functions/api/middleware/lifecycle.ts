import { Hono, Context } from "hono";
import { AppEnv, logAuditAction } from "./utils";
import { ensureAdmin } from "./auth";

// ── Generic Content Management Factory ────────────────────────────────

export interface ContentLifecycleHooks {
  onApprove?: (c: Context<AppEnv>, id: string) => Promise<boolean | { handled: boolean, warnings?: string[] } | void>;
  onReject?: (c: Context<AppEnv>, id: string, reason?: string) => Promise<boolean | void>;
  onRestore?: (c: Context<AppEnv>, id: string) => Promise<boolean | void>;
  onDelete?: (c: Context<AppEnv>, id: string, type: "trashed" | "purged") => Promise<boolean | void>;
}

export function createContentLifecycleRouter(tableName: string, hooks?: ContentLifecycleHooks, idColumn: string = "id") {
  const ALLOWED_TABLES = ["posts", "events", "docs", "inquiries", "users", "comments", "media", "awards", "outreach", "sponsors", "judges", "locations", "badges", "user_profiles"];
  const ALLOWED_COLUMNS = ["id", "slug", "user_id"];

  if (!ALLOWED_TABLES.includes(tableName) || !ALLOWED_COLUMNS.includes(idColumn)) {
    throw new Error(`[Security] Invalid table or column name in lifecycle router: ${tableName}.${idColumn}`);
  }

  const router = new Hono<AppEnv>();

  // Use ensureAdmin for all lifecycle routes
  router.use("*", ensureAdmin);

  // Approve
  router.patch("/:id/approve", async (c) => {
    const id = c.req.param("id");
    
    let handled = false;
    let warnings: string[] = [];
    if (hooks?.onApprove) {
      const result = await hooks.onApprove(c, id);
      if (typeof result === "object" && result !== null) {
        handled = result.handled;
        warnings = result.warnings || [];
      } else {
        handled = result === true;
      }
    }

    if (!handled) {
      const { success } = await c.env.DB.prepare(
        `UPDATE ${tableName} SET status = 'published' WHERE ${idColumn} = ?`
      ).bind(id).run();
      if (!success) return c.json({ error: "Failed to approve" }, 500);
    }

    await logAuditAction(c, `APPROVE_${tableName.toUpperCase()}`, tableName, id);
    if (warnings.length > 0) {
      return c.json({ success: true, warning: warnings.join(" | ") }, 207);
    }
    return c.json({ success: true });
  });

  // Reject
  router.patch("/:id/reject", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({})) as { reason?: string };

    let handled = false;
    if (hooks?.onReject) handled = (await hooks.onReject(c, id, body.reason)) === true;

    if (!handled) {
      const { success } = await c.env.DB.prepare(
        `UPDATE ${tableName} SET status = 'rejected' WHERE ${idColumn} = ?`
      ).bind(id).run();
      if (!success) return c.json({ error: "Failed to reject" }, 500);
    }

    await logAuditAction(c, `REJECT_${tableName.toUpperCase()}`, tableName, id);
    return c.json({ success: true });
  });

  // Restore
  router.patch("/:id/restore", async (c) => {
    const id = c.req.param("id");

    let handled = false;
    if (hooks?.onRestore) handled = (await hooks.onRestore(c, id)) === true;

    if (!handled) {
      const { success } = await c.env.DB.prepare(
        `UPDATE ${tableName} SET is_deleted = 0, status = 'draft' WHERE ${idColumn} = ?`
      ).bind(id).run();
      if (!success) return c.json({ error: "Failed to restore" }, 500);
    }

    await logAuditAction(c, `RESTORE_${tableName.toUpperCase()}`, tableName, id);
    return c.json({ success: true });
  });

  // Soft Delete (Trash)
  router.delete("/:id", async (c) => {
    const id = c.req.param("id");
    
    try {
      let handled = false;
      if (hooks?.onDelete) handled = (await hooks.onDelete(c, id, "trashed")) === true;

      if (!handled) {
        const { success } = await c.env.DB.prepare(
          `UPDATE ${tableName} SET is_deleted = 1 WHERE ${idColumn} = ?`
        ).bind(id).run();
        if (!success) return c.json({ error: "Operation failed" }, 500);
      }
      
      await logAuditAction(c, `DELETE_${tableName.toUpperCase()}`, tableName, id);
      return c.json({ success: true, action: "trashed" });
    } catch (err) {
      console.error(`[Lifecycle] Soft delete error for ${tableName}:`, err);
      return c.json({ error: (err as Error).message || "Operation failed" }, 500);
    }
  });

  // Hard Delete (Purge)
  router.delete("/:id/purge", async (c) => {
    const id = c.req.param("id");
    
    try {
      let handled = false;
      if (hooks?.onDelete) handled = (await hooks.onDelete(c, id, "purged")) === true;

      if (!handled) {
        const { success } = await c.env.DB.prepare(
          `DELETE FROM ${tableName} WHERE ${idColumn} = ?`
        ).bind(id).run();
        if (!success) return c.json({ error: "Operation failed" }, 500);
      }
      
      await logAuditAction(c, `PURGE_${tableName.toUpperCase()}`, tableName, id);
      return c.json({ success: true, action: "purged" });
    } catch (err) {
      console.error(`[Lifecycle] Purge error for ${tableName}:`, err);
      return c.json({ error: (err as Error).message || "Operation failed" }, 500);
    }
  });

  return router;
}
