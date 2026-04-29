 
import { Hono } from "hono";
import { createHonoEndpoints, initServer } from "ts-rest-hono";
import { eventContract } from "../../../../shared/schemas/contracts/eventContract";
import { AppEnv, ensureAdmin, ensureAuth } from "../../middleware";
import { eventHandlers } from "./handlers";

const s = initServer<AppEnv>();
const eventsRouter = new Hono<AppEnv>();

const eventTsRestRouter = s.router(eventContract, eventHandlers);

import { edgeCacheMiddleware } from "../../middleware/cache";

// Apply protections
eventsRouter.use("/", edgeCacheMiddleware(300, 60)); // Cache list
eventsRouter.use("/:id", edgeCacheMiddleware(300, 60)); // Cache single
eventsRouter.use("/admin", ensureAdmin);
eventsRouter.use("/admin/*", ensureAdmin);
eventsRouter.use("/:id/signups", ensureAuth);

createHonoEndpoints(eventContract, eventTsRestRouter, eventsRouter);

// legacy exports removed

export default eventsRouter;
