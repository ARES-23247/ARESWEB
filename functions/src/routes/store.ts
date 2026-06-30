import express from "express";
import rateLimit from "express-rate-limit";
import { adminDb } from "../lib/firebase-admin";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";
import { ensureAuth, AuthenticatedRequest } from "../middleware/auth";

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
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { items, totalCents } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ApiError(400, "Missing or empty items list");
    }

    const customerEmail = req.user?.email || "anonymous-buyer@gmail.com";
    const orderId = `order_${Date.now()}`;
    const orderRecord = {
      id: orderId,
      customerEmail: customerEmail,
      items: items.map((i: any) => ({
        productId: i.productId,
        quantity: i.quantity || 1,
        name: i.name,
      })),
      totalCents: totalCents || 0,
      status: "processing",
      fulfillmentStatus: "unfulfilled",
      createdAt: new Date().toISOString(),
    };

    await adminDb.collection("orders").doc(orderId).set(orderRecord);

    res.json({ success: true, orderId });
  })
);

export default router;
