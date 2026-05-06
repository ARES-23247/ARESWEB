// ── Scouting Routes Index ────────────────────────────────────────────
// Aggregates all scouting sub-routes (TOA proxy, FTC Events proxy,
// AI analysis) under a single router for mounting in the main API.

import { OpenAPIHono } from "@hono/zod-openapi";
import { AppEnv, ensureAuth } from "../../middleware";
import toaProxy from "./toa-proxy";
import ftcEventsProxy from "./ftcevents-proxy";
import analyzeRouter from "./analyze";
import analysesRouter from "./analyses";

const scoutingRouter = new OpenAPIHono<AppEnv>();

// Public routes: TOA and FTC Events data are publicly available
scoutingRouter.route("/toa", toaProxy);
scoutingRouter.route("/ftcevents", ftcEventsProxy);

// AI analysis requires authentication to protect AI costs
scoutingRouter.use("/analyze/*", ensureAuth);
scoutingRouter.route("/analyze", analyzeRouter);

scoutingRouter.use("/analyses/*", ensureAuth);
scoutingRouter.route("/analyses", analysesRouter);

export default scoutingRouter;

