/* eslint-disable @typescript-eslint/no-explicit-any -- ts-rest handler input validated by contract library */
import { Hono } from "hono";
import { createHonoEndpoints } from "ts-rest-hono";
import { outreachContract } from "../../../../shared/schemas/contracts/outreachContract";
import { AppEnv, ensureAdmin, ensureAuth, rateLimitMiddleware, s } from "../../middleware";
import { outreachHandlers } from "./handlers";

const outreachRouter = new Hono<AppEnv>();


const outreachTsRestRouter = s.router(outreachContract, outreachHandlers as any);


// Apply protections
outreachRouter.use("/", ensureAuth);
outreachRouter.use("/admin", ensureAdmin);
outreachRouter.use("/admin/*", ensureAdmin);
outreachRouter.use("/admin", rateLimitMiddleware(15, 60));

createHonoEndpoints(
  outreachContract,
  outreachTsRestRouter,
  outreachRouter,
  {
    responseValidation: true,
    responseValidationErrorHandler: (err, _c) => {
      console.error('[Contract] Response validation failed:', err.cause);
      return { error: { message: 'Internal server error' }, status: 500 };
    }
  }
);

export default outreachRouter;

