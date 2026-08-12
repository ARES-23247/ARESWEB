import { Request, Response, NextFunction } from "express";
import { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth, adminDb } from "../lib/firebase-admin";
import { ApiError } from "./errorHandler";
import { logger } from "../lib/logger";

export interface AuthenticatedRequest extends Request {
  user?: DecodedIdToken;
  authorizationRole?: ActiveAuthorizationRole;
}

export type ActiveAuthorizationRole = "admin" | "coach" | "mentor" | "member";

const ACTIVE_ROLES = new Set<ActiveAuthorizationRole>(["admin", "coach", "mentor", "member"]);
const LEGACY_ROLE_MAP: Readonly<Record<string, ActiveAuthorizationRole>> = {
  student: "member",
  parent: "member",
  lead: "mentor",
};

function normalizeActiveRole(value: unknown): ActiveAuthorizationRole | null {
  if (typeof value !== "string") return null;
  if (ACTIVE_ROLES.has(value as ActiveAuthorizationRole)) return value as ActiveAuthorizationRole;
  return LEGACY_ROLE_MAP[value] ?? null;
}

function isArchivedAuthorization(data: FirebaseFirestore.DocumentData | undefined): boolean {
  return data?.isDeleted === true || data?.isDeleted === 1;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown authentication error";
}

async function extractAndVerifyToken(req: Request): Promise<DecodedIdToken> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new ApiError(401, "Unauthorized: Missing or invalid token format");
  }
  const token = authHeader.split("Bearer ")[1];
  try {
    return await adminAuth.verifyIdToken(token);
  } catch {
    throw new ApiError(401, "Unauthorized: Invalid token");
  }
}

export async function ensureAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  try {
    req.user = await extractAndVerifyToken(req);
    next();
  } catch (err: unknown) {
    logger.error("auth", "Token verification failed", { error: errorMessage(err) });
    next(err);
  }
}

export async function ensureAdmin(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  try {
    const decodedToken = await extractAndVerifyToken(req);
    const userDoc = await adminDb.collection("authorized_users").doc(decodedToken.uid).get();
    if (!userDoc.exists) {
      return next(new ApiError(403, "Forbidden: User not authorized"));
    }
    const userData = userDoc.data();
    const role = normalizeActiveRole(userData?.role);
    if (isArchivedAuthorization(userData) || (role !== "admin" && role !== "coach")) {
      return next(new ApiError(403, "Forbidden: Insufficient privileges"));
    }
    req.user = decodedToken;
    req.authorizationRole = role;
    next();
  } catch (err: unknown) {
    logger.error("auth", "Admin verification failed", { error: errorMessage(err) });
    next(err);
  }
}

export async function ensureTeamMember(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  try {
    if (req.user && req.authorizationRole && ACTIVE_ROLES.has(req.authorizationRole)) {
      next();
      return;
    }
    const decodedToken = await extractAndVerifyToken(req);
    const userDoc = await adminDb.collection("authorized_users").doc(decodedToken.uid).get();
    if (!userDoc.exists) {
      return next(new ApiError(403, "Forbidden: User not authorized"));
    }
    const userData = userDoc.data();
    if (isArchivedAuthorization(userData)) {
      return next(new ApiError(403, "Forbidden: Account is archived"));
    }
    const role = normalizeActiveRole(userData?.role);
    if (!role) {
      return next(new ApiError(403, "Forbidden: Account is unverified"));
    }
    req.user = decodedToken;
    req.authorizationRole = role;
    next();
  } catch (err: unknown) {
    logger.error("auth", "Team member verification failed", { error: errorMessage(err) });
    next(err);
  }
}
