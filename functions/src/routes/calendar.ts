import express from "express";
import rateLimit from "express-rate-limit";
import { distributedAnonymousQuota } from "../middleware/distributedQuota";
import { registerCalendarFeedRoutes } from "./calendarFeedRoutes";
import { registerCalendarLocationRoutes } from "./calendarLocationRoutes";
import { registerCalendarManageRoutes } from "./calendarManageRoutes";
import { registerCalendarOccurrenceRoutes } from "./calendarOccurrenceRoutes";
import { registerCalendarPublicRoutes } from "./calendarPublicRoutes";

export { ensureCalendarPublisher } from "./calendarShared";

const router = express.Router();

router.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 120,
    message: { error: "Too many calendar requests. Please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
router.use(
  distributedAnonymousQuota({
    scope: "public-calendar",
    limit: 120,
    windowMs: 15 * 60 * 1000,
  }),
);

registerCalendarPublicRoutes(router);
registerCalendarManageRoutes(router);
registerCalendarOccurrenceRoutes(router);
registerCalendarLocationRoutes(router);
registerCalendarFeedRoutes(router);

export default router;
