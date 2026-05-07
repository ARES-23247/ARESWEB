import { onCLS, onLCP, onINP, onTTFB, Metric } from 'web-vitals';

export interface VitalMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  page: string;
  timestamp: number;
}

let metricsQueue: VitalMetric[] = [];

export function reportWebVitals(metric: Metric) {
  const enhanced: VitalMetric = {
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

  const toSend = [...metricsQueue];
  metricsQueue = [];

  try {
    await fetch('/api/analytics/performance/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metrics: toSend }),
      keepalive: true,
    });
  } catch (e) {
    console.error('Failed to report web vitals:', e);
    // Put back in queue if failed
    metricsQueue = [...toSend, ...metricsQueue];
  }
}

// Initialize web vitals tracking
export function initWebVitals() {
  onCLS(reportWebVitals);
  onLCP(reportWebVitals);
  onINP(reportWebVitals);
  onTTFB(reportWebVitals);

  // Flush on page hide
  window.addEventListener('pagehide', flushMetrics);
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushMetrics();
    }
  });
}
