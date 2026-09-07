import { FieldPath, Timestamp } from "firebase-admin/firestore";
import { ApiError } from "../middleware/errorHandler";
import { adminDb } from "./firebase-admin";
import { readCommunityHead } from "./waggleCommunityDomain";
import { WAGGLE_HEADS, WAGGLE_EVENTS } from "./waggleCommunityMutations";
import { WAGGLE_REPORTS } from "./waggleCommunityReports";

/** One bounded pass. Invoke repeatedly from the scheduled maintenance owner, never a public route. */
export async function cleanupWaggleCommunity(
  db: FirebaseFirestore.Firestore = adminDb,
  now = new Date(),
) {
  const cutoff = now.toISOString();
  const result = { heads: 0, revisions: 0, reports: 0, events: 0 };
  const heads = await db
    .collection(WAGGLE_HEADS)
    .where("isDeleted", "==", true)
    .where("retireAt", "<=", cutoff)
    .orderBy("retireAt", "asc")
    .orderBy(FieldPath.documentId(), "asc")
    .limit(12)
    .get();
  for (const candidate of heads.docs) {
    const removed = await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(candidate.ref);
      if (!snapshot.exists) return { heads: 0, revisions: 0 };
      const head = readCommunityHead(snapshot.data(), snapshot.id);
      if (!head.isDeleted || head.retireAt === null || head.retireAt > cutoff)
        return { heads: 0, revisions: 0 };
      // A leftover revision batch keeps its tombstone until the last content is gone.
      const revisions = await tx.get(
        candidate.ref
          .collection("revisions")
          .orderBy(FieldPath.documentId(), "asc")
          .limit(26),
      );
      for (const revision of revisions.docs.slice(0, 25))
        tx.delete(revision.ref);
      const complete = revisions.size <= 25;
      if (complete) tx.delete(candidate.ref);
      return {
        heads: complete ? 1 : 0,
        revisions: Math.min(revisions.size, 25),
      };
    });
    result.heads += removed.heads;
    result.revisions += removed.revisions;
  }
  async function purgeExpired(
    collection: string,
    timestamp: boolean,
  ): Promise<number> {
    const candidates = await db
      .collection(collection)
      .where("expiresAt", "<=", timestamp ? now : cutoff)
      .orderBy("expiresAt", "asc")
      .orderBy(FieldPath.documentId(), "asc")
      .limit(25)
      .get();
    let removed = 0;
    for (const candidate of candidates.docs) {
      removed += await db.runTransaction(async (tx) => {
        const snapshot = await tx.get(candidate.ref);
        if (!snapshot.exists) return 0;
        const expiry: unknown = snapshot.data()?.expiresAt;
        const millis = timestamp
          ? expiry instanceof Timestamp
            ? expiry.toMillis()
            : expiry instanceof Date
              ? expiry.getTime()
              : NaN
          : typeof expiry === "string"
            ? Date.parse(expiry)
            : NaN;
        if (!Number.isFinite(millis))
          throw new ApiError(
            503,
            "Garden maintenance is temporarily unavailable.",
            "WAGGLE_CLEANUP_INVALID",
          );
        if (millis > now.getTime()) return 0;
        tx.delete(candidate.ref);
        return 1;
      });
    }
    return removed;
  }
  result.reports = await purgeExpired(WAGGLE_REPORTS, false);
  result.events = await purgeExpired(WAGGLE_EVENTS, true);
  return result;
}
