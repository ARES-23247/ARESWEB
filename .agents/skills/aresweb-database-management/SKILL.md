---
name: aresweb-database-management
description: Enforces ARESWEB Firestore database management standards including collection modeling, firestore.rules configuration, indexing rules, querying patterns, soft delete defaults, and deployment procedures. Use when creating or modifying database structures, security rules, or queries.
---

# ARESWEB Database Management Standards (Firestore)

## 1. Schema Authority

### 🎯 Primary Source of Truth: Firestore Security Rules & Types
Since Google Cloud Firestore is a schema-less NoSQL database, the authoritative structure of documents and access controls is enforced through:
1. **`firestore.rules`**: Controls write/read permissions, schema validation, and field-level invariants.
2. **TypeScript Interfaces**: Frontend models in `src/types/` and backend models in `functions/src/types/` define type contracts for all collections.

### Indexes Definition
All query indexes are declared in **`firestore.indexes.json`** at the project root. Never rely solely on auto-generated console indexes; declare them here so they are source-controlled.

---

## 2. Firestore Modeling Conventions

### Collections & ID Generation
- **User Accounts (`authorized_users`)**: Keyed strictly by the user's Firebase Auth `uid`. Never use email as the document ID to prevent leaking PII in paths.
- **Content collections (`posts`, `docs`)**: Keyed deterministically by `slug` (e.g., `/docs/science-of-climbing`) to facilitate semantic, clean URLs.
- **Dynamic lists (`inquiries`, `events`, `photos`)**: Use auto-generated Firestore document IDs (`addDoc` or `doc(collection)`).

### Sub-Collections vs. Root Collections
- Prefer sub-collections for nested resources that are always loaded in the context of a parent document (e.g., `albums/{albumId}/photos/{photoId}`).
- Use root collections with reference fields (e.g., `eventId` in `event_signups`) when children must be queried independently or queried across parents.

### Soft-Delete Pattern
All primary content documents support soft deletion:
```typescript
isDeleted: 0 // or 1
```
Never perform raw `.delete()` operations on content collections. Use `.update({ isDeleted: 1 })`.

---

## 3. Querying & Firestore Indexing

### Strict Compound Query Constraints
Firestore requires indexes for any query containing:
1. Multiple `where` equality clauses plus an inequality (`<`, `>`, `!=`) or `orderBy`.
2. Array membership filters (`array-contains`) combined with sorting.

Always update `firestore.indexes.json` when adding complex filters to prevent query failures in production.

### Real-Time Listeners vs. Fetch
- Use `onSnapshot` for collaborative views (like Kanban boards, check-ins, or telemetry trackers) to provide zero-latency updates.
- Use `getDoc` / `getDocs` for static pages, search feeds, and API endpoints to conserve Firebase read limits.
