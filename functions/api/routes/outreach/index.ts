 
 
import { OpenAPIHono } from "@hono/zod-openapi";
import { AppEnv, ensureAdmin, ensureAuth, rateLimitMiddleware } from "../../middleware";
import { 
  listOutreachRoute, 
  adminListOutreachRoute, 
  saveOutreachRoute, 
  deleteOutreachRoute 
} from "../../../../shared/routes/outreach";
import { handleListOutreach, handleAdminListOutreach } from "./list";
import { handleSaveOutreach } from "./save";
import { handleDeleteOutreach } from "./delete";

const outreachRouter = new OpenAPIHono<AppEnv>();

// Apply protections
outreachRouter.use("/", ensureAuth);
outreachRouter.use("/admin", ensureAdmin);
outreachRouter.use("/admin/*", ensureAdmin);
outreachRouter.use("/admin", rateLimitMiddleware(15, 60));

// Public list (requires auth in this specific app logic it seems)
outreachRouter.openapi(listOutreachRoute, handleListOutreach);

// Admin list
outreachRouter.openapi(adminListOutreachRoute, handleAdminListOutreach);

// Save/Update (Admin)
outreachRouter.openapi(saveOutreachRoute, handleSaveOutreach);

// Delete (Admin)
outreachRouter.openapi(deleteOutreachRoute, handleDeleteOutreach);

export default outreachRouter;
