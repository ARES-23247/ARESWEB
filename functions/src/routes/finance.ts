import express from "express";
import rateLimit from "express-rate-limit";
import { adminDb } from "../lib/firebase-admin";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";

const router = express.Router();
const SCAN_PAGE_SIZE = 100;
const MAX_SCAN_DOCUMENTS = 500;

function isPublicFinanceRecord(data: FirebaseFirestore.DocumentData): boolean {
  const isDeleted = data.isDeleted === 1 || data.isDeleted === true;
  const status = typeof data.status === "string" ? data.status.trim().toLowerCase() : "";
  return !isDeleted && status !== "void";
}

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
  const collection = adminDb.collection("finance_transactions");
  let scanCursor: FirebaseFirestore.DocumentSnapshot | undefined;

  if (cursor) {
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(cursor)) throw new ApiError(400, "Invalid finance cursor.");
    const cursorDocument = await collection.doc(cursor).get();
    if (!cursorDocument.exists) throw new ApiError(400, "Finance cursor was not found.");
    scanCursor = cursorDocument;
  }

  const validDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  let scannedDocuments = 0;
  let exhausted = false;

  while (validDocs.length < limitValue + 1 && scannedDocuments < MAX_SCAN_DOCUMENTS && !exhausted) {
    const pageSize = Math.min(SCAN_PAGE_SIZE, MAX_SCAN_DOCUMENTS - scannedDocuments);
    let query = collection.orderBy("date", "desc").limit(pageSize);
    if (scanCursor) query = query.startAfter(scanCursor);

    const snapshot = await query.get();
    if (snapshot.empty || snapshot.docs.length === 0) {
      exhausted = true;
      break;
    }

    for (const document of snapshot.docs) {
      scanCursor = document;
      scannedDocuments += 1;
      if (isPublicFinanceRecord(document.data())) validDocs.push(document);
      if (validDocs.length >= limitValue + 1 || scannedDocuments >= MAX_SCAN_DOCUMENTS) break;
    }

    if (snapshot.docs.length < pageSize) exhausted = true;
  }

  const hasMore = validDocs.length > limitValue || (!exhausted && scannedDocuments >= MAX_SCAN_DOCUMENTS);
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
    nextCursor: hasMore ? documents.at(-1)?.id ?? scanCursor?.id ?? null : null,
  });
}));

export default router;
