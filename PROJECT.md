# Project: ARESWEB Portal

This is the central web platform and team portal for **ARES 23247** (Appalachian Robotics & Engineering Society), a *FIRST*® Tech Challenge team based in Morgantown, West Virginia.

---

## 🏗️ Core Architecture Overview

The platform uses a modern serverless architecture tailored for hosting and scalability:

- **Frontend**: Single Page Application (SPA) built with **Vite**, **React 18**, **TypeScript**, and **Tailwind CSS**.
- **Backend API**: Node.js **Express.js** application hosted on **Firebase Cloud Functions (2nd Gen)** under `/api/*`.
- **Database**: Cloud **Firestore** for real-time document synchronization. Direct client connections are secured via `firestore.rules`.
- **Storage**: **Firebase Cloud Storage** for media, photos, and CAD exports, gated via `storage.rules`.
- **Auth**: **Firebase Auth** with role-based access control (RBAC) managed via the `authorized_users` collection in Firestore.
- **State Management**: **Zustand** (`src/store/uiStore.ts`) for global UI configurations and seasonal settings.
- **State Sync**: Real-time listeners (`onSnapshot`) for event signs, roster management, and photo streams.

---

## 📂 Code Layout

```
ARESWEB/
├── .agents/            # Agent custom instructions, brand tokens, and audit skills
├── docs/               # Development conventions and migration guides
├── functions/          # Backend Cloud Functions
│   ├── src/
│   │   ├── lib/        # Shared wrappers (admin, logger, utils)
│   │   ├── middleware/ # ensureAuth, errorHandler middlewares
│   │   └── routes/     # 12 Express sub-routers (AI, events, blog, telemetry)
├── src/                # Frontend React application
│   ├── app/            # Next-style routing and page views
│   ├── components/     # UI elements (ShareButtons, TiptapRenderer, etc.)
│   ├── context/        # React Contexts (AuthContext)
│   ├── lib/            # Frontend API client and utilities
│   └── store/          # Zustand state store
├── firestore.rules     # Database access control rules
└── storage.rules       # Cloud Storage access control rules
```

---

## 🛠️ Verification & Environments

- **Local Dev Server**: Serves the frontend at `http://localhost:5173`.
- **Firebase Emulator Suite**: Emulates Firestore, Storage, Auth, and Cloud Functions locally on port `http://localhost:4000`.
- **Production Host**: The live portal runs on `https://aresfirst.org` (custom domain linked to Firebase Hosting).
- **Test Command**:
  - Frontend & Helpers: `pnpm test` (Vitest)
  - Backend API: `pnpm --filter functions test` (Vitest)
  - Integration: `pnpm run test:e2e` (Playwright)
