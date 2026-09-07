import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { FieldPath } from "firebase-admin/firestore";
import { z } from "zod";
import type {
  CommunityReport,
  CommunityReportPage,
} from "../generated/games/waggle-way/community";
import { currentAuthorizationRole } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import { adminDb } from "./firebase-admin";
import {
  COMMUNITY_PAGE_SIZE,
  CommunityIdSchema,
  CommunityReasonSchema,
  communityId,
  communityCard,
  readCommunityHead,
  readCommunityRevision,
} from "./waggleCommunityDomain";
import { WAGGLE_HEADS, WAGGLE_RETENTION_MS } from "./waggleCommunityMutations";

export const WAGGLE_REPORTS = "waggle_reports";
const digest = z.string().regex(/^[a-f0-9]{64}$/u);
const ReportSchema = z
  .object({
    schema: z.literal(1),
    id: digest,
    levelId: CommunityIdSchema,
    levelCreatedAt: z.string().datetime(),
    revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    reason: CommunityReasonSchema,
    status: z.enum(["open", "resolved"]),
    createdAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
    resolvedAt: z.string().datetime().nullable(),
    resolvedBy: z.string().min(1).max(128).nullable(),
  })
  .strict();
type ReportRecord = z.infer<typeof ReportSchema>;
const CursorSchema = z
  .object({
    scope: z.literal("reports"),
    expiresAt: z.string().datetime(),
    id: digest,
  })
  .strict();
function input<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new ApiError(
      400,
      "Check the report fields or reload the first page.",
      "WAGGLE_REPORT_INVALID",
    );
  return result.data;
}
function unavailable(): never {
  throw new ApiError(
    503,
    "Garden reports are temporarily unavailable.",
    "WAGGLE_REPORT_UNAVAILABLE",
  );
}
function reportId(
  levelId: string,
  createdAt: string,
  revision: number,
  reason: string,
): string {
  return createHash("sha256")
    .update(JSON.stringify([levelId, createdAt, revision, reason]))
    .digest("hex");
}
function readReport(value: unknown, id: string): ReportRecord {
  const parsed = ReportSchema.safeParse(value);
  if (!parsed.success) unavailable();
  const r = parsed.data;
  if (
    r.id !== id ||
    r.id !== reportId(r.levelId, r.levelCreatedAt, r.revision, r.reason) ||
    Date.parse(r.expiresAt) !== Date.parse(r.createdAt) + WAGGLE_RETENTION_MS ||
    (r.status === "resolved") !==
      (r.resolvedAt !== null && r.resolvedBy !== null) ||
    (r.status === "open" && (r.resolvedAt !== null || r.resolvedBy !== null)) ||
    (r.resolvedAt !== null && r.resolvedAt < r.createdAt)
  )
    unavailable();
  return r;
}
function encodeCursor(value: z.infer<typeof CursorSchema>): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

/** The transport must apply App Check and anonymous/global quotas before calling report. */
export function createWaggleCommunityReports(
  db: FirebaseFirestore.Firestore = adminDb,
  clock = () => new Date().toISOString(),
) {
  const reports = db.collection(WAGGLE_REPORTS);
  const heads = db.collection(WAGGLE_HEADS);
  async function requireModerator(
    tx: FirebaseFirestore.Transaction,
    uid: string,
  ) {
    const actor = await tx.get(db.collection("authorized_users").doc(uid));
    const role = currentAuthorizationRole(actor.data());
    if (role !== "admin" && role !== "coach")
      throw new ApiError(
        403,
        "Your current authorization does not permit this action.",
        "WAGGLE_AUTHORIZATION_REQUIRED",
      );
  }
  async function publication(
    tx: FirebaseFirestore.Transaction,
    levelId: string,
    identity?: ReportRecord,
  ) {
    const snapshot = await tx.get(heads.doc(levelId));
    if (!snapshot.exists) return null;
    const head = readCommunityHead(snapshot.data(), levelId);
    if (
      head.isDeleted ||
      head.visibility !== "published" ||
      head.publishedRevision === null ||
      (identity &&
        (head.createdAt !== identity.levelCreatedAt ||
          head.publishedRevision !== identity.revision))
    )
      return null;
    const saved = await tx.get(
      heads
        .doc(levelId)
        .collection("revisions")
        .doc(String(head.publishedRevision)),
    );
    const revision = readCommunityRevision(
      saved.data(),
      levelId,
      head.publishedRevision,
    );
    const card = communityCard(revision);
    if (!isDeepStrictEqual(card, head.publishedCard)) unavailable();
    return { head, card };
  }
  async function report(rawId: unknown, value: unknown): Promise<void> {
    const levelId = communityId(rawId);
    const { reason } = input(
      z.object({ reason: CommunityReasonSchema }).strict(),
      value,
    );
    const now = clock();
    await db.runTransaction(async (tx) => {
      const current = await publication(tx, levelId);
      if (!current)
        throw new ApiError(404, "Garden not found.", "WAGGLE_NOT_FOUND");
      const { head } = current;
      const id = reportId(
        levelId,
        head.createdAt,
        head.publishedRevision!,
        reason,
      );
      const ref = reports.doc(id);
      const previous = await tx.get(ref);
      // One category per exact publication, with no IP, reporter identity or vote count.
      if (previous.exists) {
        readReport(previous.data(), id);
        return;
      }
      tx.set(ref, {
        schema: 1,
        id,
        levelId,
        levelCreatedAt: head.createdAt,
        revision: head.publishedRevision,
        reason,
        status: "open",
        createdAt: now,
        expiresAt: new Date(
          Date.parse(now) + WAGGLE_RETENTION_MS,
        ).toISOString(),
        resolvedAt: null,
        resolvedBy: null,
      });
    });
  }
  async function pending(
    actorUid: string,
    value: unknown = {},
  ): Promise<CommunityReportPage> {
    const { cursor } = input(
      z.object({ cursor: z.string().min(1).max(1024).optional() }).strict(),
      value,
    );
    let after: z.infer<typeof CursorSchema> | null = null;
    if (cursor !== undefined) {
      let raw: unknown;
      try {
        raw = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
      } catch {
        throw new ApiError(
          400,
          "Reload the first report page.",
          "WAGGLE_REPORT_INVALID",
        );
      }
      after = input(CursorSchema, raw);
      if (encodeCursor(after) !== cursor)
        throw new ApiError(
          400,
          "Reload the first report page.",
          "WAGGLE_REPORT_INVALID",
        );
    }
    let query = reports
      .where("status", "==", "open")
      .where("expiresAt", ">", clock())
      .orderBy("expiresAt", "asc")
      .orderBy(FieldPath.documentId(), "asc");
    if (after) query = query.startAfter(after.expiresAt, after.id);
    return db.runTransaction(
      async (tx) => {
        await requireModerator(tx, actorUid);
        const page = await tx.get(query.limit(COMMUNITY_PAGE_SIZE + 1));
        const records = page.docs
          .slice(0, COMMUNITY_PAGE_SIZE)
          .map((doc) => readReport(doc.data(), doc.id));
        const items: CommunityReport[] = await Promise.all(
          records.map(async (r) => {
            if (r.status !== "open") unavailable();
            const current = await publication(tx, r.levelId, r);
            return {
              id: r.id,
              levelId: r.levelId,
              revision: r.revision,
              reason: r.reason,
              publication: current
                ? { card: current.card, version: current.head.version }
                : null,
            };
          }),
        );
        const last = records.at(-1);
        return {
          reports: items,
          nextCursor:
            page.size > COMMUNITY_PAGE_SIZE && last
              ? encodeCursor({
                  scope: "reports",
                  expiresAt: last.expiresAt,
                  id: last.id,
                })
              : null,
        };
      },
      { readOnly: true },
    );
  }
  async function resolve(actorUid: string, rawId: unknown): Promise<void> {
    const id = input(digest, rawId);
    const now = clock();
    await db.runTransaction(async (tx) => {
      await requireModerator(tx, actorUid);
      const ref = reports.doc(id);
      const snapshot = await tx.get(ref);
      if (!snapshot.exists)
        throw new ApiError(404, "Report not found.", "WAGGLE_REPORT_NOT_FOUND");
      const saved = readReport(snapshot.data(), id);
      if (saved.status === "resolved") return;
      tx.set(ref, {
        ...saved,
        status: "resolved",
        resolvedAt: now,
        resolvedBy: actorUid,
      });
    });
  }
  return { report, pending, resolve };
}
