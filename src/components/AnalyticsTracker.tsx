import { useEffect } from "react";
import { useLocation } from "react-router-dom";

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

// Generate or retrieve client ID from localStorage to run GA4 completely cookie-free
function getOrCreateClientId(): string {
  const STORAGE_KEY = "ares_ga_client_id";
  try {
    let cid = localStorage.getItem(STORAGE_KEY);
    if (!cid) {
      // Use crypto.randomUUID if available, otherwise fallback to custom random generator
      if (typeof window !== "undefined" && window.crypto && window.crypto.randomUUID) {
        cid = window.crypto.randomUUID();
      } else {
        cid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      }
      localStorage.setItem(STORAGE_KEY, cid);
    }
    return cid;
  } catch (e) {
    // Fallback for private tabs/browsers where localStorage is blocked
    return "session_" + Math.random().toString(36).substring(2, 15);
  }
}

export default function AnalyticsTracker() {
  const location = useLocation();

  // Retrieve Measurement ID from Vite environment, fallback to empty string if missing
  const measurementId = import.meta.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "";

  useEffect(() => {
    if (!measurementId) return;

    // Load GA4 gtag script tag dynamically if it doesn't already exist
    if (!document.getElementById("google-analytics-script")) {
      const script = document.createElement("script");
      script.id = "google-analytics-script";
      script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
      script.async = true;
      document.head.appendChild(script);

      window.dataLayer = window.dataLayer || [];
      window.gtag = function gtag() {
        window.dataLayer.push(arguments);
      };
      
      window.gtag("js", new Date());

      // Configure Google Analytics with client_storage: 'none' and the localStorage client ID
      window.gtag("config", measurementId, {
        client_storage: "none",
        client_id: getOrCreateClientId(),
        send_page_view: false // Turn off automatic page view tracking to let React Router handle it
      });
    }
  }, [measurementId]);

  // Track page views whenever the location path or search parameters change
  useEffect(() => {
    if (!measurementId || !window.gtag) return;

    const pagePath = location.pathname + location.search;
    window.gtag("event", "page_view", {
      page_path: pagePath,
      send_to: measurementId
    });
  }, [location, measurementId]);

  return null;
}
