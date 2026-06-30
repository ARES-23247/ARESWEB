import { Request, Response, NextFunction } from "express";
import { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth, adminDb } from "../lib/firebase-admin";
import { ApiError } from "./errorHandler";
import { logger } from "../lib/logger";

export interface AuthenticatedRequest extends Request {
  user?: DecodedIdToken;
}

async function extractAndVerifyToken(req: Request): Promise<DecodedIdToken> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new ApiError(401, "Unauthorized: Missing or invalid token format");
  }
  const token = authHeader.split("Bearer ")[1];
  try {
    return await adminAuth.verifyIdToken(token);
  } catch (err: any) {
    throw new ApiError(401, "Unauthorized: Invalid token");
  }
}

export async function ensureAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    req.user = await extractAndVerifyToken(req);
    next();
  } catch (err: any) {
    logger.error("auth", "Token verification failed", { error: err.message });
    next(err);
  }
}

export async function ensureAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const decodedToken = await extractAndVerifyToken(req);
    const userDoc = await adminDb.collection("authorized_users").doc(decodedToken.uid).get();
    if (!userDoc.exists) {
      return next(new ApiError(403, "Forbidden: User not authorized"));
    }
        const userData = userDoc.data();
    if (userData?.role !== "admin" && userData?.role !== "coach") {
      return next(new ApiError(403, "Forbidden: Insufficient privileges"));
    }
    req.user = decodedToken;
    next();
  } catch (err: any) {
    logger.error("auth", "Admin verification failed", { error: err.message });
    next(err);
  }
}

export async function ensureTeamMember(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const decodedToken = await extractAndVerifyToken(req);
    const userDoc = await adminDb.collection("authorized_users").doc(decodedToken.uid).get();
    if (!userDoc.exists) {
      return next(new ApiError(403, "Forbidden: User not authorized"));
    }
    const userData = userDoc.data();
    if (userData?.role === "unverified") {
      return next(new ApiError(403, "Forbidden: Account is unverified"));
    }
    req.user = decodedToken;
    next();
  } catch (err: any) {
    logger.error("auth", "Team member verification failed", { error: err.message });
    next(err);
  }
}

