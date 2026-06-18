# ARES 23247 Dependencies Deep Audit

**Audit Date:** 2026-05-10
**Scope:** All production and development dependencies
**Total Dependencies:** 1717

---

## Executive Summary

| Category | Status | Count |
|----------|--------|-------|
| **Production Vulnerabilities** | ✅ None | 0 |
| **Development Vulnerabilities** | ⚠️ Moderate | 3 (Vitest 2.x) |
| **Outdated Packages** | ⚠️ Needs Update | 40+ |
| **Critical Updates** | 🔴 Required | 3 |
| **Bundle Size** | ✅ Good | Monitored |

**Overall Grade:** **B+ (85%)**

---

## 1. Security Vulnerabilities

### Production Dependencies
```
npm audit --production
found 0 vulnerabilities
```
✅ **No production vulnerabilities** - Excellent security posture.

### Development Dependencies
⚠️ **3 moderate severity vulnerabilities** in Vitest 2.x ecosystem:
- `vitest`, `vite-node`, `vite` - Path traversal in optimized deps (GHSA-4w7w-66w2-5vf9)
- **Impact:** Testing infrastructure only, NOT production
- **Fix:** Upgrade to Vitest 4.1.5

---

## 2. Outdated Packages Analysis

### 🔴 CRITICAL - Coordinated Updates Required

#### 2.1 TipTap Ecosystem (26 packages)
| Package | Current | Wanted | Latest | Priority |
|---------|---------|--------|--------|----------|
| `@tiptap/core` | 3.22.5 | 3.23.1 | 3.23.1 | **HIGH** |
| `@tiptap/react` | 3.22.5 | 3.23.1 | 3.23.1 | **HIGH** |
| `@tiptap/starter-kit` | 3.22.5 | 3.23.1 | 3.23.1 | **HIGH** |
| `@tiptap/pm` | 3.22.5 | 3.23.1 | 3.23.1 | **HIGH** |
| All other TipTap packages | 3.22.5 | 3.23.1 | 3.23.1 | **HIGH** |

**Action Required:** Coordinated update of all 26 TipTap packages together.
**Risk:** Medium - patch release, but may have breaking changes in extensions.
**Estimated Effort:** 2-3 hours (testing rich text features)

#### 2.2 Vitest (Major Version Jump)
| Package | Current | Wanted | Latest | Priority |
|---------|---------|--------|--------|----------|
| `vitest` | 2.1.9 | 2.1.9 | **4.1.5** | **HIGH** |
| `@vitest/coverage-v8` | 2.1.8 | 2.1.9 | **4.1.5** | **HIGH** |

**Action Required:** Major version upgrade (2.x → 4.x)
**Risk:** High - potential config changes, test runner behavior changes
**Estimated Effort:** 4-6 hours (test fixes, config migration)
**Security:** Resolves GHSA-4w7w-66w2-5vf9 vulnerability

#### 2.3 Tailwind CSS (Major Version Jump)
| Package | Current | Wanted | Latest | Priority |
|---------|---------|--------|--------|----------|
| `tailwindcss` | 3.4.19 | 3.4.19 | **4.3.0** | **MEDIUM** |

**Action Required:** Major version upgrade (3.x → 4.x)
**Risk:** High - Tailwind 4.0 is a complete rewrite with new config format
**Estimated Effort:** 8-12 hours (config migration, class name verification)
**Note:** Tailwind 4 requires migration of `tailwind.config.ts` to CSS-based config

---

## 3. High Priority Updates

| Package | Current | Latest | Impact | Effort |
|---------|---------|--------|--------|--------|
| `@hono/zod-openapi` | 1.3.0 | 1.4.0 | OpenAPI fixes | Low (15 min) |
| `better-auth` | 1.6.9 | 1.6.10 | Bug fixes | Low (15 min) |
| `wrangler` | 4.88.0 | 4.90.0 | Worker deployment | Low (5 min) |
| `react-router-dom` | 7.14.2 | 7.15.0 | Router improvements | Low (30 min) |
| `stripe` | 22.1.0 | 22.1.1 | Payment fixes | Low (15 min) |

---

## 4. Medium Priority Updates

| Package | Current | Latest | Impact |
|---------|---------|--------|--------|
| `monaco-editor` | 0.53.0 | 0.55.1 | Editor improvements |
| `@cloudflare/workers-types` | 4.20260504.1 | 4.20260510.1 | Type updates |
| `msw` | 2.14.3 | 2.14.5 | Mock worker fixes |
| `knip` | 6.11.0 | 6.12.2 | Unused dependency detection |

---

## 5. Dependency Health Assessment

### Abandoned/Stale Packages
| Package | Last Update | Action |
|---------|-------------|--------|
| `@tremor/react` | January 2025 | Monitor - React 19 compatibility unknown |
| `@tiptap/extension-collaboration-cursor` | 3.0.0-next.6 | Stale prerelease |

### React 19 Compatibility
| Package | React Requirement | Status |
|---------|-------------------|--------|
| `@tremor/react` | ^18.0.0 | ⚠️ Potential conflict |
| All other packages | ^19.0.0 or none | ✅ Compatible |

**Note:** Tremor appears unmaintained. Consider migration to Recharts or Chart.js if issues arise.

---

## 6. Bundle Size Analysis

| Package | Size | Notes |
|---------|------|-------|
| Monaco Editor | ~3MB | Necessary feature |
| Three.js | ~600KB | Simulations |
| TipTap ecosystem | ~200KB | Rich text |
| lucide-react | ~50-100KB | **Opportunity** - can be tree-shaken better |

### Optimization Opportunity: lucide-react → lucide
Current usage imports entire icon set:
```typescript
import { Edit, Trash, Plus } from 'lucide-react';  // ❌
```

Optimized usage with individual imports:
```typescript
import Edit from 'lucide-react/dist/esm/icons/edit';  // ✅
```

**Savings:** 50-100KB in bundle size
**Effort:** Low (1-2 hours with find/replace)

---

## 7. Unused Dependencies

Previous audit identified 9 unused dependencies:
- `react-router-dom` (replaced by TanStack Router)
- Various development dependencies

**Action:** Run `knip` to detect and remove unused imports/packages.

---

## 8. Version Conflicts

### Drizzle ORM Beta Status
| Package | Current | Stable |
|---------|---------|--------|
| `drizzle-orm` | 1.0.0-beta.22 | 0.45.2 |
| `drizzle-kit` | 1.0.0-beta.22 | 0.31.10 |

**Status:** Using beta 1.0 release candidates
**Risk:** Medium - potential breaking changes
**Recommendation:** Evaluate staying on beta vs. downgrading to stable 0.x

---

## 9. Dependency Update Priority Matrix

### Do Now (This Sprint)
1. ✅ **Vitest 2.x → 4.1.5** (security fix)
2. ✅ **TipTap 3.22.5 → 3.23.1** (coordinated update)

### Schedule Soon (Next Sprint)
3. **@hono/zod-openapi** 1.3.0 → 1.4.0
4. **better-auth** 1.6.9 → 1.6.10
5. **wrangler** 4.88.0 → 4.90.0

### Monitor (Ongoing)
6. **Tailwind 3.x → 4.x** (requires significant migration)
7. **@tremor/react** React 19 compatibility
8. **Drizzle ORM** beta → stable decision

### Technical Debt (Low Priority)
9. **lucide-react** tree-shaking optimization
10. Remove unused dependencies via `knip`

---

## 10. Recommended Update Commands

### Phase 1: Security & High Priority
```bash
# Vitest major upgrade (resolve GHSA-4w7w-66w2-5vf9)
npm install -D vitest@latest @vitest/coverage-v8@latest

# TipTap coordinated update
npm install @tiptap/core@^3.23.1 @tiptap/react@^3.23.1 @tiptap/starter-kit@^3.23.1 @tiptap/pm@^3.23.1
```

### Phase 2: Medium Priority
```bash
# API and auth updates
npm install @hono/zod-openapi@^1.4.0 better-auth@^1.6.10 wrangler@latest

# Router and payment
npm install react-router-dom@^7.15.0 stripe@latest
```

### Phase 3: Tailwind Migration (Separate Branch)
```bash
# Requires config migration
npm install tailwindcss@^4.3.0
# Follow Tailwind 4 migration guide
```

---

## 11. Testing Strategy

After each dependency update:

1. **Run TypeScript compilation:**
   ```bash
   npx tsc --noEmit
   ```

2. **Run unit tests:**
   ```bash
   npm test
   ```

3. **Run E2E tests (remote):**
   ```bash
   PREVIEW_URL=https://aresweb.pages.dev npm run test:e2e:remote
   ```

4. **Manual smoke test:**
   - Rich text editor (TipTap)
   - Authentication (better-auth)
   - Dashboard navigation (React Router)

---

## Conclusion

The ARES Web Portal has **healthy dependency management** with zero production vulnerabilities. The primary concerns are:

1. **Vitest 2.x** has security vulnerabilities - upgrade to 4.x
2. **TipTap 26 packages** need coordinated update
3. **Tailwind 4.x** migration requires significant effort

**Recommended Timeline:**
- Week 1: Vitest + TipTap updates
- Week 2: Medium priority updates
- Week 3-4: Tailwind 4.x migration (separate branch)

---

*Dependencies Deep Audit Completed: 2026-05-10*
