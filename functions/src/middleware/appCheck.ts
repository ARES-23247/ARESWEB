import { NextFunction, Request, Response } from "express";
import admin from "../lib/firebase-admin";
import { logger } from "../lib/logger";
import { ApiError } from "./errorHandler";

const EXPECTED_WEB_APP_ID = "1:205869391101:web:ca1bb24da790e4904ff294";
const OBSERVED_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// These integrations authenticate with their own server-side secrets and cannot
// obtain a Firebase App Check token from the browser SDK.
const OBSERVATION_EXEMPTIONS = new Set([
  "POST /api/profiles/sync",
  "POST /api/webhooks/zulip",
]);

export type AppCheckObservationStatus = "valid" | "missing" | "invalid";

export interface AppCheckObservation {
  status: AppCheckObservationStatus;
  appId?: string;
  reason?: "verification_failed" | "unexpected_app";
}

export interface AppCheckObservedRequest extends Request {
  appCheckObservation?: AppCheckObservation;
}

export function getAppCheckRouteGroup(path: string): string {
  const segments = path.split("/").filter(Boolean);
  return `/${segments.slice(0, 2).join("/")}`;
}

export function shouldObserveAppCheck(req: Request): boolean {
  if (!OBSERVED_METHODS.has(req.method.toUpperCase()) || !req.path.startsWith("/api/")) {
    return false;
  }

  return !OBSERVATION_EXEMPTIONS.has(`${req.method.toUpperCase()} ${req.path}`);
}

/** Classify App Check coverage before the enforcement middleware runs. */
export async function observeAppCheck(
  req: AppCheckObservedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  if (!shouldObserveAppCheck(req)) {
    next();
    return;
  }

  const method = req.method.toUpperCase();
  const routeGroup = getAppCheckRouteGroup(req.path);
  const token = req.get("X-Firebase-AppCheck")?.trim();

  if (!token) {
    req.appCheckObservation = { status: "missing" };
    logger.warn("app-check", "App Check observation", {
      status: "missing",
      method,
      routeGroup,
    });
    next();
    return;
  }

  try {
    const decoded = await admin.appCheck().verifyToken(token);
    if (decoded.appId !== EXPECTED_WEB_APP_ID) {
      req.appCheckObservation = {
        status: "invalid",
        appId: decoded.appId,
        reason: "unexpected_app",
      };
      logger.warn("app-check", "App Check observation", {
        status: "invalid",
        reason: "unexpected_app",
        method,
        routeGroup,
      });
    } else {
      req.appCheckObservation = { status: "valid", appId: decoded.appId };
      logger.info("app-check", "App Check observation", {
        status: "valid",
        method,
        routeGroup,
      });
    }
  } catch {
    req.appCheckObservation = {
      status: "invalid",
      reason: "verification_failed",
    };
    logger.warn("app-check", "App Check observation", {
      status: "invalid",
      reason: "verification_failed",
      method,
      routeGroup,
    });
  }

  next();
}

/** Reject browser mutation requests that do not carry a valid App Check token. */
export function enforceAppCheck(
  req: AppCheckObservedRequest,
  _res: Response,
  next: NextFunction
): void {
  const enforcementDisabled = process.env.ENFORCE_APP_CHECK === "false";
  const nonProductionRuntime = process.env.FUNCTIONS_EMULATOR === "true" || process.env.NODE_ENV === "test";
  const enforcementEnabled = process.env.ENFORCE_APP_CHECK === "true" ||
    (!enforcementDisabled && !nonProductionRuntime);
  if (!enforcementEnabled || !shouldObserveAppCheck(req)) {
    next();
    return;
  }

  if (req.appCheckObservation?.status === "valid") {
    next();
    return;
  }

  next(new ApiError(
    401,
    "App integrity verification is required. Refresh the page and try again.",
    "APP_CHECK_REQUIRED"
  ));
}
