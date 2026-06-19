---
name: aresweb-zero-trust-security
description: Enforces Firebase Zero Trust security protocols across ARESWEB including Firebase Auth ID token verification, Firestore role-based access control, App Check, and secure database rule designs.
---

# ARES Zero Trust Security Standards (Firebase)

## Mandatory Requirements

### 1. Always Verify Identity Tokens Server-Side
**CRITICAL:** Never trust user identities declared by client-side headers. All protected endpoints must call `adminAuth.verifyIdToken(token)` via the auth middleware:

```typescript
// ✅ CORRECT: Verify token with Firebase Admin Auth
const token = authHeader.split("Bearer ")[1];
const decodedToken = await adminAuth.verifyIdToken(token);
req.user = decodedToken; // req.user.uid is verified
```

---

### 2. Role-Based Access Control (RBAC) via Firestore
User roles must be fetched and validated directly from the secure `authorized_users` collection in Firestore. Do not save role labels in the client's JWT payload if those roles grant write permissions:

```typescript
const userDoc = await adminDb.collection("authorized_users").doc(decodedToken.uid).get();
if (!userDoc.exists) {
  res.status(403).json({ error: "Forbidden" });
  return;
}
const userData = userDoc.data();
if (userData?.role !== "admin") {
  res.status(403).json({ error: "Forbidden" });
  return;
}
```

---

### 3. Firebase App Check
To protect APIs (e.g., mail dispatch or inquiries submission) from automated bot abuse, enforce **Firebase App Check** tokens for all client requests. Reject requests lacking valid App Check headers.

---

### 4. Firestore Security Rules
All direct client reads/writes to Firestore must be constrained by `firestore.rules`.
- Private data must check authentication: `request.auth != null`.
- Role checks must check `get(/databases/$(database)/documents/authorized_users/$(request.auth.uid)).data.role`.
- Never use user emails as paths or keys.
