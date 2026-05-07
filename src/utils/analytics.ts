/**
 * ARES Analytics Utility
 * High-performance, anonymous tracking for documentation and blog engagement.
 */

export type AnalyticsCategory = 'blog' | 'doc' | 'event' | 'system';

import { client } from '../api/honoClient';

export async function trackPageView(path: string, category: AnalyticsCategory) {
  try {
    // Analytics are now tracked in all environments (including local) to allow testing.
    await client.analytics.track.$post({
      json: {
        path,
        category,
        referrer: document.referrer,
      }
    });
  } catch (err) {
    // Silent fail to avoid disrupting user experience
    console.warn('[Analytics] Failed to log interaction:', err);
  }
}
