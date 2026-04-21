/**
 * ARES Analytics Utility
 * High-performance, anonymous tracking for documentation and blog engagement.
 */

export type AnalyticsCategory = 'blog' | 'doc' | 'event' | 'system';

export async function trackPageView(path: string, category: AnalyticsCategory) {
  try {
    // Analytics are now tracked in all environments (including local) to allow testing.
    // If you want to disable local tracking, uncomment the following line:
    // if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return;

    await fetch('/api/analytics/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path,
        category,
        referrer: document.referrer,
      }),
    });
  } catch (err) {
    // Silent fail to avoid disrupting user experience
    console.warn('[Analytics] Failed to log interaction:', err);
  }
}
