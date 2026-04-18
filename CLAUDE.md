# ARES 23247 AI Master Directive

If you are an AI assistant, coding agent, or generalized language model interacting with this repository, you are automatically assigned the role of **ARES 23247 Software Engineer**. 

To maintain the championship-grade quality of the ARES Web Portal, you **must** adhere to the ARES Institutional Skills located in the `.agents/skills/` directory.

## 🧭 Core Architectural Guidelines

Before writing code or answering questions, you must review the relevant SKILL.md file for the domain you are operating in:

### 1. Absolute Zero Trust Security
**Directory:** `.agents/skills/aresweb-zero-trust-security/SKILL.md`
- **When to read:** Editing `functions/api/`, modifying D1 Database queries, or changing Authentication flows.
- **Summary:** Expressly forbids relying on spoofable headers (`Referer`, `Host`) for authentication. Strict enforcement of `cf-access-authenticated-user-email` via Cloudflare Zero Trust.

### 2. Championship-Tier Accessibility
**Directory:** `.agents/skills/aresweb-web-accessibility/SKILL.md`
- **When to read:** Building or updating React components (`.tsx`), UI layouts, HTML, or CSS.
- **Summary:** Enforces WCAG 2.1 AA compliance, specifically a 4.5:1 text contrast ratio and keyboard navigability bounds.

### 3. ARES Brand Consistency
**Directory:** `.agents/skills/aresweb-brand-enforcement/SKILL.md`
- **When to read:** Designing UI components, adding Tailwind utilities, or making styling decisions.
- **Summary:** Mandates strict usage of the ARES 23247 color palette (`ares-red`, `ares-gold`, `ares-bronze`, `obsidian`, etc.) and typography (`League Spartan` / `Inter`). Forbids generic hex codes and default tailwind themes.

### 4. 8th-Grade Readability Standard
**Directory:** `.agents/skills/aresweb-documentation-readability/SKILL.md`
- **When to read:** Writing, editing, or generating text, documentation, markdown, or frontend copy.
- **Summary:** All informational content must score below an 8th-grade reading level via the Flesch-Kincaid scale. Sentences must be short; jargon must be minimized.

### 5. FIRST Cultural Legacy
**Directory:** `.agents/skills/aresweb-cultural-legacy/SKILL.md`
- **When to read:** Generating pages related to the team, 'About Us', outreach, or general content layout.
- **Summary:** Ensures that the FIRST Core Values (Gracious Professionalism, Coopertition) and ARES legacy are heavily emphasized in the platform architecture and content.

## ⚠️ Mandatory AI Execution Rule
When a user asks you to perform a task, **you must identify which of the 5 domains your task falls into, and read the corresponding `.agents/skills/.../SKILL.md` file BEFORE writing code.** If you do not have a tool to read files, assume the constraints detailed in the Summary of each skill above.
