# Database Management

> Firestore database structure, index configurations, firestore.rules, and querying patterns.

## Schema & Security Rules Authority

**`firestore.rules` is the single source of truth for access controls.** Every direct client read/write to Firestore is checked by these rules.

To deploy security rules and indexes:
```bash
npx firebase deploy --only firestore
```

## Collection Conventions

- **Document IDs:** Use unique generated string keys (e.g. `uid` for profiles, `slug` for blog posts, auto-generated IDs for sign-ups).
- **Soft-delete:** Include `isDeleted: 1` field on soft-deleted files. Ensure firestore.rules and queries filter out documents where `isDeleted == 1`.
- **Timestamps:** Write server timestamps using `admin.firestore.FieldValue.serverTimestamp()` on creation.

---

## Indexing Rules (`firestore.indexes.json`)

Firestore requires compound indexes for queries combining multiple `where` clauses, inequality filters, or `orderBy` sorting.
- Add compound indexes to `firestore.indexes.json` before writing queries that combine filters.
- If a query fails in dev, follow the Firebase link printed in console/logger to automatically provision the missing index.

---

## Query Patterns (Firebase Admin SDK)

### Simple Queries
```typescript
import { adminDb } from "../lib/firebase-admin";

const postSnap = await adminDb
  .collection("posts")
  .where("isDeleted", "!=", 1)
  .limit(50)
  .get();
```

### Batched Writes (Crucial for Scalability)
Firestore batches are capped at 500 operations. For bulk deletions or updates, paginate queries using `.limit(400)` and execute commits in a loop:
```typescript
let hasMore = true;
while (hasMore) {
  const snapshot = await adminDb
    .collection("imported_photos")
    .where("albumId", "==", albumId)
    .limit(400)
    .get();

  if (snapshot.empty) {
    hasMore = false;
    break;
  }

  const batch = adminDb.batch();
  snapshot.docs.forEach((doc) => {
    batch.update(doc.ref, { albumId: null });
  });
  await batch.commit();

  if (snapshot.docs.length < 400) {
    hasMore = false;
  }
}
```

---

## Security Rule Guards

Ensure the database remains locked down for unauthorized requests by using rules helpers:
```javascript
function isAuthenticated() {
  return request.auth != null;
}
function isAuthorized() {
  return isAuthenticated() && exists(/databases/$(database)/documents/authorized_users/$(request.auth.uid));
}
function hasRole(role) {
  return isAuthorized() && get(/databases/$(database)/documents/authorized_users/$(request.auth.uid)).data.role == role;
}
```
Public write permissions are strictly banned on sensitive collections like `inquiries` and `system_settings`.
