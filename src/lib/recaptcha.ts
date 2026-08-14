const RECAPTCHA_SCRIPT_ID = "recaptcha-script";
const DEVELOPMENT_SITE_KEY = "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI";
const SCRIPT_LOAD_TIMEOUT_MS = 15_000;

function isLocalDevelopmentHost(): boolean {
  const hostname = window.location.hostname;
  return hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("10.") ||
    hostname.endsWith(".local") ||
    hostname.includes("aresfirst-portal--") ||
    window.location.protocol === "http:";
}

function configuredSiteKey(): string {
  const isNonProduction = import.meta.env.DEV || import.meta.env.MODE === "e2e" || import.meta.env.MODE === "test";
  return import.meta.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || (isNonProduction ? DEVELOPMENT_SITE_KEY : "");
}

function loadRecaptcha(siteKey: string): Promise<NonNullable<Window["grecaptcha"]>> {
  if (window.grecaptcha) return Promise.resolve(window.grecaptcha);

  return new Promise((resolve, reject) => {
    let script = document.getElementById(RECAPTCHA_SCRIPT_ID) as HTMLScriptElement | null;
    let timeoutId = 0;

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      script?.removeEventListener("load", handleLoad);
      script?.removeEventListener("error", handleError);
    };
    const handleLoad = () => {
      cleanup();
      if (window.grecaptcha) resolve(window.grecaptcha);
      else reject(new Error("Security verification loaded without an available API."));
    };
    const handleError = () => {
      cleanup();
      reject(new Error("Security verification could not be loaded. Check your connection or content blocker."));
    };

    if (!script) {
      script = document.createElement("script");
      script.id = RECAPTCHA_SCRIPT_ID;
      script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
    timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("Security verification timed out. Please check your connection and try again."));
    }, SCRIPT_LOAD_TIMEOUT_MS);
  });
}

interface RecaptchaTokenOptions {
  allowDevelopmentBypass?: boolean;
}

export async function getRecaptchaToken(options: RecaptchaTokenOptions = {}): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("Security verification is available only in the browser.");
  }

  const isNonProductionTestMode = import.meta.env.DEV || import.meta.env.MODE === "e2e" || import.meta.env.MODE === "test";
  const allowDevelopmentBypass = options.allowDevelopmentBypass !== false &&
    isNonProductionTestMode &&
    (isLocalDevelopmentHost() || window.ARES_E2E_BYPASS === true);
  if (allowDevelopmentBypass) return "test-bypass-token";

  const siteKey = configuredSiteKey();
  if (!siteKey) {
    throw new Error("Security verification is not configured. Please contact an ARES administrator.");
  }

  const recaptcha = await loadRecaptcha(siteKey);
  return new Promise((resolve, reject) => {
    recaptcha.ready(() => {
      recaptcha.execute(siteKey, { action: "submit" }).then(resolve).catch((executionError: unknown) => {
        reject(new Error(`Security verification failed: ${executionError instanceof Error ? executionError.message : String(executionError)}`));
      });
    });
  });
}
