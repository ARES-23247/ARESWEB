# Project: ARESWEB Portal

## Architecture
- **Frontend App**: React SPA built with Vite and Tailwind CSS.
- **Backend API**: Node.js Express.js backend hosted on Firebase Cloud Functions.
- **Database**: Cloud Firestore with secure role-based access rules (`firestore.rules`).
- **Real-Time Synchronisation**: Dynamic state syncing and collection listeners.
- **Testing Frameworks**: Vitest for frontend and backend unit tests, Playwright for E2E verification.

## Code Layout
- `src/` — React application source code.
- `functions/src/` — Firebase serverless Express routing endpoints and middleware.
- `tests/e2e/` — Playwright integration test scenarios.
- `.agents/` — Workspace customizations, branding rules, and audit guidelines.

## Verification Contracts
- **Local Dev Server**: Serves frontend on `http://localhost:5173`.
- **Firebase Emulator**: Runs backend services on port `http://localhost:4000` (emulator UI).
- **Production Host**: Navigates to `https://aresfirst-portal.web.app`.
