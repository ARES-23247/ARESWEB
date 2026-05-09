# ARES Web Portal - Comprehensive Fix Plan (Deeper Audit)

**Created:** 2026-05-09
**Strategy:** 5-wave parallel execution with 12 specialized agents
**Guidelines:** Following ARESWEB Institutional Skills

---

## Overview

This plan addresses **150+ findings** from the deeper audit across 6 dimensions:
- Accessibility: 58% compliance (3 CRITICAL, 20 HIGH)
- Brand Consistency: 70% compliance (50+ violations)
- API Design: B+ grade (5 issues)
- Performance: B+ grade (6 optimizations)
- Dependencies: Maintenance updates (39 items)

---

## Wave Structure

```
Wave 1 (BLOCKER)                    ┃
├── Accessibility Fixer             ┃  ~45 min
│   └── 3 CRITICAL WCAG violations  ┃
                                   ─━�━━━━━━━━━━━━━━━━━
Wave 2 (Parallel - 4 agents)        ┃
├── Agent 1: Brand Colors           ┃
├── Agent 2: Brand Typography      ┃  ~60 min
├── Agent 3: API HTTP Methods       ┃
└── Agent 4: API Naming             ┃
                                   ─━�━━━━━━━━━━━━━━━━━
Wave 3 (Parallel - 4 agents)        ┃
├── Agent 5: Accessibility High     ┃
├── Agent 6: API Standardization    ┃  ~60 min
├── Agent 7: Performance Critical   ┃
└── Agent 8: Dependency Updates     ┃
                                   ─━�━━━━━━━━━━━━━━━━━
Wave 4 (Parallel - 3 agents)        ┃
├── Agent 9: Brand Voice            ┃
├── Agent 10: API Documentation     ┃  ~45 min
└── Agent 11: Performance Opt       ┃
                                   ─━�━━━━━━━━━━━━━━━━━
Wave 5 (Final)                      ┃
├── Agent 12: Verification          ┃  ~30 min
│   └── Tests, re-audit, deploy     ┃
                                   ─━�━━━━━━━━━━━━━━━━━
```

---

## Wave 1: Accessibility CRITICAL (BLOCKER)

**Agent:** Accessibility Fixer (WCAG Specialist)
**Duration:** ~45 minutes
**Skills:** `aresweb-inclusive-design`

### CRITICAL-1: Low Contrast Text (WCAG AA 4.5:1)

**Problem:** `text-marble/20`, `text-white/20`, `text-white/30` fail contrast ratio

**Files Affected:** 10+ components

**Fix Pattern:**
```typescript
// BEFORE (FAILS WCAG AA)
className="text-white/20"

// AFTER (PASSES)
className="text-white/60"  // or use text-marble/60
```

**Search Pattern:**
```bash
grep -r "text-.*\/20" src/components
grep -r "text-.*\/30" src/components
```

---

### CRITICAL-2: Form Errors Not Associated

**Problem:** Missing `aria-invalid`, `aria-describedby`, `role="alert"`

**Files Affected:** All form components

**Fix Pattern:**
```typescript
// BEFORE
<input id="email" />
<div className="text-red-500">Email is required</div>

// AFTER
<input
  id="email"
  aria-invalid={hasError}
  aria-describedby="email-error"
/>
<div id="email-error" role="alert" className="text-red-500">
  Email is required
</div>
```

**Components to Fix:**
- All forms in `src/components/`
- Login/Register forms
- Settings forms
- Task/Post editing forms

---

### CRITICAL-3: Icon-Only Buttons Missing Labels

**Problem:** 50+ icon-only buttons lack `aria-label`

**Files Affected:** Components with icon buttons

**Fix Pattern:**
```typescript
// BEFORE
<button onClick={handleEdit}>
  <EditIcon />
</button>

// AFTER
<button onClick={handleEdit} aria-label="Edit item">
  <EditIcon />
</button>
```

**Search Pattern:**
```bash
grep -r "<Button" src/components | grep -v "aria-label"
```

---

## Wave 2: Parallel - Brand & API Foundation

### Agent 1: Brand Colors Fixer

**Skills:** `aresweb-brand-enforcement`

**Fix 1: Create Social Platform Color Mappings**

**File:** `tailwind.config.ts`

```typescript
colors: {
  // ... existing colors

  // Social platform brand colors
  'social-facebook': '#1877F2',
  'social-bluesky': '#0085ff',
  'social-linkedin': '#0077b5',
  'social-tiktok': '#00f2ea',
  'social-github': '#24292e',
  'social-discord': '#5865F2',
  'social-slack': '#4A154B',
  'social-teams': '#6264A7',
  'social-googlechat': '#00897B',
  'social-band': '#2D6CD4',
  'social-zulip': '#5e82a6',
}
```

---

**Fix 2: Replace Arbitrary Hex Codes**

**Files:**
- `Footer.tsx` (lines 95-113)
- `SocialComposer.tsx` (lines 22-32)
- `SocialAnalytics.tsx` (lines 24-34)
- `AdminInquiries.tsx` (line 309)

**Pattern:**
```typescript
// BEFORE
className="hover:bg-[#1877F2]"

// AFTER
className="hover:bg-social-facebook"
```

---

**Fix 3: Standardize Editor Dark Theme**

**Create:** `obsidian-dark`, `obsidian-darker` in tailwind.config.ts

```typescript
'obsidian': '#1A1A1A',
'obsidian-dark': '#0d0f14',
'obsidian-darker': '#0a0c10',
'obsidian-surface': '#1e1e1e',
```

**Replace in:** All simulation/editor components

---

### Agent 2: Brand Typography Fixer

**Skills:** `aresweb-brand-enforcement`

**Fix 1: Add Approved Fonts to Config**

**File:** `tailwind.config.ts`

```typescript
fontFamily: {
  // ... existing
  'sim-heading': ['Orbitron', 'sans-serif'],  // For simulations
  'sim-mono': ['JetBrains Mono', 'monospace'], // For simulations
}
```

**OR:** Replace with `font-heading` (League Spartan)

---

**Fix 2: Remove Inline Font Weights**

**Files:** `SimPreviewFrame.tsx`

**Pattern:**
```typescript
// BEFORE
style={{ fontWeight: 700 }}

// AFTER
className="font-bold"
```

---

### Agent 3: API HTTP Methods Fixer

**Skills:** `aresweb-api-reference`

**Fix: Standardize Update Operations**

**Pattern:**
```typescript
// BEFORE
router.post('/posts/admin/:slug', ...)

// AFTER
router.patch('/posts/admin/:slug', ...)
```

**Files to Update:**
- All update endpoints using POST
- Maintain backward compatibility with redirects if needed

---

### Agent 4: API Naming Fixer

**Skills:** `aresweb-api-reference`, `aresweb-typescript-safety`

**Fix: Standardize Response Naming**

**Pattern:** Choose camelCase for all API responses

```typescript
// BEFORE
{ email_verified: true, member_type: "student" }

// AFTER
{ emailVerified: true, memberType: "student" }
```

**Create:** Migration/types layer for backward compatibility

---

## Wave 3: Parallel - High Priority Items

### Agent 5: Accessibility High Priority

**Skills:** `aresweb-inclusive-design`

**Fixes:**
1. Add skip links (if missing)
2. Fix focus traps in modals
3. Add alt text to meaningful images
4. Ensure keyboard navigation works
5. Add ARIA landmarks

---

### Agent 6: API Standardization Fixer

**Skills:** `aresweb-api-reference`

**Fixes:**
1. Standardize pagination pattern
2. Add rate limit headers to responses
3. Add CSP headers documentation
4. Create pagination metadata helper

---

### Agent 7: Performance Critical Fixer

**Skills:** `aresweb-institutional-standards` (Efficiency pillar)

**Fixes:**
1. Virtualize TaskBoardPage.tsx
2. Virtualize GenericManagerList.tsx
3. Virtualize AdminUsers.tsx
4. Use `@tanstack/react-virtual`

---

### Agent 8: Dependency Updater

**Skills:** `aresweb-ci`

**Fixes:**
1. Upgrade TipTap ecosystem (26 packages)
2. Fix Vitest vulnerability
3. Update @hono/zod-openapi
4. Update better-auth

---

## Wave 4: Parallel - Medium Priority Items

### Agent 9: Brand Voice Fixer

**Skills:** `aresweb-institutional-standards` (Cultural Legacy)

**Fixes:**
1. Add ® to FIRST mentions in Seasons.tsx, Sponsors.tsx
2. Add Gracious Professionalism references
3. Simplify technical language to 8th grade
4. Add "In other words" sections

---

### Agent 10: API Documentation Fixer

**Skills:** `aresweb-api-reference`

**Fixes:**
1. Add JSDoc to all route handlers
2. Add usage examples to OpenAPI specs
3. Document authentication patterns
4. Add deprecation notices

---

### Agent 11: Performance Optimization Fixer

**Skills:** `aresweb-institutional-standards` (Efficiency)

**Fixes:**
1. Replace lucide-react with tree-shakeable lucide
2. Add fetchPriority/decoding hints
3. Merge profile+badges query
4. Create query limits constants

---

## Wave 5: Verification & Testing

**Agent:** Verification Agent
**Skills:** `aresweb-testing-enforcement`

**Tasks:**
1. Run all unit tests
2. Run E2E tests with accessibility checks
3. Run contrast ratio validation
4. Verify no regression in existing features
5. Generate final audit report

---

## Execution Commands

### Full Automation

```bash
# Wave 1: Accessibility CRITICAL
/gsd-quick "Execute Wave 1: Fix 3 CRITICAL WCAG violations"

# Wave 2: Brand & API Foundation (4 parallel agents)
/gsd-quick "Execute Wave 2: Brand colors, typography, API methods, API naming"

# Wave 3: High Priority (4 parallel agents)
/gsd-quick "Execute Wave 3: A11y high, API standardization, performance, dependencies"

# Wave 4: Medium Priority (3 parallel agents)
/gsd-quick "Execute Wave 4: Brand voice, API docs, performance opt"

# Wave 5: Verification
/gsd-quick "Execute Wave 5: Testing and verification"
```

---

## ARESWEB Institutional Skills Compliance

### Skills Followed

| Skill | Applied In | Compliance |
|-------|------------|------------|
| `aresweb-typescript-safety` | API naming, type fixes | ✅ |
| `aresweb-error-architecture` | Error associations | ✅ |
| `aresweb-database-management` | Query optimization | ✅ |
| `aresweb-identity-safety` | Not applicable (already fixed) | ✅ |
| `aresweb-inclusive-design` | Accessibility fixes | ✅ |
| `aresweb-brand-enforcement` | Brand colors, typography | ✅ |
| `aresweb-institutional-standards` | All dimensions | ✅ |
| `aresweb-api-reference` | API standardization | ✅ |
| `aresweb-testing-enforcement` | Verification | ✅ |
| `aresweb-ci` | Dependency updates | ✅ |

---

## Success Criteria

After execution, verify:

- [ ] All CRITICAL accessibility issues fixed
- [ ] WCAG AA contrast ratio passes (4.5:1)
- [ ] All brand colors use semantic names
- [ ] No arbitrary hex codes remain
- [ ] API uses consistent HTTP methods
- [ ] API responses use consistent naming
- [ ] TipTap upgraded to 3.23.1
- [ ] Vitest vulnerability resolved
- [ ] Long lists virtualized
- [ ] All tests pass
- [ ] No regressions

---

## Estimated Timeline

| Wave | Duration | Agents |
|------|----------|--------|
| Wave 1 | 45 min | 1 |
| Wave 2 | 60 min | 4 parallel |
| Wave 3 | 60 min | 4 parallel |
| Wave 4 | 45 min | 3 parallel |
| Wave 5 | 30 min | 1 |
| **Total** | **~4 hours** | **12 agents** |

---

## Rollback Plan

Each wave creates atomic commits. If critical issues arise:

1. Roll back by wave: `git revert <wave-commit-range>`
2. Preserve test additions
3. Re-execute failed wave with adjustments

---

*Plan created: 2026-05-09*
*Ready for execution*
*Following ARESWEB Institutional Skills*
