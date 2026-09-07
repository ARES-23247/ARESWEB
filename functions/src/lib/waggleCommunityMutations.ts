import { z } from "zod";
import type {
  CommunityReviewReason,
  OwnedCommunityGarden,
} from "../generated/games/waggle-way/community";
import { currentAuthorizationRole } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import { adminDb } from "./firebase-admin";
import { verifyWaggleSubmission } from "./waggleVerification";
import { WAGGLE_SUBMISSION_BYTES } from "./waggleProof";
import {
  COMMUNITY_MAX_HEADS,
  COMMUNITY_MAX_PENDING,
  CommunityMetadataSchema,
  CommunityParentSchema,
  CommunityReasonSchema,
  communityCard,
  communityId,
  ownedCommunityGarden,
  prepareCommunityRevision,
  readCommunityHead,
  readCommunityRevision,
  type CommunityHead,
} from "./waggleCommunityDomain";

export const WAGGLE_HEADS = "waggle_levels";
export const WAGGLE_LIMITS = "waggle_creator_limits";
export const WAGGLE_EVENTS = "waggle_events";
export const WAGGLE_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const version = z
  .number()
  .int()
  .min(0)
  .max(Number.MAX_SAFE_INTEGER - 1);
const SubmissionSchema = z
  .object({
    expectedVersion: version,
    metadata: CommunityMetadataSchema,
    proof: z
      .object({
        level: z.unknown(),
        replays: z.array(z.unknown()).min(1).max(3),
      })
      .strict(),
    parent: CommunityParentSchema.optional(),
  })
  .strict();
const ReviewSchema = z
  .object({
    expectedVersion: version.min(1),
    reviewDigest: z.string().regex(/^[a-f0-9]{64}$/u),
    decision: z.enum(["approve", "reject"]),
    reason: CommunityReasonSchema.optional(),
  })
  .strict();
const LimitsSchema = z
  .object({
    schema: z.literal(1),
    active: z.number().int().min(0).max(COMMUNITY_MAX_HEADS),
    pending: z.number().int().min(0).max(COMMUNITY_MAX_PENDING),
    updatedAt: z.string().datetime(),
  })
  .strict();
type Limits = z.infer<typeof LimitsSchema>;
type Mutation = "approve" | "reject" | "remove" | "delete";

function input<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new ApiError(
      400,
      "Check the garden revision and required fields.",
      "WAGGLE_REQUEST_INVALID",
    );
  return parsed.data;
}
function conflict(): never {
  throw new ApiError(
    409,
    "This garden changed. Reload it before trying again.",
    "WAGGLE_REVISION_CONFLICT",
  );
}
function unavailable(): never {
  throw new ApiError(
    503,
    "Garden storage is temporarily unavailable.",
    "WAGGLE_STORAGE_UNAVAILABLE",
  );
}
function requireActor(
  data: FirebaseFirestore.DocumentData | undefined,
  review: boolean,
): void {
  const role = currentAuthorizationRole(data);
  if (!role || (review && role !== "admin" && role !== "coach")) {
    throw new ApiError(
      403,
      "Your current authorization does not permit this action.",
      "WAGGLE_AUTHORIZATION_REQUIRED",
    );
  }
}
function requireOwner(head: CommunityHead, actorUid: string): void {
  if (head.ownerUid !== actorUid)
    throw new ApiError(404, "Garden not found.", "WAGGLE_NOT_FOUND");
}

/** The HTTP layer supplies only a verified token UID and applies quotas before parsing. */
export function createWaggleCommunityMutations(
  db: FirebaseFirestore.Firestore = adminDb,
  verifier: typeof verifyWaggleSubmission = verifyWaggleSubmission,
  clock = () => new Date().toISOString(),
) {
  const heads = db.collection(WAGGLE_HEADS);
  const authorization = (uid: string) =>
    db.collection("authorized_users").doc(uid);
  const revisionRef = (id: string, revision: number) =>
    heads.doc(id).collection("revisions").doc(String(revision));

  async function limitsFor(
    tx: FirebaseFirestore.Transaction,
    uid: string,
    headExists: boolean,
    now: string,
  ): Promise<Limits> {
    const [snapshot, activeHeads] = await Promise.all([
      tx.get(db.collection(WAGGLE_LIMITS).doc(uid)),
      tx.get(
        heads
          .where("ownerUid", "==", uid)
          .where("isDeleted", "==", false)
          .limit(COMMUNITY_MAX_HEADS + 1),
      ),
    ]);
    const actual = activeHeads.docs.map((document) =>
      readCommunityHead(document.data(), document.id),
    );
    const active = actual.length;
    const pending = actual.filter(
      (head) => head.candidateStatus === "pending",
    ).length;
    if (active > COMMUNITY_MAX_HEADS || (headExists && active === 0))
      unavailable();
    if (!snapshot.exists) {
      if (active !== 0) unavailable();
      return { schema: 1, active: 0, pending: 0, updatedAt: now };
    }
    const parsed = LimitsSchema.safeParse(snapshot.data());
    if (
      !parsed.success ||
      parsed.data.active !== active ||
      parsed.data.pending !== pending
    )
      unavailable();
    return parsed.data;
  }

  function saveLimits(
    tx: FirebaseFirestore.Transaction,
    uid: string,
    previous: Limits,
    activeDelta: number,
    pendingDelta: number,
    now: string,
  ): void {
    const active = previous.active + activeDelta;
    const pending = previous.pending + pendingDelta;
    if (active > COMMUNITY_MAX_HEADS || pending > COMMUNITY_MAX_PENDING) {
      throw new ApiError(
        429,
        "You may keep 20 active gardens and 3 pending reviews. Resolve or delete an existing garden first.",
        "WAGGLE_CREATOR_CAPACITY",
      );
    }
    const next = LimitsSchema.safeParse({
      schema: 1,
      active,
      pending,
      updatedAt: now,
    });
    if (!next.success || pending > active) unavailable();
    tx.set(db.collection(WAGGLE_LIMITS).doc(uid), next.data);
  }

  function audit(
    tx: FirebaseFirestore.Transaction,
    head: CommunityHead,
    actorUid: string,
    action: string,
    now: string,
    reason: CommunityReviewReason | null,
    digest: string | null,
  ): void {
    tx.set(db.collection(WAGGLE_EVENTS).doc(`${head.id}_${head.version}`), {
      schema: 1,
      levelId: head.id,
      version: head.version,
      actorUid,
      action,
      reason,
      reviewDigest: digest,
      createdAt: now,
      expiresAt: new Date(Date.parse(now) + WAGGLE_RETENTION_MS),
    });
  }

  async function availableParent(
    tx: FirebaseFirestore.Transaction,
    parentId: string,
    createdAt?: string,
  ): Promise<CommunityHead> {
    const snapshot = await tx.get(heads.doc(parentId));
    if (!snapshot.exists) conflict();
    const parent = readCommunityHead(snapshot.data(), parentId);
    if (
      parent.isDeleted ||
      parent.visibility !== "published" ||
      (createdAt !== undefined && parent.createdAt !== createdAt)
    )
      conflict();
    return parent;
  }

  async function submit(
    actorUid: string,
    rawId: unknown,
    payload: string,
  ): Promise<OwnedCommunityGarden> {
    const id = communityId(rawId);
    if (
      typeof payload !== "string" ||
      Buffer.byteLength(payload, "utf8") > WAGGLE_SUBMISSION_BYTES
    ) {
      throw new ApiError(
        413,
        "The submission must fit within 768 KiB.",
        "WAGGLE_PROOF_TOO_LARGE",
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      throw new ApiError(
        400,
        "Choose a valid garden submission.",
        "WAGGLE_REQUEST_INVALID",
      );
    }
    const request = input(SubmissionSchema, parsed);
    if (request.parent?.id === id)
      throw new ApiError(
        400,
        "A garden cannot remix itself.",
        "WAGGLE_PARENT_INVALID",
      );
    const [before, actor] = await Promise.all([
      heads.doc(id).get(),
      authorization(actorUid).get(),
    ]);
    requireActor(actor.data(), false);
    const previous = before.exists
      ? readCommunityHead(before.data(), id)
      : null;
    if (previous) {
      requireOwner(previous, actorUid);
      if (previous.isDeleted || previous.visibility === "removed") conflict();
      if (
        request.parent &&
        (previous.parent?.id !== request.parent.id ||
          previous.parent.revision !== request.parent.revision)
      )
        conflict();
    }
    if ((previous?.version ?? 0) !== request.expectedVersion) conflict();
    const proof = await verifier(JSON.stringify(request.proof));
    const prepared = prepareCommunityRevision(
      id,
      request.expectedVersion + 1,
      request.metadata,
      request.proof.level,
      proof,
    );
    const card = communityCard(prepared);
    const now = clock();
    return db.runTransaction(async (tx) => {
      const [current, actorNow] = await Promise.all([
        tx.get(heads.doc(id)),
        tx.get(authorization(actorUid)),
      ]);
      requireActor(actorNow.data(), false);
      const head = current.exists
        ? readCommunityHead(current.data(), id)
        : null;
      if (head) {
        requireOwner(head, actorUid);
        if (head.isDeleted || head.visibility === "removed") conflict();
      }
      if ((head?.version ?? 0) !== request.expectedVersion) conflict();
      const limits = await limitsFor(tx, actorUid, head !== null, now);
      let parent = head?.parent ?? null;
      if (!head && request.parent) {
        const source = await availableParent(tx, request.parent.id);
        if (source.publishedRevision !== request.parent.revision) conflict();
        const snapshot = await tx.get(
          revisionRef(source.id, source.publishedRevision!),
        );
        if (!snapshot.exists) unavailable();
        const sourceRevision = readCommunityRevision(
          snapshot.data(),
          source.id,
          source.publishedRevision!,
        );
        parent = {
          id: source.id,
          revision: source.publishedRevision!,
          contentHash: sourceRevision.verification.contentHash,
          createdAt: source.createdAt,
        };
      } else if (head?.parent && head.publishedRevision === null) {
        await availableParent(tx, head.parent.id, head.parent.createdAt);
      }
      const next = readCommunityHead(
        {
          schema: 1,
          id,
          ownerUid: actorUid,
          version: prepared.revision,
          title: card.title,
          isDeleted: false,
          visibility: head?.visibility ?? "private",
          publishedRevision: head?.publishedRevision ?? null,
          publishedCard: head?.publishedCard ?? null,
          publishedAt: head?.publishedAt ?? null,
          retireAt: null,
          candidateRevision: prepared.revision,
          candidateStatus: "pending",
          reviewReason: null,
          parent,
          createdAt: head?.createdAt ?? now,
          updatedAt: now,
        },
        id,
      );
      saveLimits(
        tx,
        actorUid,
        limits,
        head ? 0 : 1,
        head?.candidateStatus === "pending" ? 0 : 1,
        now,
      );
      if (head?.candidateRevision)
        tx.delete(revisionRef(id, head.candidateRevision));
      tx.set(revisionRef(id, prepared.revision), prepared);
      tx.set(heads.doc(id), next);
      audit(tx, next, actorUid, "submitted", now, null, prepared.reviewDigest);
      return ownedCommunityGarden(next);
    });
  }

  async function mutate(
    actorUid: string,
    id: string,
    expectedVersion: number,
    operation: Mutation,
    reason: CommunityReviewReason | null,
    digest: string | null,
  ): Promise<OwnedCommunityGarden> {
    const now = clock();
    return db.runTransaction(async (tx) => {
      const [snapshot, actor] = await Promise.all([
        tx.get(heads.doc(id)),
        tx.get(authorization(actorUid)),
      ]);
      requireActor(actor.data(), operation !== "delete");
      if (!snapshot.exists)
        throw new ApiError(404, "Garden not found.", "WAGGLE_NOT_FOUND");
      const head = readCommunityHead(snapshot.data(), id);
      if (operation === "delete") requireOwner(head, actorUid);
      if (head.version !== expectedVersion) conflict();
      if (head.isDeleted) {
        if (operation === "delete") return ownedCommunityGarden(head);
        conflict();
      }
      const limits = await limitsFor(tx, head.ownerUid, true, now);
      let next: CommunityHead = {
        ...head,
        version: head.version + 1,
        updatedAt: now,
      };
      const discard = new Set<number>();
      if (operation === "approve" || operation === "reject") {
        if (
          head.candidateStatus !== "pending" ||
          head.candidateRevision === null
        )
          conflict();
        const candidate = await tx.get(revisionRef(id, head.candidateRevision));
        if (!candidate.exists) unavailable();
        const revision = readCommunityRevision(
          candidate.data(),
          id,
          head.candidateRevision,
        );
        if (revision.reviewDigest !== digest) conflict();
        if (operation === "approve") {
          if (head.parent && head.publishedRevision === null)
            await availableParent(tx, head.parent.id, head.parent.createdAt);
          next = {
            ...next,
            visibility: "published",
            publishedRevision: revision.revision,
            publishedCard: communityCard(revision),
            publishedAt: now,
            candidateRevision: null,
            candidateStatus: null,
            reviewReason: null,
          };
          if (head.publishedRevision !== null)
            discard.add(head.publishedRevision);
        } else
          next = { ...next, candidateStatus: "rejected", reviewReason: reason };
      } else {
        if (operation === "remove" && head.visibility !== "published")
          conflict();
        if (head.publishedRevision !== null)
          discard.add(head.publishedRevision);
        if (head.candidateRevision !== null)
          discard.add(head.candidateRevision);
        next = {
          ...next,
          visibility: operation === "delete" ? "deleted" : "removed",
          isDeleted: operation === "delete",
          publishedRevision: null,
          publishedCard: null,
          publishedAt: null,
          candidateRevision: null,
          candidateStatus: null,
          title: operation === "delete" ? "" : head.title,
          parent: operation === "delete" ? null : head.parent,
          reviewReason: operation === "delete" ? null : reason,
          retireAt:
            operation === "delete"
              ? new Date(Date.parse(now) + WAGGLE_RETENTION_MS).toISOString()
              : null,
        };
      }
      next = readCommunityHead(next, id);
      saveLimits(
        tx,
        head.ownerUid,
        limits,
        operation === "delete" ? -1 : 0,
        head.candidateStatus === "pending" ? -1 : 0,
        now,
      );
      for (const revision of discard) tx.delete(revisionRef(id, revision));
      tx.set(heads.doc(id), next);
      audit(tx, next, actorUid, operation, now, reason, digest);
      return ownedCommunityGarden(next);
    });
  }

  async function decide(actorUid: string, rawId: unknown, value: unknown) {
    const id = communityId(rawId);
    const request = input(ReviewSchema, value);
    if ((request.decision === "reject") !== (request.reason !== undefined))
      throw new ApiError(
        400,
        "Choose a reason when rejecting a garden.",
        "WAGGLE_REVIEW_INVALID",
      );
    return mutate(
      actorUid,
      id,
      request.expectedVersion,
      request.decision,
      request.reason ?? null,
      request.reviewDigest,
    );
  }
  async function removeOwn(actorUid: string, rawId: unknown, value: unknown) {
    const request = input(
      z.object({ expectedVersion: version.min(1) }).strict(),
      value,
    );
    return mutate(
      actorUid,
      communityId(rawId),
      request.expectedVersion,
      "delete",
      null,
      null,
    );
  }
  async function removePublished(
    actorUid: string,
    rawId: unknown,
    value: unknown,
  ) {
    const request = input(
      z
        .object({
          expectedVersion: version.min(1),
          reason: CommunityReasonSchema,
        })
        .strict(),
      value,
    );
    return mutate(
      actorUid,
      communityId(rawId),
      request.expectedVersion,
      "remove",
      request.reason,
      null,
    );
  }
  return { submit, decide, removeOwn, removePublished };
}
