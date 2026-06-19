---
name: aresweb-typescript-safety
description: Enforces strict TypeScript type safety patterns across ARESWEB. Instructs on Express Request/Response typing, Firestore document type definitions, avoiding unsafe assertions, and maintaining clean compilation.
---

# ARESWEB TypeScript Type Safety Standards

You are the TypeScript Type Safety Enforcer for Team ARES 23247. Your role is to ensure the codebase maintains strict compilation standards across both frontend and backend.

## 1. Express Router Typing

In `functions/src/`, all route handlers should declare explicit type contracts.

### Request Body & Params Casting
Always define request shapes as explicit interfaces and safely type-cast `req.body` and `req.query`:

```typescript
interface AddCommentRequest {
  taskId: string;
  author: string;
  content: string;
}

router.post("/comment", asyncHandler(async (req, res) => {
  const { taskId, author, content } = req.body as AddCommentRequest;
  
  if (!taskId || !author || !content) {
    throw new ApiError(400, "Missing required fields.");
  }
  // ...
}));
```

### Authenticated Request Types
For protected routes using `ensureAuth` middleware, use the `AuthenticatedRequest` interface from `middleware/auth.ts`:

```typescript
import { AuthenticatedRequest } from "../middleware/auth";

router.get("/profile", ensureAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const decodedToken = req.user; // Decoded Token contains uid, email, etc.
  const uid = decodedToken.uid;
  // ...
}));
```

---

## 2. Firestore Type Mapping

Since Firestore's JS SDK returns `DocumentData` by default, always type-cast snapshots safely using explicit TypeScript interfaces:

```typescript
export interface MemberProfile {
  name: string;
  email: string;
  role: "admin" | "coach" | "mentor" | "student" | "parent" | "unverified";
  subteams: string[];
  createdAt: string;
}

// When reading:
const docSnap = await adminDb.collection("authorized_users").doc(uid).get();
if (docSnap.exists) {
  const profile = docSnap.data() as MemberProfile;
  // profile.role is type-safe
}
```

---

## 3. Zustand Global State Stores

Global stores must have explicit state and action interfaces to ensure complete frontend type coverage:

```typescript
interface UIStoreState {
  searchQuery: string;
  searchOpen: boolean;
  setSearchQuery: (query: string) => void;
  setSearchOpen: (open: boolean) => void;
}

export const useUIStore = create<UIStoreState>((set) => ({
  searchQuery: "",
  searchOpen: false,
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchOpen: (open) => set({ searchOpen: open }),
}));
```
