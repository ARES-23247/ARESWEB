import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import express from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { adminDb } from "../lib/firebase-admin";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";

const router = express.Router();

const INSTALLATION_COLLECTION = "studio_integrations";
const RECEIPT_COLLECTION = "studio_integration_receipts";
const QUOTA_COLLECTION = "studio_integration_quotas";
const TOKEN_PATTERN = /^ares_studio_([a-z0-9][a-z0-9-]{2,63})\.([A-Za-z0-9_-]{32,128})$/u;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/u;
const INSTALLATION_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,63}$/u;
const HOURLY_INSTALLATION_LIMIT = 120;
const ONE_HOUR_MS = 60 * 60 * 1_000;
const RECEIPT_RETENTION_MS = 90 * 24 * ONE_HOUR_MS;

const studioIngressLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many Studio integration requests. Try again later." },
});

const workspaceSchema = z.object({
  teamId: z.string().trim().min(1).max(80),
  seasonId: z.string().trim().min(1).max(80),
  robotId: z.string().trim().min(1).max(120),
}).strict();

const evidenceSchema = z.object({
  kind: z.string().trim().min(1).max(80),
  referenceId: z.string().trim().min(1).max(300),
  sha256: z.string().regex(DIGEST_PATTERN).optional(),
  label: z.string().trim().min(1).max(300).optional(),
  uri: z.string().trim().url().max(4_096).optional(),
}).strict();

const aiProvenanceSchema = z.object({
  provider: z.string().trim().min(1).max(120),
  model: z.string().trim().min(1).max(200),
  promptSchemaVersion: z.number().int().min(1).max(10_000),
  generatedAtMs: z.number().int().nonnegative(),
  evidenceHashes: z.array(z.string().regex(DIGEST_PATTERN)).max(100).default([]),
}).strict();

const notebookEntrySchema = z.object({
  entryId: z.string().trim().min(1).max(160),
  revision: z.number().int().min(1).max(1_000_000),
  entryType: z.enum(["SESSION_SUMMARY", "ROBOT_ISSUE", "SOFTWARE_CHANGE", "ENGINEERING_NOTE"]),
  workspace: workspaceSchema,
  markdownBody: z.string().min(1).max(750_000),
  evidence: z.array(evidenceSchema).max(100).default([]),
  visibility: z.enum(["PRIVATE", "TEAM", "PUBLIC_CANDIDATE"]).default("PRIVATE"),
  reviewState: z.enum(["DRAFT", "REVIEWED", "APPROVED", "SUBMITTED", "PUBLISHED", "REJECTED", "SUPERSEDED"]),
  humanAuthorId: z.string().trim().min(1).max(160).optional(),
  humanReviewerId: z.string().trim().min(1).max(160).optional(),
  aiProvenance: aiProvenanceSchema.optional(),
  contentHash: z.string().regex(DIGEST_PATTERN),
  createdAtMs: z.number().int().nonnegative(),
  updatedAtMs: z.number().int().nonnegative(),
  schemaVersion: z.literal(1),
}).strict();

export type StudioNotebookEntry = z.infer<typeof notebookEntrySchema>;

interface StudioInstallation {
  installationId?: unknown;
  tokenSalt?: unknown;
  tokenHash?: unknown;
  status?: unknown;
  scopes?: unknown;
  allowedTeamIds?: unknown;
  allowedWorkspaceIds?: unknown;
  expiresAt?: unknown;
}

interface StudioReceipt {
  draftId?: unknown;
  reviewUrl?: unknown;
  contentHash?: unknown;
}

function integrationSecret(): string {
  const secret = process.env.ABUSE_HMAC_SECRET;
  if (!secret || secret.length < 32) {
    throw new ApiError(503, "Studio integration authentication is unavailable.", "STUDIO_AUTH_UNAVAILABLE");
  }
  return secret;
}

export function hashStudioToken(salt: string, tokenSecret: string, key = integrationSecret()): string {
  return createHmac("sha256", key)
    .update(`aresweb-studio-token:v1:${salt}:${tokenSecret}`)
    .digest("hex");
}

function opaqueDocumentId(domain: string, value: string): string {
  return createHmac("sha256", integrationSecret())
    .update(`aresweb-${domain}:v1:${value}`)
    .digest("hex");
}

function constantTimeDigestEquals(left: string, right: string): boolean {
  if (!DIGEST_PATTERN.test(left) || !DIGEST_PATTERN.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function canonicalHashMaterial(entry: StudioNotebookEntry): Record<string, unknown> {
  return {
    schemaVersion: entry.schemaVersion,
    entryId: entry.entryId,
    revision: entry.revision,
    entryType: entry.entryType,
    workspace: {
      teamId: entry.workspace.teamId,
      seasonId: entry.workspace.seasonId,
      robotId: entry.workspace.robotId,
    },
    markdownBody: entry.markdownBody,
    evidence: entry.evidence.map((evidence) => ({
      kind: evidence.kind,
      referenceId: evidence.referenceId,
      ...(evidence.sha256 === undefined ? {} : { sha256: evidence.sha256 }),
      ...(evidence.label === undefined ? {} : { label: evidence.label }),
      ...(evidence.uri === undefined ? {} : { uri: evidence.uri }),
    })),
    visibility: entry.visibility,
    ...(entry.humanAuthorId === undefined ? {} : { humanAuthorId: entry.humanAuthorId }),
    ...(entry.aiProvenance === undefined ? {} : {
      aiProvenance: {
        provider: entry.aiProvenance.provider,
        model: entry.aiProvenance.model,
        promptSchemaVersion: entry.aiProvenance.promptSchemaVersion,
        generatedAtMs: entry.aiProvenance.generatedAtMs,
        ...(entry.aiProvenance.evidenceHashes.length === 0
          ? {}
          : { evidenceHashes: entry.aiProvenance.evidenceHashes }),
      },
    }),
  };
}

export function studioNotebookContentHash(entry: StudioNotebookEntry): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalHashMaterial(entry)))
    .digest("hex");
}

function parseAuthorization(header: string | undefined): { installationId: string; tokenSecret: string } {
  if (!header?.startsWith("Bearer ")) {
    throw new ApiError(401, "A Studio installation token is required.", "STUDIO_TOKEN_REQUIRED");
  }
  const match = TOKEN_PATTERN.exec(header.slice("Bearer ".length).trim());
  if (!match || !INSTALLATION_ID_PATTERN.test(match[1])) {
    throw new ApiError(401, "The Studio installation token is invalid.", "STUDIO_TOKEN_INVALID");
  }
  return { installationId: match[1], tokenSecret: match[2] };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : [];
}

function assertInstallationAuthorized(
  installationId: string,
  tokenSecret: string,
  data: StudioInstallation,
  entry?: StudioNotebookEntry,
): void {
  const salt = typeof data.tokenSalt === "string" ? data.tokenSalt : "";
  const storedHash = typeof data.tokenHash === "string" ? data.tokenHash : "";
  const expectedHash = hashStudioToken(salt, tokenSecret);
  if (
    data.installationId !== installationId
    || data.status !== "active"
    || !constantTimeDigestEquals(storedHash, expectedHash)
  ) {
    throw new ApiError(401, "The Studio installation token is invalid or inactive.", "STUDIO_TOKEN_INVALID");
  }
  if (typeof data.expiresAt === "string" && Date.parse(data.expiresAt) <= Date.now()) {
    throw new ApiError(401, "The Studio installation token has expired.", "STUDIO_TOKEN_EXPIRED");
  }
  if (!stringArray(data.scopes).includes("notebook:draft:create")) {
    throw new ApiError(403, "This installation cannot create notebook drafts.", "STUDIO_SCOPE_REQUIRED");
  }
  if (!entry) return;

  const workspaceId = `${entry.workspace.teamId}/${entry.workspace.seasonId}/${entry.workspace.robotId}`;
  const teamAllowed = stringArray(data.allowedTeamIds).includes(entry.workspace.teamId);
  const workspaceAllowed = stringArray(data.allowedWorkspaceIds).includes(workspaceId);
  if (!teamAllowed && !workspaceAllowed) {
    throw new ApiError(403, "This installation cannot publish for the requested workspace.", "STUDIO_WORKSPACE_FORBIDDEN");
  }
}

function postTitle(entry: StudioNotebookEntry): string {
  const heading = entry.markdownBody
    .split(/\r?\n/u)
    .map((line) => line.match(/^#{1,3}\s+(.+)$/u)?.[1]?.trim())
    .find((line): line is string => Boolean(line));
  if (heading) return heading.slice(0, 200);
  return ({
    SESSION_SUMMARY: "Robot session summary",
    ROBOT_ISSUE: "Robot issue investigation",
    SOFTWARE_CHANGE: "Software change summary",
    ENGINEERING_NOTE: "Engineering notebook entry",
  } as const)[entry.entryType];
}

function postDescription(entry: StudioNotebookEntry): string {
  return entry.markdownBody
    .replace(/^#{1,6}\s+/gmu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 500);
}

function draftId(entry: StudioNotebookEntry): string {
  const safeEntryId = entry.entryId.toLowerCase().replace(/[^a-z0-9_-]+/gu, "-")
    .replace(/^-+|-+$/gu, "").slice(0, 180) || "entry";
  return `studio-${safeEntryId}-r${entry.revision}-${entry.contentHash.slice(0, 12)}`;
}

function reviewUrl(id: string): string {
  return `https://aresfirst.org/dashboard/blog?edit=${encodeURIComponent(id)}`;
}

function receiptResponse(receipt: StudioReceipt, duplicate: boolean) {
  if (
    typeof receipt.draftId !== "string"
    || typeof receipt.reviewUrl !== "string"
    || typeof receipt.contentHash !== "string"
  ) {
    throw new ApiError(503, "The Studio integration receipt is invalid.", "STUDIO_RECEIPT_INVALID");
  }
  return {
    draftId: receipt.draftId,
    reviewUrl: receipt.reviewUrl,
    contentHash: receipt.contentHash,
    duplicate,
  };
}

router.post(
  "/v1/notebook-drafts",
  studioIngressLimiter,
  asyncHandler(async (req, res) => {
    if (!req.is("application/json")) {
      throw new ApiError(415, "Content-Type must be application/json.", "STUDIO_CONTENT_TYPE_REQUIRED");
    }
    const parsed = notebookEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "The notebook draft payload is invalid.", "STUDIO_PAYLOAD_INVALID");
    }
    const entry = parsed.data;
    if (entry.reviewState !== "APPROVED") {
      throw new ApiError(409, "Only human-approved notebook entries may be submitted.", "STUDIO_APPROVAL_REQUIRED");
    }
    const computedHash = studioNotebookContentHash(entry);
    if (!constantTimeDigestEquals(entry.contentHash, computedHash)) {
      throw new ApiError(409, "The notebook content hash does not match the submitted content.", "STUDIO_CONTENT_HASH_MISMATCH");
    }
    const idempotencyKey = req.get("Idempotency-Key")?.trim();
    if (idempotencyKey !== `${entry.entryId}:${entry.contentHash}`) {
      throw new ApiError(400, "A matching Idempotency-Key is required.", "STUDIO_IDEMPOTENCY_KEY_INVALID");
    }

    const token = parseAuthorization(req.get("Authorization"));
    const installationRef = adminDb.collection(INSTALLATION_COLLECTION).doc(token.installationId);
    const installationSnapshot = await installationRef.get();
    if (!installationSnapshot.exists) {
      throw new ApiError(401, "The Studio installation token is invalid or inactive.", "STUDIO_TOKEN_INVALID");
    }
    assertInstallationAuthorized(
      token.installationId,
      token.tokenSecret,
      installationSnapshot.data() as StudioInstallation,
      entry,
    );

    const now = new Date();
    const nowIso = now.toISOString();
    const windowStartedAtMs = Math.floor(now.getTime() / ONE_HOUR_MS) * ONE_HOUR_MS;
    const receiptRef = adminDb.collection(RECEIPT_COLLECTION)
      .doc(opaqueDocumentId("studio-receipt", `${token.installationId}:${idempotencyKey}`));
    const quotaRef = adminDb.collection(QUOTA_COLLECTION)
      .doc(opaqueDocumentId("studio-quota", `${token.installationId}:${windowStartedAtMs}`));
    const id = draftId(entry);
    const postRef = adminDb.collection("posts").doc(id);
    const revisionRef = postRef.collection("revisions").doc(`studio-r${entry.revision}-${entry.contentHash.slice(0, 12)}`);
    const auditRef = adminDb.collection("audit_logs").doc();

    const result = await adminDb.runTransaction(async (transaction) => {
      const [currentInstallation, existingReceipt, quotaSnapshot, existingPost] = await Promise.all([
        transaction.get(installationRef),
        transaction.get(receiptRef),
        transaction.get(quotaRef),
        transaction.get(postRef),
      ]);
      if (!currentInstallation.exists) {
        throw new ApiError(401, "The Studio installation token is invalid or inactive.", "STUDIO_TOKEN_INVALID");
      }
      assertInstallationAuthorized(
        token.installationId,
        token.tokenSecret,
        currentInstallation.data() as StudioInstallation,
        entry,
      );
      if (existingReceipt.exists) {
        return receiptResponse(existingReceipt.data() as StudioReceipt, true);
      }

      const storedCount = quotaSnapshot.exists ? quotaSnapshot.data()?.count : 0;
      if (!Number.isSafeInteger(storedCount) || storedCount < 0) {
        throw new ApiError(503, "The Studio integration quota is unavailable.", "STUDIO_QUOTA_INVALID");
      }
      if (storedCount >= HOURLY_INSTALLATION_LIMIT) {
        throw new ApiError(429, "This Studio installation has reached its hourly draft limit.", "STUDIO_QUOTA_EXCEEDED");
      }
      if (existingPost.exists && existingPost.data()?.studioContentHash !== entry.contentHash) {
        throw new ApiError(409, "The generated notebook draft identifier is already in use.", "STUDIO_DRAFT_CONFLICT");
      }

      const url = reviewUrl(id);
      const response = { draftId: id, reviewUrl: url, contentHash: entry.contentHash, duplicate: false };
      const author = entry.humanAuthorId || "ARES Robotics Studio";
      transaction.set(quotaRef, {
        count: storedCount + 1,
        windowStartedAt: new Date(windowStartedAtMs),
        updatedAt: now,
        expiresAt: new Date(windowStartedAtMs + ONE_HOUR_MS + 24 * ONE_HOUR_MS),
      }, { merge: true });
      transaction.set(postRef, {
        title: postTitle(entry),
        category: "Engineering Notebook",
        sortOrder: 0,
        description: postDescription(entry),
        content: entry.markdownBody,
        status: "pending_approval",
        approvalStatus: "pending_approval",
        isDeleted: 0,
        displayInAreslib: 0,
        displayInMathCorner: 0,
        displayInScienceCorner: 0,
        isPortfolio: 0,
        isExecutiveSummary: 0,
        author,
        date: nowIso.slice(0, 10),
        thumbnail: "",
        mediaPhotoIds: [],
        createdAt: nowIso,
        updatedAt: nowIso,
        importedFrom: "ares-robotics-studio",
        studioEntryId: entry.entryId,
        studioRevision: entry.revision,
        studioContentHash: entry.contentHash,
        studioWorkspace: entry.workspace,
        studioVisibility: entry.visibility,
        studioEvidence: entry.evidence,
        ...(entry.aiProvenance ? { studioAiProvenance: entry.aiProvenance } : {}),
      });
      transaction.set(revisionRef, {
        title: postTitle(entry),
        category: "Engineering Notebook",
        sortOrder: 0,
        description: postDescription(entry),
        content: entry.markdownBody,
        status: "pending_approval",
        displayInAreslib: 0,
        displayInMathCorner: 0,
        displayInScienceCorner: 0,
        isPortfolio: 0,
        isExecutiveSummary: 0,
        author,
        date: nowIso.slice(0, 10),
        thumbnail: "",
        mediaPhotoIds: [],
        editedBy: "ares-robotics-studio",
        editedByName: "ARES Robotics Studio",
        editedByAvatar: "",
        timestamp: nowIso,
      });
      transaction.set(receiptRef, {
        installationId: token.installationId,
        entryId: entry.entryId,
        revision: entry.revision,
        draftId: id,
        reviewUrl: url,
        contentHash: entry.contentHash,
        createdAt: now,
        expiresAt: new Date(now.getTime() + RECEIPT_RETENTION_MS),
      });
      transaction.set(auditRef, {
        action: "studio.notebook-draft.created",
        installationId: token.installationId,
        teamId: entry.workspace.teamId,
        draftId: id,
        entryType: entry.entryType,
        contentHash: entry.contentHash,
        createdAt: nowIso,
      });
      return response;
    });

    res.set("Cache-Control", "no-store");
    if (!result.duplicate) res.status(201);
    res.json(result);
  }),
);

export default router;
