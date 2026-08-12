import { createHmac } from "node:crypto";
import { NextFunction, RequestHandler, Response } from "express";
import { adminDb } from "../lib/firebase-admin";
import { AuthenticatedRequest } from "./auth";
import { ApiError } from "./errorHandler";

const QUOTA_COLLECTION = "internal_api_quotas";
const DEFAULT_RETENTION_MS = 24 * 60 * 60 * 1000;
const QUOTA_ERROR_CODE = "DISTRIBUTED_QUOTA_EXCEEDED";

export interface DistributedQuotaOptions {
  scope: string;
  limit: number;
  windowMs: number;
  retentionMs?: number;
}

function quotaDocumentId(scope: string, uid: string, windowStartedAtMs: number): string {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret || secret.length < 32) {
    throw new ApiError(503, "Request quota service is unavailable.", "QUOTA_UNAVAILABLE");
  }

  return createHmac("sha256", secret)
    .update(`aresweb-api-quota:v1:${scope}:${uid}:${windowStartedAtMs}`)
    .digest("hex");
}

function assertValidOptions(options: DistributedQuotaOptions): void {
  if (
    !/^[a-z0-9][a-z0-9-]{0,79}$/.test(options.scope)
    || !Number.isSafeInteger(options.limit)
    || options.limit < 1
    || !Number.isSafeInteger(options.windowMs)
    || options.windowMs < 1_000
    || (options.retentionMs !== undefined && (
      !Number.isSafeInteger(options.retentionMs) || options.retentionMs < 0
    ))
  ) {
    throw new Error("Invalid distributed quota configuration.");
  }
}

/**
 * Enforces a fixed-window quota in a Firestore transaction so requests cannot
 * multiply their allowance by reaching different Cloud Functions instances.
 *
 * Mount this only after authorization middleware. Documents contain no raw UID
 * or IP address, and `expiresAt` can be configured as a Firestore TTL field.
 */
export function distributedQuota(options: DistributedQuotaOptions): RequestHandler {
  assertValidOptions(options);
  const retentionMs = options.retentionMs ?? DEFAULT_RETENTION_MS;

  return async function enforceDistributedQuota(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const uid = req.user?.uid;
    if (!uid) {
      next(new ApiError(401, "Unauthorized: Missing verified identity"));
      return;
    }

    const nowMs = Date.now();
    const windowStartedAtMs = Math.floor(nowMs / options.windowMs) * options.windowMs;
    const windowEndsAtMs = windowStartedAtMs + options.windowMs;

    try {
      const documentId = quotaDocumentId(options.scope, uid, windowStartedAtMs);
      const quotaRef = adminDb.collection(QUOTA_COLLECTION).doc(documentId);

      await adminDb.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(quotaRef);
        const storedCount = snapshot.exists ? snapshot.data()?.count : 0;
        if (!Number.isSafeInteger(storedCount) || storedCount < 0) {
          throw new ApiError(503, "Request quota service is unavailable.", "QUOTA_STATE_INVALID");
        }
        const count = storedCount as number;

        if (count >= options.limit) {
          throw new ApiError(
            429,
            "This operation has reached its temporary request limit. Please try again later.",
            QUOTA_ERROR_CODE,
          );
        }

        transaction.set(quotaRef, {
          count: count + 1,
          windowStartedAt: new Date(windowStartedAtMs),
          updatedAt: new Date(nowMs),
          expiresAt: new Date(windowEndsAtMs + retentionMs),
        }, { merge: true });
      });

      next();
    } catch (error) {
      if (error instanceof ApiError && error.code === QUOTA_ERROR_CODE) {
        res.setHeader("Retry-After", String(Math.max(1, Math.ceil((windowEndsAtMs - nowMs) / 1_000))));
      }
      next(error);
    }
  };
}
