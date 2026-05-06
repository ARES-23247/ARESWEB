import { OpenAPIHono } from "@hono/zod-openapi";
import { AppEnv, ensureAdmin, turnstileMiddleware, persistentRateLimitMiddleware } from "../../middleware";
import { 
  listInquiriesRoute, 
  submitInquiryRoute, 
  updateInquiryStatusRoute, 
  updateInquiryNotesRoute, 
  deleteInquiryRoute 
} from "../../../../shared/routes/inquiries";
import { 
  handleListInquiries, 
  handleSubmitInquiry, 
  handleUpdateStatus, 
  handleUpdateNotes, 
  handleDeleteInquiry 
} from "./handlers";

const inquiriesRouter = new OpenAPIHono<AppEnv>();

// Apply protections for admin routes
inquiriesRouter.use("/admin", ensureAdmin);
inquiriesRouter.use("/admin/*", ensureAdmin);

// List inquiries (Admin)
inquiriesRouter.openapi(listInquiriesRoute, handleListInquiries);

// Submit a new inquiry (Public)
// Apply middlewares using .use() on the specific route path
inquiriesRouter.use(
  "/",
  persistentRateLimitMiddleware(100, 300),  // TEMP: Drastically increased for debugging
  turnstileMiddleware()
);
inquiriesRouter.openapi(submitInquiryRoute, handleSubmitInquiry);

// Update inquiry status (Admin)
inquiriesRouter.openapi(updateInquiryStatusRoute, handleUpdateStatus);

// Update inquiry notes (Admin)
inquiriesRouter.openapi(updateInquiryNotesRoute, handleUpdateNotes);

// Delete inquiry (Admin)
inquiriesRouter.openapi(deleteInquiryRoute, handleDeleteInquiry);

// TEMP: Clear rate limits (Admin only) - for debugging rate limit issues
inquiriesRouter.get("/admin/clear-rate-limits", ensureAdmin, async (c) => {
  const db = c.get("db") as import("kysely").Kysely<import("../../../../shared/schemas/database").DB>;
  try {
    const result = await db.deleteFrom("rate_limits").execute();
    return c.json({ success: true, deleted: result.meta.numDeletedRows });
  } catch (err) {
    console.error("[ClearRateLimits] Error:", err);
    return c.json({ error: "Failed to clear rate limits" }, 500);
  }
});

export default inquiriesRouter;
export { purgeOldInquiries } from "./handlers";
