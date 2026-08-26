import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { NextFunction, RequestHandler, Response } from "express";
import { adminDb } from "../lib/firebase-admin";
import { logger } from "../lib/logger";
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
  identity?: "user" | "ip" | "global";
  secretEnvironmentVariable?: "ENCRYPTION_SECRET" | "ABUSE_HMAC_SECRET";
  cost?: number | ((req: AuthenticatedRequest) => number);
}

function quotaDocumentId(
  scope: string,
  identity: string,
  windowStartedAtMs: number,
  secretEnvironmentVariable: "ENCRYPTION_SECRET" | "ABUSE_HMAC_SECRET",
): string {
  const secret = process.env[secretEnvironmentVariable];
  if (!secret || secret.length < 32) {
    throw new ApiError(503, "Request quota service is unavailable.", "QUOTA_UNAVAILABLE");
  }

  return createHmac("sha256", secret)
    .update(`aresweb-api-quota:v2:${scope}:${identity}:${windowStartedAtMs}`)
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
    || (options.identity !== undefined && !["user", "ip", "global"].includes(options.identity))
    || (options.secretEnvironmentVariable !== undefined && ![
      "ENCRYPTION_SECRET",
      "ABUSE_HMAC_SECRET",
    ].includes(options.secretEnvironmentVariable))
    || (typeof options.cost === "number" && (!Number.isSafeInteger(options.cost) || options.cost < 1))
    || (options.cost !== undefined && typeof options.cost !== "number" && typeof options.cost !== "function")
  ) {
    throw new Error("Invalid distributed quota configuration.");
  }
}

function quotaIdentity(req: AuthenticatedRequest, mode: "user" | "ip" | "global"): string {
  if (mode === "global") return "project";
  if (mode === "user") {
    if (!req.user?.uid) throw new ApiError(401, "Unauthorized: Missing verified identity");
    return `user:${req.user.uid}`;
  }

  const rawAddress = req.ip ?? req.socket?.remoteAddress
    ?? (process.env.FUNCTIONS_EMULATOR === "true" ? "127.0.0.1" : undefined);
  const address = rawAddress?.trim().toLowerCase().replace(/^::ffff:/, "");
  if (!address || isIP(address) === 0) {
    throw new ApiError(503, "Request quota service is unavailable.", "QUOTA_IDENTITY_UNAVAILABLE");
  }
  return `ip:${address}`;
}

function quotaCost(options: DistributedQuotaOptions, req: AuthenticatedRequest): number {
  const cost = typeof options.cost === "function" ? options.cost(req) : (options.cost ?? 1);
  if (!Number.isSafeInteger(cost) || cost < 1 || cost > options.limit) {
    throw new ApiError(400, "Request exceeds the operation budget.", "QUOTA_COST_INVALID");
  }
  return cost;
}

interface ResolvedQuota {
  options: DistributedQuotaOptions;
  cost: number;
  windowStartedAtMs: number;
  windowEndsAtMs: number;
  retentionMs: number;
  ref: FirebaseFirestore.DocumentReference;
}

/**
 * Enforces a fixed-window quota in a Firestore transaction so requests cannot
 * multiply their allowance by reaching different Cloud Functions instances.
 *
 * Mount this only after authorization middleware. Documents contain no raw UID
 * or IP address, and `expiresAt` can be configured as a Firestore TTL field.
 */
export function distributedQuota(options: DistributedQuotaOptions): RequestHandler {
  return distributedQuotas([options]);
}

/**
 * Atomically reserves several related budgets. This prevents a later project
 * ceiling from consuming an earlier user allowance and supports request-count
 * and weighted token budgets with one all-or-nothing transaction.
 */
export function distributedQuotas(optionsList: readonly DistributedQuotaOptions[]): RequestHandler {
  if (optionsList.length === 0 || optionsList.length > 8) {
    throw new Error("Invalid distributed quota configuration.");
  }
  optionsList.forEach(assertValidOptions);

  return async function enforceDistributedQuota(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const nowMs = Date.now();
    let retryAfterSeconds: number | undefined;
    let exceededScope: string | undefined;

    try {
      const quotas: ResolvedQuota[] = optionsList.map((options) => {
        const mode = options.identity ?? "user";
        const windowStartedAtMs = Math.floor(nowMs / options.windowMs) * options.windowMs;
        const windowEndsAtMs = windowStartedAtMs + options.windowMs;
        const secretEnvironmentVariable = options.secretEnvironmentVariable ?? "ENCRYPTION_SECRET";
        const documentId = quotaDocumentId(
          options.scope,
          quotaIdentity(req, mode),
          windowStartedAtMs,
          secretEnvironmentVariable,
        );
        return {
          options,
          cost: quotaCost(options, req),
          windowStartedAtMs,
          windowEndsAtMs,
          retentionMs: options.retentionMs ?? DEFAULT_RETENTION_MS,
          ref: adminDb.collection(QUOTA_COLLECTION).doc(documentId),
        };
      });

      await adminDb.runTransaction(async (transaction) => {
        const snapshots = await Promise.all(quotas.map((quota) => transaction.get(quota.ref)));
        const counts = snapshots.map((snapshot) => snapshot.exists ? snapshot.data()?.count : 0);

        for (const [index, storedCount] of counts.entries()) {
          const quota = quotas[index];
          if (!Number.isSafeInteger(storedCount) || storedCount < 0) {
            throw new ApiError(503, "Request quota service is unavailable.", "QUOTA_STATE_INVALID");
          }
          if ((storedCount as number) + quota.cost > quota.options.limit) {
            retryAfterSeconds = Math.max(1, Math.ceil((quota.windowEndsAtMs - nowMs) / 1_000));
            exceededScope = quota.options.scope;
            throw new ApiError(
              429,
              "This operation has reached its temporary request limit. Please try again later.",
              QUOTA_ERROR_CODE,
            );
          }
        }

        for (const [index, storedCount] of counts.entries()) {
          const quota = quotas[index];
          transaction.set(quota.ref, {
            count: (storedCount as number) + quota.cost,
            windowStartedAt: new Date(quota.windowStartedAtMs),
            updatedAt: new Date(nowMs),
            expiresAt: new Date(quota.windowEndsAtMs + quota.retentionMs),
          }, { merge: true });
        }
      });

      next();
    } catch (error) {
      if (error instanceof ApiError && error.code === QUOTA_ERROR_CODE) {
        res.setHeader("Retry-After", String(retryAfterSeconds ?? 1));
        logger.warn("security-event", "Distributed request quota exceeded", {
          securityEvent: "quota_exceeded",
          quotaScope: exceededScope ?? "unknown",
        });
      }
      next(error);
    }
  };
}

/** A shared anonymous quota that never stores or logs a raw client address. */
export function distributedAnonymousQuota(
  options: Omit<DistributedQuotaOptions, "identity" | "secretEnvironmentVariable">,
): RequestHandler {
  return distributedQuota({
    ...options,
    identity: "ip",
    secretEnvironmentVariable: "ABUSE_HMAC_SECRET",
  });
}
