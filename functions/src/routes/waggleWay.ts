import express, { type RequestHandler } from "express";
import { createWaggleCommunityMutations } from "../lib/waggleCommunityMutations";
import { createWaggleCommunityReads } from "../lib/waggleCommunityReads";
import { createWaggleCommunityReports } from "../lib/waggleCommunityReports";
import { WAGGLE_SUBMISSION_BYTES } from "../lib/waggleProof";
import {
  GAME_MONTHLY_RESOURCE_SCOPE,
  GAME_MONTHLY_RESOURCE_UNITS,
} from "../lib/gameResourceBudget";
import { asyncHandler } from "../lib/utils";
import {
  ensureAdmin,
  ensureTeamMember,
  type AuthenticatedRequest,
} from "../middleware/auth";
import { distributedQuotas } from "../middleware/distributedQuota";
import { ApiError } from "../middleware/errorHandler";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const monthly = (cost: number) => ({
  scope: GAME_MONTHLY_RESOURCE_SCOPE,
  limit: GAME_MONTHLY_RESOURCE_UNITS,
  calendarWindow: "month" as const,
  identity: "global" as const,
  cost,
  retentionMs: 32 * DAY_MS,
});
const anonymous = (scope: string, limit: number, windowMs: number) => ({
  scope,
  limit,
  windowMs,
  identity: "ip" as const,
  secretEnvironmentVariable: "ABUSE_HMAC_SECRET" as const,
});
const global = (scope: string, limit: number, windowMs: number) => ({
  scope,
  limit,
  windowMs,
  identity: "global" as const,
});
const proofQuota = distributedQuotas([
  { scope: "waggle-proof-hour", limit: 6, windowMs: HOUR_MS },
  { scope: "waggle-proof-day", limit: 20, windowMs: DAY_MS },
  global("waggle-proof-global", 500, DAY_MS),
  monthly(100),
]);
const reportQuota = distributedQuotas([
  anonymous("waggle-report-ip", 10, HOUR_MS),
  global("waggle-report-global", 500, DAY_MS),
  monthly(10),
]);
const mutationQuota = distributedQuotas([
  { scope: "waggle-manage", limit: 100, windowMs: HOUR_MS },
  global("waggle-manage-global", 2000, DAY_MS),
  monthly(30),
]);
const publicReadQuota = distributedQuotas([
  anonymous("waggle-browse-ip", 120, HOUR_MS),
  global("waggle-browse-global", 10000, DAY_MS),
  monthly(30),
]);
const privateReadQuota = distributedQuotas([
  { scope: "waggle-review-read", limit: 180, windowMs: HOUR_MS },
  global("waggle-review-read-global", 5000, DAY_MS),
  monthly(30),
]);

function boundedBody(proof: boolean): RequestHandler {
  const parser = proof
    ? express.text({
        type: "application/json",
        limit: WAGGLE_SUBMISSION_BYTES,
        inflate: false,
      })
    : express.json({ limit: "8kb", inflate: false });
  return (req, res, next) => {
    if (
      !req.is("application/json") ||
      !/^application\/json(?:\s*;\s*charset\s*=\s*"?utf-8"?)?$/iu.test(
        req.get("Content-Type") ?? "",
      )
    ) {
      next(new ApiError(415, "Send a JSON request.", "WAGGLE_MEDIA_TYPE"));
      return;
    }
    parser(req, res, (error) => {
      if (error) {
        const status = (error as { status?: unknown }).status;
        next(
          new ApiError(
            status === 413 ? 413 : status === 415 ? 415 : 400,
            status === 413
              ? "The garden request is too large."
              : "Send a valid UTF-8 JSON request.",
            "WAGGLE_BODY_INVALID",
          ),
        );
        return;
      }
      next();
    });
  };
}
const smallBody = boundedBody(false);
const proofBody = boundedBody(true);

/** Mount before the shared JSON parser, after shared CORS, App Check and request ceilings. */
export function createWaggleWayRouter(
  mutations = createWaggleCommunityMutations(),
  reads = createWaggleCommunityReads(),
  reports = createWaggleCommunityReports(),
) {
  const router = express.Router();
  router.use((_req, res, next) => {
    res.set("Cache-Control", "private, no-store");
    next();
  });
  router.get(
    "/gardens",
    publicReadQuota,
    asyncHandler(async (req, res) => {
      res.json(await reads.browse(req.query));
    }),
  );
  router.get(
    "/gardens/:id",
    publicReadQuota,
    asyncHandler(async (req, res) => {
      res.json(await reads.get(req.params.id));
    }),
  );
  router.get(
    "/mine",
    ensureTeamMember,
    privateReadQuota,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      res.json(await reads.mine(req.user!.uid));
    }),
  );
  router.get(
    "/mine/:id",
    ensureTeamMember,
    privateReadQuota,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      res.json(await reads.getOwn(req.user!.uid, req.params.id));
    }),
  );
  router.put(
    "/mine/:id",
    ensureTeamMember,
    proofQuota,
    proofBody,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      res.json(await mutations.submit(req.user!.uid, req.params.id, req.body));
    }),
  );
  router.delete(
    "/mine/:id",
    ensureTeamMember,
    mutationQuota,
    smallBody,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      res.json(
        await mutations.removeOwn(req.user!.uid, req.params.id, req.body),
      );
    }),
  );
  router.get(
    "/review",
    ensureAdmin,
    privateReadQuota,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      res.json(await reads.pending(req.user!.uid, req.query));
    }),
  );
  router.get(
    "/review/:id",
    ensureAdmin,
    privateReadQuota,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      res.json(await reads.review(req.user!.uid, req.params.id));
    }),
  );
  router.post(
    "/review/:id",
    ensureAdmin,
    mutationQuota,
    smallBody,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      res.json(await mutations.decide(req.user!.uid, req.params.id, req.body));
    }),
  );
  router.post(
    "/gardens/:id/remove",
    ensureAdmin,
    mutationQuota,
    smallBody,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      res.json(
        await mutations.removePublished(req.user!.uid, req.params.id, req.body),
      );
    }),
  );
  router.post(
    "/gardens/:id/report",
    reportQuota,
    smallBody,
    asyncHandler(async (req, res) => {
      await reports.report(req.params.id, req.body);
      res.status(204).end();
    }),
  );
  router.get(
    "/reports",
    ensureAdmin,
    privateReadQuota,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      res.json(await reports.pending(req.user!.uid, req.query));
    }),
  );
  router.post(
    "/reports/:id/resolve",
    ensureAdmin,
    mutationQuota,
    smallBody,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.body || Array.isArray(req.body) || Object.keys(req.body).length !== 0)
        throw new ApiError(
          400,
          "Send an empty JSON object to resolve a report.",
          "WAGGLE_REPORT_INVALID",
        );
      await reports.resolve(req.user!.uid, req.params.id);
      res.status(204).end();
    }),
  );
  // Unmatched routes terminate here so an oversized unknown request is never parsed by the shared parser.
  router.use((_req, res) => {
    res.status(404).json({ error: "Garden route not found." });
  });
  return router;
}
