export type AnalyticsConsentChoice = "granted" | "denied";

export const ANALYTICS_CONSENT_STORAGE_KEY = "ares_analytics_consent_v1";
export const ANALYTICS_CONSENT_CHANGE_EVENT = "ares:analytics-consent-change";
export const ANALYTICS_CONSENT_OPEN_EVENT = "ares:analytics-consent-open";

export function readAnalyticsConsent(): AnalyticsConsentChoice | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

export function saveAnalyticsConsent(choice: AnalyticsConsentChoice): boolean {
  if (typeof window === "undefined") return false;
  let persisted = true;
  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, choice);
  } catch {
    persisted = false;
  }
  window.dispatchEvent(
    new CustomEvent<AnalyticsConsentChoice>(ANALYTICS_CONSENT_CHANGE_EVENT, {
      detail: choice,
    }),
  );
  return persisted;
}

export function openAnalyticsConsentChoices(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ANALYTICS_CONSENT_OPEN_EVENT));
}
