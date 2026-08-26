import express from "express";
import rateLimit from "express-rate-limit";
import { adminDb } from "../lib/firebase-admin";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";
import { ensureAdmin, type AuthenticatedRequest } from "../middleware/auth";
import { distributedAnonymousQuota } from "../middleware/distributedQuota";

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
router.use(distributedAnonymousQuota({
  scope: "public-finance",
  limit: 100,
  windowMs: 15 * 60 * 1000,
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


// ---------------------------------------------------------------------------
// Admin write path. Coaches and admins record transactions here; receipt
// URLs and recorder identity never cross the public DTO boundary.
// ---------------------------------------------------------------------------

const SAFE_FINANCE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{1,80}$/;

interface FinanceWriteInput {
  id?: unknown;
  date?: unknown;
  amount?: unknown;
  type?: unknown;
  category?: unknown;
  description?: unknown;
  seasonId?: unknown;
  status?: unknown;
  receiptUrl?: unknown;
}

function financeWriteRecord(input: FinanceWriteInput, actorUid: string) {
  const date = typeof input.date === "string" ? input.date.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ApiError(400, "Transaction date must be a YYYY-MM-DD date.");
  }
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) !== amount * 100) {
    throw new ApiError(400, "Amount must be a positive number with at most two decimals.");
  }
  const type = input.type === "income" ? "income" : "expense";
  const category =
    typeof input.category === "string" && input.category.trim()
      ? input.category.trim().slice(0, 80)
      : "Uncategorized";
  const description =
    typeof input.description === "string" ? input.description.trim().slice(0, 300) : "";
  if (!description) throw new ApiError(400, "A transaction description is required.");
  const seasonId =
    input.seasonId === null || input.seasonId === undefined || input.seasonId === ""
      ? null
      : Number(input.seasonId);
  if (seasonId !== null && (!Number.isInteger(seasonId) || seasonId < 2000 || seasonId > 2100)) {
    throw new ApiError(400, "Season must be a year between 2000 and 2100.");
  }
  const status = input.status === "void" ? "void" : "published";
  let receiptUrl: string | null = null;
  if (typeof input.receiptUrl === "string" && input.receiptUrl.trim()) {
    receiptUrl = input.receiptUrl.trim();
    if (receiptUrl.length > 2048 || !receiptUrl.startsWith("https://")) {
      throw new ApiError(400, "Receipt links must be https:// URLs.");
    }
  }
  return {
    date,
    amount: Math.round(amount * 100) / 100,
    type,
    category,
    description,
    seasonId,
    status,
    receiptUrl,
    recordedBy: actorUid,
  };
}

// GET /api/finance/admin - full ledger including void transactions and receipts
router.get("/admin", ensureAdmin, asyncHandler(async (_req, res) => {
  const snapshot = await adminDb
    .collection("finance_transactions")
    .orderBy("date", "desc")
    .limit(500)
    .get();
  const transactions = snapshot.docs.map((document) => {
    const data = document.data();
    return {
      id: document.id,
      amount: Number(data.amount || 0),
      type: data.type === "income" ? "income" : "expense",
      category: String(data.category || "Uncategorized"),
      date: String(data.date || ""),
      description: typeof data.description === "string" ? data.description : "",
      seasonId: typeof data.seasonId === "number" ? data.seasonId : null,
      status: data.status === "void" ? "void" : "published",
      isDeleted: data.isDeleted === 1 ? 1 : 0,
      receiptUrl: typeof data.receiptUrl === "string" ? data.receiptUrl : null,
      updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null,
    };
  });
  res.json({ success: true, transactions });
}));

// POST /api/finance/admin - create or update a transaction
router.post("/admin", ensureAdmin, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const input = req.body as FinanceWriteInput;
  const record = financeWriteRecord(input, req.user?.uid ?? "");
  const transactionId =
    typeof input.id === "string" && input.id.trim() ? input.id.trim() : `fin_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  if (!SAFE_FINANCE_ID.test(transactionId)) {
    throw new ApiError(400, "Transaction id may only contain letters, numbers, dashes, and underscores.");
  }
  const now = new Date().toISOString();
  const ref = adminDb.collection("finance_transactions").doc(transactionId);
  const existing = await ref.get();
  if (existing.exists) {
    await ref.update({ ...record, id: transactionId, updatedAt: now });
  } else {
    await ref.set({ ...record, id: transactionId, createdAt: now, updatedAt: now, isDeleted: 0 });
  }
  res.json({ success: true, id: transactionId });
}));

async function setFinanceLifecycle(id: unknown, archive: boolean) {
  if (typeof id !== "string" || !SAFE_FINANCE_ID.test(id)) {
    throw new ApiError(400, "Provide a valid transaction id.");
  }
  const ref = adminDb.collection("finance_transactions").doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new ApiError(404, "Transaction not found.");
  const now = new Date().toISOString();
  await ref.update(
    archive
      ? { isDeleted: 1, archivedAt: now, updatedAt: now }
      : { isDeleted: 0, archivedAt: null, updatedAt: now },
  );
}

// DELETE /api/finance/admin/:id - archive a transaction
router.delete("/admin/:id", ensureAdmin, asyncHandler(async (req, res) => {
  await setFinanceLifecycle(req.params.id, true);
  res.json({ success: true });
}));

// PATCH /api/finance/admin/:id/restore - restore a transaction
router.patch("/admin/:id/restore", ensureAdmin, asyncHandler(async (req, res) => {
  await setFinanceLifecycle(req.params.id, false);
  res.json({ success: true });
}));

export default router;
