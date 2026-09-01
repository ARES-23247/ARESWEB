import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ANALYTICS_CONSENT_CHANGE_EVENT,
  ANALYTICS_CONSENT_OPEN_EVENT,
  openAnalyticsConsentChoices,
  readAnalyticsConsent,
  saveAnalyticsConsent,
  type AnalyticsConsentChoice,
} from "@/lib/analyticsConsent";

function useAnalyticsConsentChoice() {
  const [choice, setChoice] = useState<AnalyticsConsentChoice | null>(() =>
    readAnalyticsConsent(),
  );

  useEffect(() => {
    const handleChange = (event: Event) => {
      setChoice((event as CustomEvent<AnalyticsConsentChoice>).detail);
    };
    window.addEventListener(ANALYTICS_CONSENT_CHANGE_EVENT, handleChange);
    return () =>
      window.removeEventListener(ANALYTICS_CONSENT_CHANGE_EVENT, handleChange);
  }, []);

  return choice;
}

export default function AnalyticsConsentBanner() {
  const choice = useAnalyticsConsentChoice();
  const [isOpen, setIsOpen] = useState(() => choice === null);

  useEffect(() => {
    const handleChange = () => setIsOpen(false);
    const handleOpen = () => setIsOpen(true);
    window.addEventListener(ANALYTICS_CONSENT_CHANGE_EVENT, handleChange);
    window.addEventListener(ANALYTICS_CONSENT_OPEN_EVENT, handleOpen);
    return () => {
      window.removeEventListener(ANALYTICS_CONSENT_CHANGE_EVENT, handleChange);
      window.removeEventListener(ANALYTICS_CONSENT_OPEN_EVENT, handleOpen);
    };
  }, []);

  if (!isOpen) return null;

  const choose = (nextChoice: AnalyticsConsentChoice) => {
    saveAnalyticsConsent(nextChoice);
    setIsOpen(false);
  };

  return (
    <section
      aria-labelledby="analytics-consent-title"
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-3xl rounded-xl border border-white/20 bg-obsidian p-4 text-white shadow-2xl shadow-black/70 sm:bottom-5 sm:p-5"
    >
      <div className="sm:flex sm:items-start sm:justify-between sm:gap-6">
        <div className="max-w-2xl">
          <h2
            id="analytics-consent-title"
            className="font-heading text-lg font-black uppercase tracking-wide"
          >
            Optional website analytics
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-marble/90">
            Help us learn which pages are useful. If you allow analytics, Google
            Analytics may store an analytics identifier in this browser to
            measure visits and page views. Advertising and personalization stay
            disabled. The website works the same either way.
          </p>
          <Link
            to="/privacy"
            className="mt-2 inline-flex min-h-11 items-center text-sm font-bold text-ares-cyan underline decoration-ares-cyan/40 underline-offset-4 hover:text-white focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
          >
            Read our privacy details
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:mt-0 sm:min-w-48">
          <button
            type="button"
            onClick={() => choose("granted")}
            className="min-h-11 rounded border border-ares-red bg-ares-red px-4 py-2 text-sm font-black uppercase tracking-wide text-white hover:bg-ares-bronze focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
          >
            Allow analytics
          </button>
          <button
            type="button"
            onClick={() => choose("denied")}
            className="min-h-11 rounded border border-white/30 bg-white/5 px-4 py-2 text-sm font-black uppercase tracking-wide text-white hover:border-ares-cyan hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
          >
            Keep cookie-free
          </button>
        </div>
      </div>
    </section>
  );
}

export function AnalyticsConsentPreferencesButton() {
  const choice = useAnalyticsConsentChoice();
  const status =
    choice === "granted"
      ? "Analytics is allowed in this browser."
      : choice === "denied"
        ? "This browser remains cookie-free for analytics."
        : "No analytics preference is saved in this browser.";

  return (
    <div className="mt-6 rounded-lg border border-white/15 bg-black/20 p-4">
      <p className="text-sm font-bold text-white" aria-live="polite">
        {status}
      </p>
      <button
        type="button"
        onClick={openAnalyticsConsentChoices}
        className="mt-3 min-h-11 rounded border border-ares-cyan/60 px-4 py-2 text-sm font-black uppercase tracking-wide text-white hover:bg-ares-cyan/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
      >
        Change analytics choice
      </button>
    </div>
  );
}
