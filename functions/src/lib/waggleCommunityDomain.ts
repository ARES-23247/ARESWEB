import { createHash } from "node:crypto";
import { z } from "zod";
import type {
  CommunityCard,
  CommunityMetadata,
  OwnedCommunityGarden,
} from "../generated/games/waggle-way/community";
import {
  GARDEN_THEMES,
  MAX_LEVEL_BYTES,
  OBJECT_KINDS,
  parseLevelFile,
  serializeLevel,
  validateLevel,
  type LevelDefinition,
} from "../generated/games/waggle-way/level";
import { ApiError } from "../middleware/errorHandler";
import {
  WAGGLE_VERIFIER_VERSION,
  WaggleVerificationSchema,
  type WaggleVerification,
} from "./waggleProof";

export const COMMUNITY_PAGE_SIZE = 12;
export const COMMUNITY_MAX_HEADS = 20;
export const COMMUNITY_MAX_PENDING = 3;
export const CommunityIdSchema = z.string().uuid();
export const CommunityReasonSchema = z.enum([
  "text",
  "identity",
  "unsafe",
  "misleading",
  "other",
]);
export const CommunityMetadataSchema = z
  .object({
    nickname: z
      .string()
      .trim()
      .min(1)
      .max(24)
      .regex(/^[^\p{Cc}\p{Cf}<>]+$/u),
    difficulty: z.enum(["gentle", "moderate", "challenging"]),
    estimatedLength: z.enum(["short", "medium", "long"]),
  })
  .strict();
const revisionNumber = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const digest = z.string().regex(/^[a-f0-9]{64}$/u);
export const CommunityParentSchema = z
  .object({ id: CommunityIdSchema, revision: revisionNumber })
  .strict();
const optionalObjectives = z
  .object({
    pollen: z.number().int().min(0).max(512),
    maxTools: z.number().int().min(0).max(512).optional(),
  })
  .strict();
export const CommunityCardSchema = CommunityMetadataSchema.extend({
  id: CommunityIdSchema,
  revision: revisionNumber,
  title: z.string().min(1).max(80),
  theme: z.enum(GARDEN_THEMES),
  mechanics: z.array(z.enum(OBJECT_KINDS)).max(OBJECT_KINDS.length),
  population: z.number().int().min(1).max(100),
  rescueTarget: z.number().int().min(1).max(100),
  objectives: optionalObjectives.optional(),
}).strict();
const HeadSchema = z
  .object({
    schema: z.literal(1),
    id: CommunityIdSchema,
    ownerUid: z.string().min(1).max(128),
    version: revisionNumber,
    title: z.string().max(80),
    isDeleted: z.boolean(),
    visibility: z.enum(["private", "published", "removed", "deleted"]),
    publishedRevision: revisionNumber.nullable(),
    candidateRevision: revisionNumber.nullable(),
    candidateStatus: z.enum(["pending", "rejected"]).nullable(),
    publishedCard: CommunityCardSchema.nullable(),
    reviewReason: CommunityReasonSchema.nullable(),
    parent: CommunityParentSchema.extend({
      contentHash: digest,
      createdAt: z.string().datetime(),
    })
      .strict()
      .nullable(),
    publishedAt: z.string().datetime().nullable(),
    retireAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type CommunityHead = z.infer<typeof HeadSchema>;
const RevisionSchema = z
  .object({
    schema: z.literal(1),
    id: CommunityIdSchema,
    revision: revisionNumber,
    levelText: z.string().max(MAX_LEVEL_BYTES),
    metadata: CommunityMetadataSchema,
    verification: WaggleVerificationSchema,
    reviewDigest: digest,
  })
  .strict();
export type CommunityRevision = z.infer<typeof RevisionSchema>;

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const unavailable = () =>
  new ApiError(
    503,
    "This garden's saved revision is unavailable.",
    "WAGGLE_RECORD_UNAVAILABLE",
  );

export function communityId(value: unknown): string {
  const parsed = CommunityIdSchema.safeParse(value);
  if (!parsed.success)
    throw new ApiError(
      400,
      "Invalid community garden identifier.",
      "WAGGLE_ID_INVALID",
    );
  return parsed.data;
}

export function readCommunityHead(
  value: unknown,
  expectedId: string,
): CommunityHead {
  const result = HeadSchema.safeParse(value);
  if (!result.success) throw unavailable();
  const head = result.data;
  if (
    head.id !== expectedId ||
    (!head.isDeleted && head.title.length === 0) ||
    (head.visibility === "published") !== (head.publishedAt !== null) ||
    (head.candidateStatus === "rejected" || head.visibility === "removed") !==
      (head.reviewReason !== null) ||
    Date.parse(head.updatedAt) < Date.parse(head.createdAt) ||
    (head.visibility === "private" && head.candidateRevision === null) ||
    (head.candidateRevision !== null &&
      head.publishedRevision !== null &&
      head.candidateRevision <= head.publishedRevision) ||
    head.isDeleted !== (head.visibility === "deleted") ||
    head.isDeleted !== (head.retireAt !== null) ||
    (head.visibility === "published") !== (head.publishedRevision !== null) ||
    (head.publishedRevision === null) !== (head.publishedCard === null) ||
    (head.candidateRevision === null) !== (head.candidateStatus === null) ||
    (head.publishedRevision !== null &&
      head.publishedRevision > head.version) ||
    (head.candidateRevision !== null &&
      head.candidateRevision > head.version) ||
    (head.publishedCard &&
      (head.publishedCard.id !== head.id ||
        head.publishedCard.revision !== head.publishedRevision ||
        head.publishedCard.rescueTarget > head.publishedCard.population)) ||
    ((head.visibility === "removed" || head.isDeleted) &&
      head.candidateRevision !== null) ||
    (head.isDeleted && (head.title !== "" || head.parent !== null)) ||
    head.parent?.id === head.id
  )
    throw unavailable();
  return head;
}

function reviewDigest(
  id: string,
  revision: number,
  metadata: CommunityMetadata,
  verification: WaggleVerification,
): string {
  return sha256(
    JSON.stringify({
      id,
      revision,
      nickname: metadata.nickname,
      difficulty: metadata.difficulty,
      estimatedLength: metadata.estimatedLength,
      binding: verification.bindingHash,
    }),
  );
}

function proofMatches(
  level: LevelDefinition,
  canonical: string,
  proof: WaggleVerification,
): boolean {
  const pollen = level.objects.filter(
    (object) => object.kind === "pollen",
  ).length;
  const stock = (level.inventory ?? []).reduce(
    (total, entry) => total + entry.count,
    0,
  );
  return (
    proof.contentHash === sha256(canonical) &&
    proof.rulesVersion === level.rulesVersion &&
    proof.bindingHash ===
      sha256(
        `${WAGGLE_VERIFIER_VERSION}\n${level.rulesVersion}\n${proof.contentHash}`,
      ) &&
    proof.bestRescued ===
      Math.max(...proof.witnesses.map((witness) => witness.rescued)) &&
    proof.bestPollen ===
      Math.max(...proof.witnesses.map((witness) => witness.pollenDelivered)) &&
    proof.fewestTools ===
      Math.min(...proof.witnesses.map((witness) => witness.peakTools)) &&
    proof.allBeesProven === (proof.bestRescued === level.population) &&
    new Set(proof.witnesses.map((witness) => witness.replayHash)).size ===
      proof.witnesses.length &&
    proof.witnesses.every(
      (witness) =>
        witness.rescued >= level.rescueTarget &&
        witness.rescued <= level.population &&
        witness.pollenDelivered <= pollen &&
        witness.peakTools <= stock,
    ) &&
    proof.bestPollen >= (level.objectives?.pollen ?? 0) &&
    (level.objectives?.maxTools === undefined ||
      proof.fewestTools <= level.objectives.maxTools)
  );
}

/** The caller must obtain verification from the server worker, never a request field. */
export function prepareCommunityRevision(
  id: string,
  revision: number,
  metadataValue: unknown,
  levelValue: unknown,
  verificationValue: unknown,
): CommunityRevision {
  const metadata = CommunityMetadataSchema.safeParse(metadataValue);
  if (!metadata.success)
    throw new ApiError(
      400,
      "Choose a short nickname, difficulty and estimated length.",
      "WAGGLE_METADATA_INVALID",
    );
  let canonical: string;
  let level: LevelDefinition;
  try {
    canonical = serializeLevel(validateLevel(levelValue));
    level = parseLevelFile(canonical);
  } catch {
    throw new ApiError(
      400,
      "Choose a supported garden file.",
      "WAGGLE_LEVEL_INVALID",
    );
  }
  const proof = WaggleVerificationSchema.safeParse(verificationValue);
  if (!proof.success || !proofMatches(level, canonical, proof.data))
    throw unavailable();
  const result = RevisionSchema.safeParse({
    schema: 1,
    id,
    revision,
    levelText: canonical,
    metadata: metadata.data,
    verification: proof.data,
    reviewDigest: reviewDigest(id, revision, metadata.data, proof.data),
  });
  if (!result.success) throw unavailable();
  return result.data;
}

export function readCommunityRevision(
  value: unknown,
  expectedId: string,
  expectedRevision: number,
): CommunityRevision {
  const result = RevisionSchema.safeParse(value);
  if (
    !result.success ||
    result.data.id !== expectedId ||
    result.data.revision !== expectedRevision
  )
    throw unavailable();
  const saved = result.data;
  let level: LevelDefinition;
  try {
    level = parseLevelFile(saved.levelText);
  } catch {
    throw unavailable();
  }
  const canonical = serializeLevel(level);
  if (
    saved.levelText !== canonical ||
    !proofMatches(level, canonical, saved.verification) ||
    saved.reviewDigest !==
      reviewDigest(saved.id, saved.revision, saved.metadata, saved.verification)
  )
    throw unavailable();
  return saved;
}

export function communityCard(revision: CommunityRevision): CommunityCard {
  const level = parseLevelFile(revision.levelText);
  const legacyTheme = level.id.split("-")[0];
  const theme =
    level.theme ??
    (legacyTheme === "meadow" ||
    legacyTheme === "rainy" ||
    legacyTheme === "glasshouse"
      ? legacyTheme
      : "sunny");
  const mechanics = [
    ...new Set([
      ...level.objects.map((object) => object.kind),
      ...(level.inventory ?? []).map((stock) => stock.kind),
    ]),
  ]
    .filter((kind) => kind !== "hive" && kind !== "flowers")
    .sort();
  return {
    id: revision.id,
    revision: revision.revision,
    title: level.title,
    nickname: revision.metadata.nickname,
    difficulty: revision.metadata.difficulty,
    estimatedLength: revision.metadata.estimatedLength,
    theme,
    mechanics,
    population: level.population,
    rescueTarget: level.rescueTarget,
    ...(level.objectives
      ? {
          objectives: {
            pollen: level.objectives.pollen,
            ...(level.objectives.maxTools === undefined
              ? {}
              : { maxTools: level.objectives.maxTools }),
          },
        }
      : {}),
  };
}

export function ownedCommunityGarden(
  head: CommunityHead,
): OwnedCommunityGarden {
  return {
    id: head.id,
    version: head.version,
    title: head.title,
    publishedRevision: head.publishedRevision,
    candidateRevision: head.candidateRevision,
    status:
      head.visibility === "deleted" || head.visibility === "removed"
        ? head.visibility
        : (head.candidateStatus ?? "published"),
    reviewReason: head.reviewReason,
  };
}
