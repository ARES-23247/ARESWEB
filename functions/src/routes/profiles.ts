import express from "express";
import rateLimit from "express-rate-limit";
import { registerProfileAdminRoutes } from "./profileAdmin";
import profileEmailRosterRouter from "./profileEmailRoster";
import { registerProfileRosterRoutes } from "./profileRoster";
import profileSelfRouter from "./profileSelf";
import { registerProfileSyncRoutes } from "./profileSync";
import { registerProfileZulipRoutes } from "./profileZulip";

const router = express.Router();

router.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Too many requests, please try again later",
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
router.use(profileSelfRouter);
router.use(profileEmailRosterRouter);

registerProfileRosterRoutes(router);
registerProfileSyncRoutes(router);
registerProfileAdminRoutes(router);
registerProfileZulipRoutes(router);

export default router;
