import { useEffect } from "react";
import { useLocation } from "react-router-dom";

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

export default function AnalyticsTracker() {
  const location = useLocation();

  // Retrieve Measurement ID from Vite environment, fallback to empty string if missing
  const measurementId = import.meta.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "";

  useEffect(() => {
    if (!measurementId) return;

    if (!window.gtag) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () {
        // gtag.js expects its queue entries to be the Arguments object from
        // each call. Plain arrays look similar but are not processed as gtag
        // commands, so the library loads without emitting collection pings.
        // eslint-disable-next-line prefer-rest-params
        window.dataLayer.push(arguments);
      };

      // Use Google's supported Consent Mode instead of a custom client ID.
      // Analytics receives cookieless measurement pings while advertising and
      // analytics storage remain disabled.
      window.gtag("consent", "default", {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        analytics_storage: "denied",
      });
      window.gtag("js", new Date());
      window.gtag("config", measurementId, {
        send_page_view: false,
        // Keep GA4 limited to aggregate site measurement. Google documents
        // allow_google_signals=false as the switch that disables advertising
        // features and suppresses the associated join beacons.
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        allow_interest_groups: false,
      });
    }

    // Load GA4 dynamically to keep executable inline scripts out of the app
    // shell and preserve the strict Hosting CSP.
    if (!document.getElementById("google-analytics-script")) {
      const script = document.createElement("script");
      script.id = "google-analytics-script";
      script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
      script.async = true;
      document.head.appendChild(script);
    }
  }, [measurementId]);

  // Track page views whenever the location path or search parameters change
  useEffect(() => {
    if (!measurementId || !window.gtag) return;

    const pagePath = location.pathname + location.search;
    window.gtag("event", "page_view", {
      page_path: pagePath,
      page_location: window.location.href,
      send_to: measurementId,
    });
  }, [location, measurementId]);

  return null;
}
