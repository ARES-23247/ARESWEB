# ARES 23247 Web Portal

This is the official web portal for *FIRST*® Tech Challenge team **ARES 23247**. 

## 🏗️ Architecture

The project is structured as a pnpm monorepo:
- **Frontend SPA** (`src/`): Single Page React App built with **Vite** and styled with **Tailwind CSS**.
- **Backend API** (`functions/`): Serverless Express.js API running on **Firebase Cloud Functions (2nd Gen)**.
- **Database**: **Cloud Firestore** for data storage, protected by role-based `firestore.rules`.
- **Hosting**: Deployed and served via **Firebase Hosting**.

---

## 🛠️ Getting Started

### Prerequisites
Make sure you have **Node.js (v18+)** and **pnpm** installed globally.

### 1. Installation
Install all monorepo dependencies from the workspace root:
```bash
pnpm install
```

### 2. Development Servers
To run both the frontend dev server and the backend Firebase emulator concurrently:
```bash
# Run local dev environment
pnpm dev
```

The frontend will be available at `http://localhost:5173`.
The Firebase emulator UI will be available at `http://localhost:4000`.

---

## 🧪 Testing

### Backend Unit & Integration Tests (Vitest)
```bash
# Run backend tests
pnpm --filter functions test
```

### Frontend Unit & Component Tests (Vitest)
```bash
# Run frontend tests
pnpm test
```

### End-to-End Tests (Playwright)
To execute the remote E2E suite against the deployed staging site:
```bash
PREVIEW_URL=https://aresfirst-portal.web.app npm run test:e2e:remote
```
