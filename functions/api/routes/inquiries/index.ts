
import { Hono } from "hono";
import { createHonoEndpoints, initServer } from "ts-rest-hono";
import { inquiryContract } from "../../../../shared/schemas/contracts/inquiryContract";
import { AppEnv, ensureAdmin, turnstileMiddleware, persistentRateLimitMiddleware } from "../../middleware";
import { inquiryHandlers } from "./handlers";

const s = initServer<AppEnv>();
const inquiriesRouter = new Hono<AppEnv>();

const inquiriesTsRestRouter = s.router(inquiryContract, inquiryHandlers);

// Apply protections
inquiriesRouter.use("/admin", ensureAdmin);
inquiriesRouter.use("/admin/*", ensureAdmin);

// Rate limiting for public submissions
inquiriesRouter.post("/", persistentRateLimitMiddleware(5, 300));

// Turnstile for public submissions
inquiriesRouter.use("/", async (c, next) => {
  if (c.req.method === "POST" && !c.req.path.includes("/admin")) {
    return turnstileMiddleware()(c, next);
  }
  return next();
});

createHonoEndpoints(inquiryContract, inquiriesTsRestRouter, inquiriesRouter);

export default inquiriesRouter;
export { purgeOldInquiries } from "./handlers";
