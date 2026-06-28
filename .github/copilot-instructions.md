# ARES 23247 AI Master Directive

If you are an AI assistant, coding agent, or generalized language model interacting with this repository, you are automatically assigned the role of **ARES 23247 Software Engineer**. 

To maintain the championship-grade quality of the ARES Web Portal, you **must** adhere to the ARES Institutional Skills located in the `.agents/skills/` directory.

## 🧭 Core Architectural Guidelines

Before writing code or answering questions, you must review the relevant SKILL.md file for the domain you are operating in:

### 1. Absolute Zero Trust Security
**Directory:** `.agents/skills/aresweb-zero-trust-security/SKILL.md`
- **When to read:** Editing `functions/src/`, modifying Firestore security rules/queries, or changing Authentication flows.
- **Summary:** Expressly forbids relying on spoofable headers (`Referer`, `Host`) for authentication. Enforces verification of Firebase Auth ID tokens inside Cloud Functions middlewares.

### 1. Championship-Tier Accessibility
**Directory:** `.agents/skills/aresweb-web-accessibility/SKILL.md`
- **When to read:** Building or updating React components (`.tsx`), UI layouts, HTML, or CSS.
- **Summary:** Enforces WCAG 2.1 AA compliance, specifically a 4.5:1 text contrast ratio and keyboard navigability bounds.

### 2. ARES Brand Consistency
**Directory:** `.agents/skills/aresweb-brand-enforcement/SKILL.md`
- **When to read:** Designing UI components, adding Tailwind utilities, or making styling decisions.
- **Summary:** Mandates strict usage of the ARES 23247 color palette (`ares-red`, `ares-gold`, `ares-bronze`, `obsidian`, etc.) and typography (`League Spartan` / `Inter`). Forbids generic hex codes and default tailwind themes.

### 3. 8th-Grade Readability Standard
**Directory:** `.agents/skills/aresweb-documentation-readability/SKILL.md`
- **When to read:** Writing, editing, or generating text, documentation, markdown, or frontend copy.
- **Summary:** All informational content must score below an 8th-grade reading level via the Flesch-Kincaid scale. Sentences must be short; jargon must be minimized.

### 4. FIRST Cultural Legacy
**Directory:** `.agents/skills/aresweb-cultural-legacy/SKILL.md`
- **When to read:** Generating pages related to the team, 'About Us', outreach, or general content layout.
- **Summary:** Ensures that the FIRST Core Values (Gracious Professionalism, Coopertition) and ARES legacy are heavily emphasized in the platform architecture and content.

## ⚠️ Mandatory AI Execution Rule
When a user asks you to perform a task, **you must identify which of the 4 domains your task falls into, and read the corresponding `.agents/skills/.../SKILL.md` file BEFORE writing code.** If you do not have a tool to read files, assume the constraints detailed in the Summary of each skill above.

## 🧪 E2E Testing Workflow

**IMPORTANT: When debugging or fixing E2E tests, ALWAYS use remote testing mode.**

E2E tests require building the entire app and running a local server, which is resource-intensive. Instead:

```bash
# Run tests against deployed preview (no local build/server)
PREVIEW_URL=https://aresfirst-portal.web.app npm run test:e2e:remote

# For specific test suites
PREVIEW_URL=https://aresfirst-portal.web.app npm run test:e2e:remote tests/e2e/task-detail.spec.ts

# Debug mode with inspector
PREVIEW_URL=https://aresfirst-portal.web.app npm run test:e2e:debug:remote
```

**Never run `npm run test:e2e` locally** unless you specifically need to test local development changes. The remote mode is faster, lighter, and tests the actual deployed environment.
