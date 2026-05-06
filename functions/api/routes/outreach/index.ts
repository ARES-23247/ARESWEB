/* eslint-disable @typescript-eslint/no-explicit-any -- OpenAPI handler input validated by Zod schemas */
import { OpenAPIHono } from "@hono/zod-openapi";
import { AppEnv, ensureAdmin, ensureAuth, rateLimitMiddleware } from "../../middleware";
import { 
  listOutreachRoute, 
  adminListOutreachRoute, 
  saveOutreachRoute, 
  deleteOutreachRoute 
} from "../../../../shared/routes/outreach";
import { 
  handleListOutreach, 
  handleAdminListOutreach, 
  handleSaveOutreach, 
  handleDeleteOutreach 
} from "./handlers";

const outreachRouter = new OpenAPIHono<AppEnv>();

// Apply protections
outreachRouter.use("/", ensureAuth);
outreachRouter.use("/admin", ensureAdmin);
outreachRouter.use("/admin/*", ensureAdmin);
outreachRouter.use("/admin", rateLimitMiddleware(15, 60));

// Public list (requires auth in this specific app logic it seems)
outreachRouter.openapi(listOutreachRoute, handleListOutreach as any);

// Admin list
outreachRouter.openapi(adminListOutreachRoute, handleAdminListOutreach as any);

// Save/Update (Admin)
outreachRouter.openapi(saveOutreachRoute, handleSaveOutreach as any);

// Delete (Admin)
outreachRouter.openapi(deleteOutreachRoute, handleDeleteOutreach as any);

export default outreachRouter;
