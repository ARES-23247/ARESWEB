import express from "express";
import rateLimit from "express-rate-limit";
import { adminDb } from "../lib/firebase-admin";
import { asyncHandler } from "../lib/utils";

const router = express.Router();

router.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many finance requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
}));

// Public finance data must cross a DTO boundary. The underlying documents may
// contain receipt links, uploader identities, or future internal-only fields.
router.get("/", asyncHandler(async (req, res) => {
  const limitValue = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? "50"), 10) || 50));
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;

  let query = adminDb.collection("finance_transactions")
    .orderBy("date", "desc")
    .limit(limitValue + 1);

  if (cursor) {
    const cursorDocument = await adminDb.collection("finance_transactions").doc(cursor).get();
    if (cursorDocument.exists) query = query.startAfter(cursorDocument);
  }

  const snapshot = await query.get();
  const validDocs = snapshot.docs.filter((doc) => {
    const data = doc.data();
    return data.isDeleted !== 1 && data.status !== "void";
  });

  const hasMore = snapshot.docs.length > limitValue;
  const documents = validDocs.slice(0, limitValue);
  const transactions = documents.map((document) => {
    const data = document.data();
    return {
      id: document.id,
      amount: Number(data.amount || 0),
      type: data.type === "income" ? "income" : "expense",
      category: String(data.category || "Uncategorized"),
      date: String(data.date || ""),
      description: typeof data.description === "string" ? data.description : "",
      seasonId: typeof data.seasonId === "number" ? data.seasonId : null,
    };
  });

  res.json({
    success: true,
    transactions,
    hasMore,
    nextCursor: hasMore ? snapshot.docs[limitValue - 1]?.id ?? null : null,
  });
}));

export default router;
