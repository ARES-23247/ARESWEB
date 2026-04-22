import { Hono, Context } from "hono";
import { AppEnv, logAuditAction } from "./utils";
import { ensureAdmin } from "./auth";

// ── Generic Content Management Factory ────────────────────────────────

export interface ContentLifecycleHooks {
  onApprove?: (c: Context<AppEnv>, id: string) => Promise<boolean | void>;
  onReject?: (c: Context<AppEnv>, id: string, reason?: string) => Promise<boolean | void>;
  onRestore?: (c: Context<AppEnv>, id: string) => Promise<boolean | void>;
  onDelete?: (c: Context<AppEnv>, id: string, type: "trashed" | "purged") => Promise<boolean | void>;
}

export function createContentLifecycleRouter(tableName: string, hooks?: ContentLifecycleHooks, idColumn: string = "id") {
  const router = new Hono<AppEnv>();

  // Use ensureAdmin for all lifecycle routes
  router.use("*", ensureAdmin);

  // Approve
  router.patch("/:id/approve", async (c) => {
    const id = c.req.param("id");
    
    let handled = false;
    if (hooks?.onApprove) handled = (await hooks.onApprove(c, id)) === true;

    if (!handled) {
      const { success } = await c.env.DB.prepare(
        `UPDATE ${tableName} SET status = 'published' WHERE ${idColumn} = ?`
      ).bind(id).run();
      if (!success) return c.json({ error: "Failed to approve" }, 500);
    }

    await logAuditAction(c, `APPROVE_${tableName.toUpperCase()}`, tableName, id);
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
  });

  // Hard Delete (Purge)
  router.delete("/:id/purge", async (c) => {
    const id = c.req.param("id");
    
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
  });

  return router;
}
