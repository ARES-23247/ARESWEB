# Drizzle Studio for ARES Web Portal

## What is Drizzle Studio?

A web-based database browser that lets you visually explore your D1 database without writing SQL.

## Quick Start

### Option 1: During development (recommended)

First start the dev server to initialize the local D1 database:

```bash
npm run dev
# In another terminal:
npm run db:studio
```

### Option 2: Export and browse remote data

For production D1 data, export it first:

```bash
# Export remote D1 to local SQLite file
wrangler d1 export ares-db --remote --output=ares-db.sqlite

# Update drizzle.config.ts temporarily to use this file:
# dbCredentials: { url: "./ares-db.sqlite" }

# Then run Studio
npm run db:studio
```

## Features

- **Browse tables** — Click any table to see all rows
- **Edit data** — Click cells to edit inline
- **Add/delete rows** — GUI buttons for CRUD operations
- **Filter & search** — Quick filters on columns
- **See relationships** — Visual foreign key links between tables

## D1-Specific Setup

Drizzle Studio connects to your local D1 database via the `dbCredentials` in `drizzle.config.ts`.

The config points to `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite` which is created by Wrangler during `npm run dev`.

### Connection errors?

**Problem:** "Unable to open database file"

**Solution:** Make sure `npm run dev` has been run at least once to create the local D1 database.

**Problem:** "Table not found"

**Solution:** Run your local setup script:
```bash
npm run db:setup:local
```

## Common Workflows

### Debugging a user issue:
1. Open Studio → click `user` table
2. Find the user's row
3. Click related rows icon to see `user_profiles`
4. Check `user_badges` for their awards

### Checking event signups:
1. Open `events` table
2. Find your event
3. Click through `event_signups` relation
4. See who's signed up with their `bringing`/`notes`

### Verifying cascade deletes:
1. Note a test user's ID
2. Delete their row via Studio
3. Check that `user_profiles`, `comments`, `notifications` rows are also gone

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl/Cmd + F` | Focus search |
| `Ctrl/Cmd + K` | Command palette |
| `Arrow keys` | Navigate table |
| `Enter` | Edit cell |
| `Esc` | Cancel edit |

## Tips

- **Keep it open while developing** — See changes in real-time as you test
- **Use for data migrations** — Edit data directly instead of writing migration SQL
- **Prototype queries** — See what data looks like before writing code
- **Test cascade deletes** — Safely verify FK relationships work correctly
