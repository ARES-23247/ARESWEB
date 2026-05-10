# Discussion Log: Phase 68

**Generated:** 2026-05-10

## Q: Which areas do you want to discuss for Kanban Feature Parity with Google Integrations?
**Options Presented:**
- Google Link Processing
- Label Scope & Colors
- Dependency Enforcement
- Checklist Complexity

**Selected:** Google Link Processing

---

## Area: Google Link Processing

### Link Parsing Approach
**Options Presented:**
- Client-side extraction
- Server-side unfurling (Recommended: Bypass CORS, fetch real titles)
**Selected:** Server-side unfurling

### Attachment Display
**Options Presented:**
- Small favicon icon + domain
- Rich preview cards (Recommended)
**Selected:** Rich preview cards

### Multiple Links
**Options Presented:**
- Support unlimited attachments (Recommended)
- Restrict to one primary document
**Selected:** Support unlimited attachments

### Access Control
**Options Presented:**
- No, just store the link (Recommended)
- Yes, integrate Google Workspace OAuth
**Selected:** No access control checks

---

## Implicit Area: Zulip Integration

**User input:** "yes, also how will we integrate things better with zulip?"

**Recommendations Locked In:**
- Attachment Alerts: Automatically post to Zulip topic.
- Checklist Milestones: Post when checklist hits 100%.
- Dependency Alerts: Cross-link blocked tasks.

---

## Final Areas: Labels, Dependencies, Checklists

**User input:** "your recommendations are spot on do those." / "what would you recommend?"

**Recommendations Locked In:**
- Labels: Global workspace labels, ARES brand palette, Full pill badges.
- Dependencies: Visual warnings only.
- Checklists: Plain strings.
