# ARES 23247 — Appalachian Robotics & Engineering Society

The official web portal for ARES 23247, a community-based FIRST Tech Challenge team from Morgantown, WV. This site serves as our team's digital headquarters, managing our blog, event schedule, and outreach coordination.

## 🚀 Technology Stack

- **Frontend**: React 18 + Vite
- **Backend/API**: Hono (running on Cloudflare Pages Functions)
- **Database**: Cloudflare D1 (SQL)
- **Storage**: Cloudflare R2
- **Authentication**: Cloudflare Zero Trust (Access)
- **Styling**: Tailwind CSS + Custom ARES Design System

## 🛠 Features

- **Dynamic Blog**: A full Tiptap-based CMS for team engineering journals and news.
- **Events System**: Hero card layout with automatic sorting of upcoming and past events.
- **Image Management**: Automated Cloudflare R2 storage with client-side WebP compression.
- **Accessibility**: Built to WCAG 2.1 AA standards.
- **Readability**: Content enforced at an 8th-grade reading level for total community accessibility.

## 📦 Project Structure

```text
/
├── functions/       # Cloudflare Pages Functions (Hono API)
├── src/
│   ├── components/  # Reusable React components
│   ├── pages/       # Page layouts (Home, Blog, Events, etc.)
│   └── main.tsx     # Application entry point
├── schema.sql       # D1 database schema
└── wrangler.toml    # Cloudflare configuration
```

## 📚 Architecture & Orchestration

To keep our codebase healthy, we maintain extensive documentation on our tech stack and how our AI agents organize work.
- **[ARESWEB Architecture](.planning/ARCHITECTURE.md)**: A guide to our tech stack, including our Tiptap/Liveblocks collaborative editing ecosystem.
- **[GSD Orchestration](.planning/GSD-ORCHESTRATION.md)**: A guide on how we use Get Shit Done (GSD) skills and workflows to build the platform.

## 🛠 Development

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Local development:
   ```bash
   npm run dev
   ```

3. Preview with Cloudflare bindings:
   ```bash
   npm run preview
   ```

### Deployment

The project is automatically deployed to Cloudflare Pages via GitHub Actions on every push to the `main` branch.

```bash
# Manual deploy (if needed)
npm run deploy
```

---

*Part of the MARS Family. Inspired by the Mountaineer Mindset.*
