import express from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";
import { ensureAuth } from "../middleware/auth";

const router = express.Router();

const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 checkout attempts per 15 minutes
  message: { success: false, error: "Too many checkout requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});
router.use(checkoutLimiter);

router.post(
  "/checkout",
  ensureAuth,
  asyncHandler(async () => {
    throw new ApiError(
      503,
      "Online checkout is unavailable until a verified payment provider is configured"
    );
  })
);

export default router;
