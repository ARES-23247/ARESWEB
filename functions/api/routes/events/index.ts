 
import { Hono } from "hono";
import { createHonoEndpoints, initServer } from "ts-rest-hono";
import { eventContract } from "../../../../src/schemas/contracts/eventContract";
import { AppEnv, ensureAdmin, ensureAuth } from "../../middleware";
import { eventHandlers } from "./handlers";

const s = initServer<AppEnv>();
const eventsRouter = new Hono<AppEnv>();

const eventTsRestRouter = s.router(eventContract, eventHandlers);

// Apply protections
eventsRouter.use("/admin", ensureAdmin);
eventsRouter.use("/admin/*", ensureAdmin);
eventsRouter.use("/:id/signups", ensureAuth);

createHonoEndpoints(eventContract, eventTsRestRouter, eventsRouter);

// legacy exports removed

export default eventsRouter;
