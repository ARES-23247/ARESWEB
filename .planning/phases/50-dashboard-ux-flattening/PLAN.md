# Phase 50: Dashboard UX Flattening

**Goal**: Integrate Social Media Manager directly into dashboard layout by removing redundant nesting and matching standard page patterns.

## User Review Required

> [!IMPORTANT]
> The visual structure of the Social Media Manager will change from a single boxed component to a page-like layout with a standard header and separate sections.

## Proposed Changes

### Dashboard Components

#### [MODIFY] [SocialHub.tsx](file:///c:/Users/david/dev/robotics/ftc/ARESWEB/src/components/SocialHub.tsx)
- Import `DashboardPageHeader` from `./dashboard/DashboardPageHeader`.
- Remove the outer `bg-obsidian border border-white/10 ares-cut-lg` wrapper.
- Use `space-y-8` for the root container.
- Replace the custom header section with `DashboardPageHeader`.
- Update the tab navigation to use a more integrated style, similar to the Finance Manager.
- Ensure the "New Post" action is passed to the `DashboardPageHeader`.

## Verification Plan

### Automated Tests
- Run `npm run test:e2e` to ensure navigation and basic functionality still work.
- Run `npx tsc --noEmit` to ensure no type errors were introduced.

### Manual Verification
- View the Social Media Manager in the dashboard and verify it no longer has redundant borders/backgrounds and matches the "Command Center" aesthetic.
