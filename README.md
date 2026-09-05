# ARES 23247 Web Portal

This is the official web portal for *FIRST*® Tech Challenge team **ARES 23247**. 

## 🏗️ Architecture

The project is structured as a pnpm monorepo:
- **Frontend SPA** (`src/`): Single Page React App built with **Vite** and styled with **Tailwind CSS**.
- **Backend API** (`functions/`): Serverless Express.js API running on **Firebase Cloud Functions (2nd Gen)**.
- **Arcade packages** (`packages/`): BUZZLE, BUZZELLO and Pollenator with shared rules, UI and geometry. See [game architecture](docs/GAME_ARCHITECTURE.md).
- **Online game service** (`functions/src/gameServer.ts`): The existing Cloud Run service uses the same canonical rules as the browser.
- **Database**: **Cloud Firestore** for data storage, protected by role-based `firestore.rules`.
- **Hosting**: Deployed and served via **Firebase Hosting**.

---

## 🛠️ Getting Started

### Prerequisites
Use **Node.js 24.15 or newer in the Node 24 line**, **pnpm 11.21.0**, and
**Java 21 or newer** for Firebase emulators.

Verify the active toolchain before installing dependencies:

```bash
pnpm run validate:runtime
```

On Windows, the repository can locate the pinned `fnm` Node installation and a
locally installed Java 21+ runtime, then run a command in that environment:

```powershell
.\scripts\with-supported-runtime.ps1 pnpm run test:rules
```

Running the PowerShell helper without a command only prints the resolved
versions. It changes environment variables for the child command only; it does
not modify the user's profile or system configuration.

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

For shared AI contributor setup and troubleshooting, see
[Agent setup](docs/AGENT_SETUP.md). Agent instructions and skills are tracked
repository files; changes must pass `pnpm run validate:agents`.

Google Drive uses a dedicated read-only credential, restricted Google Picker,
explicit draft imports, and a private incremental-change schedule. See
`docs/GOOGLE_DRIVE_INTEGRATION.md` before configuring or rotating that account.
