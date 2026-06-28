import { Request, Response, NextFunction } from "express";
import { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth, adminDb } from "../lib/firebase-admin";
import { ApiError } from "./errorHandler";
import { logger } from "../lib/logger";

export interface AuthenticatedRequest extends Request {
  user?: DecodedIdToken;
}

export async function ensureAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new ApiError(401, "Unauthorized: Missing or invalid token format"));
  }
  const token = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (err: any) {
    logger.error("auth", "Token verification failed", { error: err.message });
    next(new ApiError(401, "Unauthorized: Invalid token"));
  }
}

export async function ensureAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new ApiError(401, "Unauthorized: Missing or invalid token format"));
  }
  const token = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userDoc = await adminDb.collection("authorized_users").doc(decodedToken.uid).get();
    if (!userDoc.exists) {
      return next(new ApiError(403, "Forbidden: User not authorized"));
    }
    const userData = userDoc.data();
    if (userData?.role !== "admin" && userData?.role !== "coach" && userData?.role !== "mentor") {
      return next(new ApiError(403, "Forbidden: Insufficient privileges"));
    }
    req.user = decodedToken;
    next();
  } catch (err: any) {
    logger.error("auth", "Admin verification failed", { error: err.message });
    next(new ApiError(401, "Unauthorized: Invalid token"));
  }
}

export async function ensureTeamMember(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new ApiError(401, "Unauthorized: Missing or invalid token format"));
  }
  const token = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
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
    next(new ApiError(401, "Unauthorized: Invalid token"));
  }
}

