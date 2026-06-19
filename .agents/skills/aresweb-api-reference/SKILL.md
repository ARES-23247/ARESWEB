---
name: aresweb-api-reference
description: Provides a comprehensive reference for the ARESWEB Firebase API, including standardized routing, Firebase authentication, Express middlewares, and core resource endpoints. Use this when interacting with the backend or documenting API behavior.
---

# ARESWEB API Reference Skill

You are the Lead Backend Architect for Team ARES 23247. When interacting with the ARESWEB Express API running on Firebase Cloud Functions:

## 1. Core Routing Architecture

The backend is structured as an Express application mounted as a single Firebase Cloud Function called `api` at `/api`. Each resource domain has its own sub-router in `functions/src/routes/`.

### Mount Points (in `functions/src/index.ts`)
| Prefix | Sub-Router | Primary Purpose |
|---|---|---|
| `/api/photos` | `photosRouter` | Google Photos sync, album CRUD, and asset metadata |
| `/api/inquiries` | `inquiriesRouter` | Team signups, sponsorship applications, and status updates |
| `/api/tasks` | `tasksRouter` | Kanban card alerts and comment proxying to Zulip |
| `/api/analytics` | `analyticsRouter` | Onshape synced robot configurations, match analyses, and telemetry logs |
| `/api/webhooks` | `webhooksRouter` | Receivers for GitHub and Zulip webhooks |
| `/api/upload` | `uploadRouter` | Secure file and log uploads to Firebase Storage |
| `/api/profiles` | `profilesRouter` | Member profiles, roles, and roster listings |
| `/api/ai` | `aiRouter` | Grammar checks and content assistant powered by Vertex AI (Gemini) |
| `/api/calendar` | `calendarRouter` | Calendar event fetching and synchronization |

---

## 2. Authentication & Authorization

Protected API routes use Express middlewares defined in `functions/src/middleware/auth.ts`:

- **`ensureAuth`**: Verifies the Firebase ID token in the `Authorization: Bearer <token>` header. Populates `req.user` with the decoded token.
- **`ensureTeamMember`**: Verifies the Firebase ID token and checks if the user's UID exists in the `authorized_users` Firestore collection.
- **`ensureAdmin`**: Verifies the Firebase ID token and checks if the user's role is `admin`, `coach`, or `mentor` in the `authorized_users` collection.

### Role Hierarchy (stored in `authorized_users`)
1. `admin`: Full platform control.
2. `coach` / `mentor`: Coach/mentor level access with admin privileges.
3. `student` / `member`: Standard authenticated team member.
4. `parent`: Access to logistics and private rosters.
5. `unverified`: Registered but restricted until manual approval.

---

## 3. Data Models (Cloud Firestore)

Common Firestore collections and their main structures:

### `authorized_users`
- Documents keyed by Firebase UID.
- Fields: `email`, `name`, `role`, `member_type`, `subteams`.

### `inquiries`
- Documents keyed by inquiry ID (UUID).
- Fields: `type` (join/sponsor), `name`, `email`, `status` (pending/approved), `createdAt`.

### `imported_photos` & `albums`
- Images synced from Google Photos or uploaded directly.
- Sub-collections/documents tracking photo URLs, ALT tags, and relationship to albums.

### `events`
- Team events, dates, and sign-ups.

---

## 4. Development Standards

- **Async Wrappers**: All asynchronous route handlers MUST be wrapped using `asyncHandler` (from `lib/utils`) to automatically forward thrown errors to the global error middleware.
- **Error Handling**: Throw `ApiError` from `middleware/errorHandler` to signal failures (e.g. `throw new ApiError(404, "Member not found")`). The global handler will serialize it cleanly.
- **Audit Logging**: Sensitive administrative actions (role changes, entry deletions) should be logged in the Firestore audit trail.
- **Security Checklists**: Public endpoints like `inquiries` must verify reCAPTCHA tokens (`recaptchaToken` from Google reCAPTCHA v3) before processing.
