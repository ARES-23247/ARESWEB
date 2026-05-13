/**
 * docs/index.ts — Thin barrel router
 *
 * Composes doc handler modules into the OpenAPI router chain.
 * Each handler function lives in readHandlers.ts or writeHandlers.ts;
 * this file only wires routes to handlers.
 */
import { OpenAPIHono } from "@hono/zod-openapi";
import { AppEnv, ensureAdmin, ensureAuth } from "../../middleware";
import { edgeCacheMiddleware } from "../../middleware/cache";
import * as docsRoutes from "../../../../shared/routes/docs";

// Handler imports
import {
    handleGetDocs,
    handleSearchDocs,
    handleAdminList,
    handleAdminDetail,
    handleGetDoc,
    handleGetHistory,
    handleSubmitFeedback,
    handleExportAllDocs,
    handleExportSingleDoc,
} from "./readHandlers";

import {
    handleDeleteDoc,
    handleSaveDoc,
    handleUpdateSort,
    handleRestoreHistory,
    handleApproveDoc,
    handleRejectDoc,
    handleUndeleteDoc,
    handlePurgeDoc,
} from "./writeHandlers";

const _docsRouter = new OpenAPIHono<AppEnv>();

// Apply edge caching to public documentation routes (GET only, non-admin)
_docsRouter.use("*", async (c, next) => {
    const path = c.req.path;
    if (c.req.method !== "GET" || path.includes("/admin/") || path.endsWith("/feedback")) {
        return next();
    }
    return edgeCacheMiddleware(180, 60, 300)(c, next);
});

// SEC-F01: Authenticated users can submit revisions via /admin/save
_docsRouter.use("/admin/save", ensureAuth);

// SEC-F02: All other /admin paths require full admin privileges.
// We list them explicitly to avoid matching /admin/save.
const adminPrivilegedPaths = [
    "/admin/list",
    "/admin/:slug/detail",
    "/admin/:slug/sort",
    "/admin/:slug/history",
    "/admin/:slug/history/*",
    "/admin/:slug/approve",
    "/admin/:slug/reject",
    "/admin/:slug/undelete",
    "/admin/:slug/purge",
    "/admin/:slug" // deleteDoc
];

adminPrivilegedPaths.forEach((path: string) => {
    _docsRouter.use(path, ensureAdmin);
});

// ──── Route Chain ───────────────────────────────────────────────────────────

export const docsRouter = _docsRouter
    .openapi(docsRoutes.getDocsRoute, handleGetDocs)
    .openapi(docsRoutes.searchDocsRoute, handleSearchDocs)
    .openapi(docsRoutes.adminListRoute, handleAdminList)
    .openapi(docsRoutes.adminDetailRoute, handleAdminDetail)
    .openapi(docsRoutes.getDocRoute, handleGetDoc)
    .openapi(docsRoutes.deleteDocRoute, handleDeleteDoc)
    .openapi(docsRoutes.saveDocRoute, handleSaveDoc)
    .openapi(docsRoutes.updateSortRoute, handleUpdateSort)
    .openapi(docsRoutes.submitFeedbackRoute, handleSubmitFeedback)
    .openapi(docsRoutes.getHistoryRoute, handleGetHistory)
    .openapi(docsRoutes.restoreHistoryRoute, handleRestoreHistory)
    .openapi(docsRoutes.approveDocRoute, handleApproveDoc)
    .openapi(docsRoutes.rejectDocRoute, handleRejectDoc)
    .openapi(docsRoutes.undeleteDocRoute, handleUndeleteDoc)
    .openapi(docsRoutes.purgeDocRoute, handlePurgeDoc)
    .openapi(docsRoutes.exportAllDocsRoute, handleExportAllDocs)
    .openapi(docsRoutes.exportSingleDocRoute, handleExportSingleDoc);

export default docsRouter;
