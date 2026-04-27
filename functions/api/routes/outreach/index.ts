
import { Hono } from "hono";
import { createHonoEndpoints, initServer } from "ts-rest-hono";
import { outreachContract } from "../../../../shared/schemas/contracts/outreachContract";
import { AppEnv, ensureAdmin, ensureAuth, rateLimitMiddleware } from "../../middleware";
import { outreachHandlers } from "./handlers";

const s = initServer<AppEnv>();
const outreachRouter = new Hono<AppEnv>();

const outreachTsRestRouter = s.router(outreachContract, outreachHandlers);

// Apply protections
outreachRouter.use("/", ensureAuth);
outreachRouter.use("/admin", ensureAdmin);
outreachRouter.use("/admin/*", ensureAdmin);
outreachRouter.use("/admin", rateLimitMiddleware(15, 60));

createHonoEndpoints(outreachContract, outreachTsRestRouter, outreachRouter);

export default outreachRouter;
