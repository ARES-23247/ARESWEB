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
  persistentRateLimitMiddleware(10, 60),  // SEC-RL: Production-appropriate rate limit (10 requests per 60 seconds)
  turnstileMiddleware()
);
inquiriesRouter.openapi(submitInquiryRoute, handleSubmitInquiry);

// Update inquiry status (Admin)
inquiriesRouter.openapi(updateInquiryStatusRoute, handleUpdateStatus);

// Update inquiry notes (Admin)
inquiriesRouter.openapi(updateInquiryNotesRoute, handleUpdateNotes);

// Delete inquiry (Admin)
inquiriesRouter.openapi(deleteInquiryRoute, handleDeleteInquiry);

export default inquiriesRouter;
export { purgeOldInquiries } from "./handlers";
