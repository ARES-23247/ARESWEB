import { logger } from "@/utils/logger";
import { app } from "./firebaseCore";

type AppCheckModule = typeof import("firebase/app-check");
type AppCheckInstance = ReturnType<AppCheckModule["initializeAppCheck"]>;

let appCheck: AppCheckInstance | undefined;
let appCheckInitialization: Promise<AppCheckInstance | undefined> | undefined;

export async function getOrInitializeAppCheck(): Promise<AppCheckInstance | undefined> {
  if (appCheck || typeof window === "undefined") return appCheck;

  const siteKey = import.meta.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY;
  if (!siteKey) return undefined;
  if (appCheckInitialization) return appCheckInitialization;

  appCheckInitialization = import("firebase/app-check")
    .then(({ initializeAppCheck, ReCaptchaEnterpriseProvider }) => {
      const isLocalHost =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.hostname.endsWith(".local");
      const useDebugToken =
        (import.meta.env.VITE_USE_EMULATOR === "true" ||
          import.meta.env.NEXT_PUBLIC_USE_EMULATOR === "true") &&
        isLocalHost;

      if (useDebugToken) window.FIREBASE_APPCHECK_DEBUG_TOKEN = true;

      appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(siteKey),
        isTokenAutoRefreshEnabled: true,
      });
      return appCheck;
    })
    .catch((error: unknown) => {
      logger.error("Firebase App Check failed to initialize:", error);
      appCheckInitialization = undefined;
      return undefined;
    });

  return appCheckInitialization;
}

export async function getAppCheckHeader(forceRefresh = false): Promise<Record<string, string>> {
  const isIsolatedTestMode = import.meta.env.MODE === "e2e" || import.meta.env.MODE === "test";
  if (typeof window !== "undefined" && isIsolatedTestMode && window.ARES_E2E_BYPASS === true) {
    return { "X-Firebase-AppCheck": "test-app-check-token" };
  }

  const currentAppCheck = await getOrInitializeAppCheck();
  if (!currentAppCheck) return {};

  try {
    const { getToken } = await import("firebase/app-check");
    const tokenResult = await getToken(currentAppCheck, forceRefresh);
    return tokenResult?.token ? { "X-Firebase-AppCheck": tokenResult.token } : {};
  } catch (error) {
    logger.error("Failed to retrieve App Check token:", error);
    return {};
  }
}
