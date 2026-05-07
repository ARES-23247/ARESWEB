---
gsd_plan_version: 1.0
phase: 05
phase_name: Monitoring
milestone: v7.0
status: planned
parent_plan: null
---

# Phase 05: Monitoring

## Goal

Set up continuous performance monitoring to track Core Web Vitals and prevent regressions.

## Context

We need to:
- Track LCP, FID, CLS in production
- Monitor bundle sizes in CI/CD
- Create a dashboard for performance metrics
- Alert on regressions

## Requirements

### MON-01: Web Vitals Tracking
- LCP, FID, CLS tracked for all page views
- Metrics reported to analytics backend
- Performance scores available in dashboard

### MON-02: Bundle Size Monitoring
- CI/CD checks for bundle size regressions
- Build output compared against baseline
- Automated alerts on significant increases

### MON-03: Performance Dashboard
- Central view of all performance metrics
- Historical trends
- Page-by-page breakdown

## Tasks

### Plan 05-01: Web Vitals Implementation

**Files to create/modify**:
- `src/utils/webVitals.ts` (new)
- `src/App.tsx` - integrate tracking
- `functions/api/routes/analytics/performance.ts` (new endpoint)
- `src/components/dashboard/PerformanceDashboard.tsx` (new)

**Implementation**:

**1. Install web-vitals library**
```bash
npm install web-vitals
```

**2. Create web-vitals tracker**
```typescript
// src/utils/webVitals.ts
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

interface Metric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  page: string;
  timestamp: number;
}

let metricsQueue: Metric[] = [];

export function reportWebVitals(metric: any) {
  const enhanced: Metric = {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    page: window.location.pathname,
    timestamp: Date.now(),
  };

  metricsQueue.push(enhanced);

  // Send to analytics endpoint
  if (metricsQueue.length >= 5) {
    flushMetrics();
  }
}

async function flushMetrics() {
  if (metricsQueue.length === 0) return;

  try {
    await fetch('/api/analytics/performance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metrics: metricsQueue }),
      keepalive: true,
    });
    metricsQueue = [];
  } catch (e) {
    console.error('Failed to report web vitals:', e);
  }
}

// Initialize web vitals tracking
export function initWebVitals() {
  getCLS(reportWebVitals);
  getFID(reportWebVitals);
  getFCP(reportWebVitals);
  getLCP(reportWebVitals);
  getTTFB(reportWebVitals);

  // Flush on page hide
  addEventListener('pagehide', flushMetrics);
}

// Get rating for a metric
export function getRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const thresholds: Record<string, { good: number; poor: number }> = {
    LCP: { good: 2500, poor: 4000 },
    FID: { good: 100, poor: 300 },
    CLS: { good: 0.1, poor: 0.25 },
    FCP: { good: 1800, poor: 3000 },
    TTFB: { good: 800, poor: 1800 },
  };

  const threshold = thresholds[name];
  if (!threshold) return 'good';

  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
}
```

**3. Integrate in App.tsx**
```typescript
// src/App.tsx
import { initWebVitals } from './utils/webVitals';

export default function App() {
  useEffect(() => {
    initWebVitals();
  }, []);

  // ... rest of App component
}
```

**4. Create analytics endpoint**
```typescript
// functions/api/routes/analytics/performance.ts
import { AppEnv } from "../../middleware";
import { Kysely } from "kysely";
import { DB } from "../../../../shared/schemas/database";

const perfRouter = new OpenAPIHono<AppEnv>();

perfRouter.use("/*", ensureAdmin);

perfRouter.post('/metrics', async (c) => {
  const { metrics } = await c.req.json();

  const db = c.get('db') as Kysely<DB>;

  // Store metrics (create table if needed)
  // This could go to a D1 table or analytics service

  for (const metric of metrics) {
    await db.insertInto('performance_metrics').values({
      id: crypto.randomUUID(),
      metric_name: metric.name,
      value: metric.value,
      rating: metric.rating,
      page: metric.page,
      timestamp: new Date(metric.timestamp).toISOString(),
    }).execute();
  }

  return c.json({ received: metrics.length });
});

export default perfRouter;
```

---

### Plan 05-02: Bundle Size Monitoring in CI/CD

**Files to create/modify**:
- `.github/workflows/performance.yml` (new)
- `scripts/check-bundle-size.js` (new)
- `.planning/codebase/BUNDLE-BASELINE.json` (new baseline)

**Implementation**:

**1. Create baseline file**
```json
// .planning/codebase/BUNDLE-BASELINE.json
{
  "timestamp": "2026-05-06T20:00:00Z",
  "bundles": {
    "monaco": { "size": 2500000, "gzip": 669000 },
    "babel": { "size": 3000000, "gzip": 675000 },
    "editor": { "size": 1500000, "gzip": 427000 },
    "index.html": { "size": 500000, "gzip": 150000 }
  },
  "threshold": 0.1 // 10% increase triggers warning
}
```

**2. Create bundle checker script**
```javascript
// scripts/check-bundle-size.js
import { readFileSync } from 'fs';
import { resolve } from 'path';

const baseline = JSON.parse(
  readFileSync('.planning/codebase/BUNDLE-BASELINE.json', 'utf-8')
);

// Read build output from dist/stats.json (from rollup-plugin-visualizer)
const stats = JSON.parse(
  readFileSync('dist/stats.html', 'utf-8')
  // Parse visualizer output or use build manifest
);

// Compare sizes
let exceeded = false;
for (const [name, current] of Object.entries(stats.bundles)) {
  const base = baseline.bundles[name];
  if (!base) continue;

  const increase = (current.size - base.size) / base.size;

  if (increase > baseline.threshold) {
    console.error(`❌ ${name} increased by ${(increase * 100).toFixed(1)}%`);
    console.error(`   Was: ${base.size} Now: ${current.size}`);
    exceeded = true;
  } else if (increase > 0) {
    console.log(`⚠️  ${name} increased by ${(increase * 100).toFixed(1)}%`);
  } else {
    console.log(`✅ ${name} decreased by ${(-increase * 100).toFixed(1)}%`);
  }
}

if (exceeded) {
  process.exit(1);
}
```

**3. Add to CI/CD workflow**
```yaml
# .github/workflows/performance.yml
name: Performance Check

on:
  pull_request:
    paths:
      - 'src/**'
      - 'vite.config.ts'
      - 'package.json'

jobs:
  bundle-size:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - run: node scripts/check-bundle-size.js
```

---

### Plan 05-03: Performance Dashboard

**Files to create**:
- `src/components/dashboard/PerformanceDashboard.tsx` (new)
- Add to DashboardRoutes

**Implementation**:
```typescript
// src/components/dashboard/PerformanceDashboard.tsx
export function PerformanceDashboard() {
  const { data: metrics } = useQuery({
    queryKey: ['performance-metrics'],
    queryFn: () => fetchJson('/api/analytics/performance/summary'),
    refetchInterval: 60000, // Refresh every minute
  });

  return (
    <div className="space-y-6">
      {/* Core Web Vitals */}
      <section>
        <h2 className="text-xl font-bold">Core Web Vitals</h2>
        <div className="grid grid-cols-4 gap-4">
          <VitalCard name="LCP" value={metrics?.lcp} threshold={{ good: 2500, poor: 4000 }} />
          <VitalCard name="FID" value={metrics?.fid} threshold={{ good: 100, poor: 300 }} />
          <VitalCard name="CLS" value={metrics?.cls} threshold={{ good: 0.1, poor: 0.25 }} />
          <VitalCard name="FCP" value={metrics?.fcp} threshold={{ good: 1800, poor: 3000 }} />
        </div>
      </section>

      {/* Page-by-page breakdown */}
      <section>
        <h2 className="text-xl font-bold">Page Performance</h2>
        <Table>
          {/* Table showing each route's performance */}
        </Table>
      </section>

      {/* Bundle sizes */}
      <section>
        <h2 className="text-xl font-bold">Bundle Sizes</h2>
        {/* Chart showing bundle size trends */}
      </section>
    </div>
  );
}
```

---

## Success Criteria

1. Web Vitals tracking deployed to production
2. CI/CD checks bundle size on every PR
3. Performance dashboard available in admin panel
4. Baseline metrics established and documented

## Definition of Done

- [ ] web-vitals package installed
- [ ] WebVitals tracker created and integrated
- [ ] Analytics endpoint created
- [ ] Metrics stored in database
- [ ] Bundle baseline created
- [ ] Bundle checker script created
- [ ] CI/CD workflow updated
- [ ] Performance dashboard created
- [ ] Dashboard route added
- [ ] Initial metrics collected

## Estimated Effort

- Plan 05-01: 3 hours
- Plan 05-02: 2 hours
- Plan 05-03: 4 hours
- Testing and validation: 2 hours
- **Total: 11 hours**

## Dependencies

- **No dependencies** - Can run in parallel with other phases
- **Recommended**: Start early to collect baseline data
