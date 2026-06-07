import { Request, Response, NextFunction } from "express";
import { adminAuth, adminDb } from "../lib/firebase-admin";

export interface AuthenticatedRequest extends Request {
  user?: any;
}

export async function ensureAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized: Missing or invalid token format" });
    return;
  }
  const token = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (err: any) {
    console.error("[AuthMiddleware] Token verification failed:", err.message);
    res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
}

export async function ensureAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized: Missing or invalid token format" });
    return;
  }
  const token = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userDoc = await adminDb.collection("authorized_users").doc(decodedToken.uid).get();
    if (!userDoc.exists) {
      res.status(403).json({ error: "Forbidden: User not authorized" });
      return;
    }
    const userData = userDoc.data();
    if (userData?.role !== "admin" && userData?.role !== "coach" && userData?.role !== "mentor") {
      res.status(403).json({ error: "Forbidden: Insufficient privileges" });
      return;
    }
    req.user = decodedToken;
    next();
  } catch (err: any) {
    console.error("[AuthMiddleware] Admin verification failed:", err.message);
    res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
}
