"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureAuth = ensureAuth;
exports.ensureAdmin = ensureAdmin;
const firebase_admin_1 = require("../lib/firebase-admin");
async function ensureAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ error: "Unauthorized: Missing or invalid token format" });
        return;
    }
    const token = authHeader.split("Bearer ")[1];
    try {
        const decodedToken = await firebase_admin_1.adminAuth.verifyIdToken(token);
        req.user = decodedToken;
        next();
    }
    catch (err) {
        console.error("[AuthMiddleware] Token verification failed:", err.message);
        res.status(401).json({ error: "Unauthorized: Invalid token" });
    }
}
async function ensureAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ error: "Unauthorized: Missing or invalid token format" });
        return;
    }
    const token = authHeader.split("Bearer ")[1];
    try {
        const decodedToken = await firebase_admin_1.adminAuth.verifyIdToken(token);
        const email = decodedToken.email?.toLowerCase();
        if (!email) {
            res.status(403).json({ error: "Forbidden: No email in token" });
            return;
        }
        const userDoc = await firebase_admin_1.adminDb.collection("authorized_users").doc(email).get();
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
    }
    catch (err) {
        console.error("[AuthMiddleware] Admin verification failed:", err.message);
        res.status(401).json({ error: "Unauthorized: Invalid token" });
    }
}
//# sourceMappingURL=auth.js.map