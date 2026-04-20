/**
 * ARES Analytics Utility
 * High-performance, anonymous tracking for documentation and blog engagement.
 */

export type AnalyticsCategory = 'blog' | 'doc' | 'event' | 'system';

export async function trackPageView(path: string, category: AnalyticsCategory) {
  try {
    // Only track in production or if explicitly enabled
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // Optional: Only track in production to keep dev logs clean
    if (isLocal) return;

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
