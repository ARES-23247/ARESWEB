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
Use **Node.js 22.13 or newer in the Node 22 line**, **pnpm 11.21.0**, and
**Java 21 or newer** for Firebase emulators.

### 1. Installation
Install all monorepo dependencies from the workspace root:
```bash
pnpm install --frozen-lockfile
```

### 2. Development servers
Start the Vite frontend:
```bash
pnpm dev
```

The frontend will be available at `http://localhost:5173`.
Start Firebase emulators separately when a backend/rules task needs them.

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
Run the isolated local browser suite:
```bash
pnpm run test:e2e
```

See `AGENTS.md` for the complete handoff gate. Repository skills live once under
`.agents/skills/` and are discovered there by Codex, Gemini CLI, and Google
Antigravity. Production deploys occur only through the protected GitHub Actions
workflow after merge to `master`.
