import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { FieldPath } from "firebase-admin/firestore";
import { z } from "zod";
import type {
  CommunityGarden,
  CommunityPage,
  CommunityReview,
  OwnedCommunityGarden,
  OwnedCommunityRevision,
} from "../generated/games/waggle-way/community";
import {
  OBJECT_KINDS,
  parseLevelFile,
} from "../generated/games/waggle-way/level";
import { currentAuthorizationRole } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import { adminDb } from "./firebase-admin";
import {
  COMMUNITY_MAX_HEADS,
  COMMUNITY_PAGE_SIZE,
  CommunityIdSchema,
  CommunityMetadataSchema,
  communityCard,
  communityId,
  ownedCommunityGarden,
  readCommunityHead,
  readCommunityRevision,
  type CommunityHead,
} from "./waggleCommunityDomain";
import { WAGGLE_HEADS } from "./waggleCommunityMutations";

const cursorValue = z.string().min(1).max(1024);
const FiltersSchema = z
  .object({
    mechanic: z.enum(OBJECT_KINDS).optional(),
    difficulty: CommunityMetadataSchema.shape.difficulty.optional(),
    estimatedLength: CommunityMetadataSchema.shape.estimatedLength.optional(),
    cursor: cursorValue.optional(),
  })
  .strict();
const CursorSchema = z
  .object({
    scope: z.enum(["public", "pending"]),
    time: z.string().datetime(),
    id: CommunityIdSchema,
    filters: z.string().regex(/^[a-f0-9]{64}$/u),
  })
  .strict();

function invalid(): never {
  throw new ApiError(
    400,
    "Choose valid garden filters or reload the first page.",
    "WAGGLE_QUERY_INVALID",
  );
}
function missing(): never {
  throw new ApiError(404, "Garden not found.", "WAGGLE_NOT_FOUND");
}
function unavailable(): never {
  throw new ApiError(
    503,
    "Garden storage is temporarily unavailable.",
    "WAGGLE_STORAGE_UNAVAILABLE",
  );
}
function filterHash(filters: z.infer<typeof FiltersSchema>): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        filters.mechanic ?? null,
        filters.difficulty ?? null,
        filters.estimatedLength ?? null,
      ]),
    )
    .digest("hex");
}
function encodeCursor(cursor: z.infer<typeof CursorSchema>): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}
function decodeCursor(
  value: string | undefined,
  scope: "public" | "pending",
  filters: string,
) {
  if (value === undefined) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    invalid();
  }
  const result = CursorSchema.safeParse(parsed);
  if (
    !result.success ||
    result.data.scope !== scope ||
    result.data.filters !== filters ||
    encodeCursor(result.data) !== value
  )
    invalid();
  return result.data;
}

/** Every read is bounded and uses one consistent snapshot, including parent visibility. */
export function createWaggleCommunityReads(
  db: FirebaseFirestore.Firestore = adminDb,
) {
  const heads = db.collection(WAGGLE_HEADS);

  async function requireActor(
    tx: FirebaseFirestore.Transaction,
    uid: string,
    review: boolean,
  ) {
    const actor = await tx.get(db.collection("authorized_users").doc(uid));
    const role = currentAuthorizationRole(actor.data());
    if (!role || (review && role !== "admin" && role !== "coach"))
      throw new ApiError(
        403,
        "Your current authorization does not permit this action.",
        "WAGGLE_AUTHORIZATION_REQUIRED",
      );
  }
  async function headFor(tx: FirebaseFirestore.Transaction, id: string) {
    const document = await tx.get(heads.doc(id));
    if (!document.exists) missing();
    return readCommunityHead(document.data(), id);
  }
  async function revisionFor(
    tx: FirebaseFirestore.Transaction,
    head: CommunityHead,
    revision: number,
  ) {
    const document = await tx.get(
      heads.doc(head.id).collection("revisions").doc(String(revision)),
    );
    if (!document.exists) unavailable();
    return readCommunityRevision(document.data(), head.id, revision);
  }
  async function publishedFor(
    tx: FirebaseFirestore.Transaction,
    head: CommunityHead,
  ) {
    if (
      head.isDeleted ||
      head.visibility !== "published" ||
      head.publishedRevision === null
    )
      missing();
    const revision = await revisionFor(tx, head, head.publishedRevision);
    const card = communityCard(revision);
    // Never publish candidate text or trust a denormalized card that drifted from review.
    if (!isDeepStrictEqual(card, head.publishedCard)) unavailable();
    return { card, level: parseLevelFile(revision.levelText) };
  }

  async function browse(value: unknown = {}): Promise<CommunityPage> {
    const parsed = FiltersSchema.safeParse(value);
    if (!parsed.success) invalid();
    const filters = parsed.data;
    const binding = filterHash(filters);
    const cursor = decodeCursor(filters.cursor, "public", binding);
    let query = heads
      .where("isDeleted", "==", false)
      .where("visibility", "==", "published");
    if (filters.mechanic)
      query = query.where(
        "publishedCard.mechanics",
        "array-contains",
        filters.mechanic,
      );
    if (filters.difficulty)
      query = query.where("publishedCard.difficulty", "==", filters.difficulty);
    if (filters.estimatedLength)
      query = query.where(
        "publishedCard.estimatedLength",
        "==",
        filters.estimatedLength,
      );
    query = query
      .orderBy("publishedAt", "desc")
      .orderBy(FieldPath.documentId(), "asc");
    if (cursor) query = query.startAfter(cursor.time, cursor.id);
    return db.runTransaction(
      async (tx) => {
        const page = await tx.get(query.limit(COMMUNITY_PAGE_SIZE + 1));
        const saved = page.docs
          .slice(0, COMMUNITY_PAGE_SIZE)
          .map((document) => readCommunityHead(document.data(), document.id));
        const gardens = await Promise.all(
          saved.map(async (head) => (await publishedFor(tx, head)).card),
        );
        const last = saved.at(-1);
        return {
          gardens,
          nextCursor:
            page.size > COMMUNITY_PAGE_SIZE && last
              ? encodeCursor({
                  scope: "public",
                  time: last.publishedAt!,
                  id: last.id,
                  filters: binding,
                })
              : null,
        };
      },
      { readOnly: true },
    );
  }

  async function get(rawId: unknown): Promise<CommunityGarden> {
    const id = communityId(rawId);
    return db.runTransaction(
      async (tx) => {
        const head = await headFor(tx, id);
        const { card, level } = await publishedFor(tx, head);
        const garden: CommunityGarden = { ...card, level };
        if (head.parent) {
          const source = await tx.get(heads.doc(head.parent.id));
          if (source.exists) {
            const parent = readCommunityHead(source.data(), source.id);
            if (
              !parent.isDeleted &&
              parent.visibility === "published" &&
              parent.createdAt === head.parent.createdAt
            ) {
              const approved = await publishedFor(tx, parent);
              garden.parent = {
                id: parent.id,
                title: approved.card.title,
                nickname: approved.card.nickname,
              };
            }
          }
        }
        return garden;
      },
      { readOnly: true },
    );
  }

  async function mine(actorUid: string): Promise<OwnedCommunityGarden[]> {
    return db.runTransaction(
      async (tx) => {
        await requireActor(tx, actorUid, false);
        const page = await tx.get(
          heads
            .where("ownerUid", "==", actorUid)
            .where("isDeleted", "==", false)
            .limit(COMMUNITY_MAX_HEADS + 1),
        );
        if (page.size > COMMUNITY_MAX_HEADS) unavailable();
        const saved = page.docs.map((document) =>
          readCommunityHead(document.data(), document.id),
        );
        if (saved.some((head) => head.ownerUid !== actorUid || head.isDeleted))
          unavailable();
        return saved
          .sort(
            (a, b) =>
              b.updatedAt.localeCompare(a.updatedAt) ||
              a.id.localeCompare(b.id),
          )
          .map(ownedCommunityGarden);
      },
      { readOnly: true },
    );
  }

  async function getOwn(
    actorUid: string,
    rawId: unknown,
  ): Promise<OwnedCommunityRevision> {
    const id = communityId(rawId);
    return db.runTransaction(
      async (tx) => {
        await requireActor(tx, actorUid, false);
        const head = await headFor(tx, id);
        if (head.ownerUid !== actorUid || head.isDeleted) missing();
        const pointer = head.candidateRevision ?? head.publishedRevision;
        if (pointer === null) missing();
        const revision = await revisionFor(tx, head, pointer);
        return {
          garden: ownedCommunityGarden(head),
          level: parseLevelFile(revision.levelText),
          metadata: {
            nickname: revision.metadata.nickname,
            difficulty: revision.metadata.difficulty,
            estimatedLength: revision.metadata.estimatedLength,
          },
        };
      },
      { readOnly: true },
    );
  }

  async function pending(actorUid: string, value: unknown = {}) {
    const parsed = z
      .object({ cursor: cursorValue.optional() })
      .strict()
      .safeParse(value);
    if (!parsed.success) invalid();
    const binding = filterHash({});
    const cursor = decodeCursor(parsed.data.cursor, "pending", binding);
    let query = heads
      .where("isDeleted", "==", false)
      .where("candidateStatus", "==", "pending")
      .orderBy("updatedAt", "desc")
      .orderBy(FieldPath.documentId(), "asc");
    if (cursor) query = query.startAfter(cursor.time, cursor.id);
    return db.runTransaction(
      async (tx) => {
        await requireActor(tx, actorUid, true);
        const page = await tx.get(query.limit(COMMUNITY_PAGE_SIZE + 1));
        const saved = page.docs
          .slice(0, COMMUNITY_PAGE_SIZE)
          .map((document) => readCommunityHead(document.data(), document.id));
        if (
          saved.some(
            (head) => head.isDeleted || head.candidateStatus !== "pending",
          )
        )
          unavailable();
        const last = saved.at(-1);
        return {
          gardens: saved.map(ownedCommunityGarden),
          nextCursor:
            page.size > COMMUNITY_PAGE_SIZE && last
              ? encodeCursor({
                  scope: "pending",
                  time: last.updatedAt,
                  id: last.id,
                  filters: binding,
                })
              : null,
        };
      },
      { readOnly: true },
    );
  }

  async function review(
    actorUid: string,
    rawId: unknown,
  ): Promise<CommunityReview> {
    const id = communityId(rawId);
    return db.runTransaction(
      async (tx) => {
        await requireActor(tx, actorUid, true);
        const head = await headFor(tx, id);
        if (
          head.isDeleted ||
          head.candidateStatus !== "pending" ||
          head.candidateRevision === null
        )
          missing();
        const revision = await revisionFor(tx, head, head.candidateRevision);
        return {
          garden: ownedCommunityGarden(head),
          candidate: {
            ...communityCard(revision),
            level: parseLevelFile(revision.levelText),
          },
          reviewDigest: revision.reviewDigest,
          allBeesProven: revision.verification.allBeesProven,
          bestPollen: revision.verification.bestPollen,
          fewestTools: revision.verification.fewestTools,
        };
      },
      { readOnly: true },
    );
  }
  return { browse, get, mine, getOwn, pending, review };
}
