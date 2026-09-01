import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  ANALYTICS_CONSENT_CHANGE_EVENT,
  readAnalyticsConsent,
  type AnalyticsConsentChoice,
} from "@/lib/analyticsConsent";

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

export default function AnalyticsTracker() {
  const location = useLocation();
  const initialConsent = useRef<AnalyticsConsentChoice | null>(
    readAnalyticsConsent(),
  );

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
    }

    // Apply a denied default even if another script initialized gtag first.
    // A saved analytics choice can only relax analytics storage; every
    // advertising-related purpose remains denied.
    window.gtag("consent", "default", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
    });
    if (initialConsent.current) {
      window.gtag("consent", "update", {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        analytics_storage: initialConsent.current,
      });
    }
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

  useEffect(() => {
    const handleConsentChange = (event: Event) => {
      const choice = (event as CustomEvent<AnalyticsConsentChoice>).detail;
      window.gtag?.("consent", "update", {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        analytics_storage: choice,
      });

      // The first page view ran under the denied default. Send one current-page
      // view after opt-in so the visitor can appear in standard GA reports.
      if (choice === "granted" && measurementId && window.gtag) {
        window.gtag("event", "page_view", {
          page_path: location.pathname,
          page_location: `${window.location.origin}${location.pathname}`,
          send_to: measurementId,
        });
      }
    };
    window.addEventListener(
      ANALYTICS_CONSENT_CHANGE_EVENT,
      handleConsentChange,
    );
    return () =>
      window.removeEventListener(
        ANALYTICS_CONSENT_CHANGE_EVENT,
        handleConsentChange,
      );
  }, [location.pathname, measurementId]);

  // Track page views by pathname only. Query parameters may contain search
  // terms, invitation tokens, or other user-provided data and are deliberately
  // excluded from analytics.
  useEffect(() => {
    if (!measurementId || !window.gtag) return;

    window.gtag("event", "page_view", {
      page_path: location.pathname,
      page_location: `${window.location.origin}${location.pathname}`,
      send_to: measurementId,
    });
  }, [location.pathname, measurementId]);

  return null;
}
