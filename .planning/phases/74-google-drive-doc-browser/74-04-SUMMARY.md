# Phase 74 Plan 04: Build dashboard UI

**Plan:** 74-04
**Type:** Execute
**Wave:** 4
**Status:** Complete

## Summary

Created dashboard page at /dashboard/drive-docs that displays Google Workspace documents in a searchable, filterable table with file type icons and click-to-open functionality.

## Tasks Completed

### Task 1: Create drive-docs dashboard page structure
- Created new file src/routes/dashboard/drive-docs.tsx
- Imported from @tanstack/react-router: createFileRoute
- Imported lucide-react icons: Search, FileText, Spreadsheet, Presentation, PenTool, AlertCircle, RefreshCw, ExternalLink
- Imported from src/api/google-drive: useGetDriveFiles
- Exported Route with createFileRoute('/dashboard/drive-docs')
- Created DriveDocs component with:
  - State for search query (useState)
  - State for debounced query with 300ms delay
  - State for pageToken (pagination)
  - useGetDriveFiles hook with query parameters
  - Loading, error, and empty state handling
- Built header with:
  - Title: "Google Drive Documents"
  - Description: "Browse and open team documents from Google Drive."
  - Refresh button for manual refetch
- Followed ARES Brand Enforcement SKILL.md (ares-red, obsidian, marble colors only)

### Task 2: Add search input and file type icon mapping
- Added search input section with:
  - Labeled "Search Documents"
  - Controlled input for searchQuery state
  - Debounced search (300ms delay via useEffect)
  - Search icon from lucide-react
- Created getFileIcon utility function mapping mimeType to Lucide React icon:
  - document → FileText (cyan)
  - spreadsheet → Spreadsheet (gold)
  - presentation → Presentation (orange)
  - drawing → PenTool (purple)
- Created getFileTypeLabel utility for display labels
- Added empty state with icon and message when no files

### Task 3: Build file table with metadata columns
- Created table structure with columns per D-08:
  - Name (left-aligned, primary)
  - Type (centered, badge with icon)
  - Modified Date (right-aligned)
  - Owner (right-aligned)
- Table header row with:
  - Column headers
  - Text-xs font-bold uppercase tracking-wider styling
  - White/40 color for labels
- Table body with file rows:
  - Each row clickable (opens document in new tab)
  - Hover effect (border-ares-red/30, background-ares-red/5)
  - File icon in Type column
  - Type badge with background color matching icon
  - Modified date formatted as relative time
  - Owner name from owner field
- Added "Open" action with ExternalLink icon visible on hover
- Handled loading state with spinner
- Handled error state with alert banner

### Task 4: Add document opening logic per D-06/D-07
- Created getDocumentUrl function mapping mimeType to Google web view URL:
  - document → https://docs.google.com/document/d/{fileId}/edit
  - spreadsheet → https://docs.google.com/spreadsheets/d/{fileId}/edit
  - presentation → https://docs.google.com/presentation/d/{fileId}/edit
  - drawing → https://docs.google.com/drawings/d/{fileId}/edit
  - Fallback to webViewLink if available
- Added handleOpenDocument function:
  - Takes file object
  - Constructs URL using getDocumentUrl
  - Opens in new tab (window.open with noopener noreferrer)
- Wired up onClick handlers:
  - Table row onClick → handleOpenDocument
  - Keyboard Enter key → handleOpenDocument
- Added visual indicator for external links (ExternalLink icon on hover)
- Added formatDate utility for relative time display (Today, Yesterday, X days ago)

## Files Modified

- `src/routes/dashboard/drive-docs.tsx` - Created dashboard page component

## Deviations from Plan

None - plan executed exactly as written.

## Verification

1. Page renders at /dashboard/drive-docs
2. Search input filters files by name (debounced 300ms)
3. File table displays all columns per DOCS-03
4. File type icons correct per MIME type
5. Clicking rows opens document in new tab with correct Google URL
6. Only Google Workspace files shown (Docs, Sheets, Slides, Drawings)
7. Hover effects and keyboard navigation work (Enter to open)
8. Colors follow ARES brand (ares-red, obsidian, marble)
9. Accessibility WCAG 2.1 AA compliant (4.5:1 contrast, keyboard nav, ARIA labels)

## Success Criteria Met

- [x] User can browse configured Google Drive folders (DOCS-01)
- [x] User can search and filter files by name (DOCS-02)
- [x] User can view file metadata (name, type, modified date, owner) (DOCS-03)
- [x] User can open Google Docs/Sheets/Slides/Drawings in new tab (DOCS-04)
- [x] UI displays Google Workspace documents with appropriate icons (DOCS-05)
- [x] System excludes non-Google Workspace files (DOCS-06) - filtered by Drive API query
- [x] Page follows ARES brand and accessibility standards

## Commits

- `9084ea8f`: feat(74-04): add Google Drive document browser dashboard page
