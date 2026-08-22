const RECAPTCHA_SCRIPT_ID = "recaptcha-script";
const DEVELOPMENT_SITE_KEY = "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI";
const SCRIPT_LOAD_TIMEOUT_MS = 15_000;

interface StandardRecaptchaClient {
  ready: (callback: () => void) => void;
  execute: (siteKey: string, options: { action: "submit" }) => Promise<string>;
}

function configuredSiteKey(): string {
  const isNonProduction =
    import.meta.env.DEV ||
    import.meta.env.MODE === "e2e" ||
    import.meta.env.MODE === "test";
  return (
    import.meta.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ||
    (isNonProduction ? DEVELOPMENT_SITE_KEY : "")
  );
}

function standardRecaptchaClient(): StandardRecaptchaClient | undefined {
  const candidate = window.grecaptcha;
  if (
    typeof candidate?.ready !== "function" ||
    typeof candidate.execute !== "function"
  ) {
    return undefined;
  }

  return candidate as StandardRecaptchaClient;
}

function loadRecaptcha(siteKey: string): Promise<StandardRecaptchaClient> {
  const loadedClient = standardRecaptchaClient();
  if (loadedClient) return Promise.resolve(loadedClient);

  return new Promise((resolve, reject) => {
    let script = document.getElementById(
      RECAPTCHA_SCRIPT_ID,
    ) as HTMLScriptElement | null;
    let timeoutId = 0;
    let shouldAppendScript = false;

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      script?.removeEventListener("load", handleLoad);
      script?.removeEventListener("error", handleError);
    };
    const handleLoad = () => {
      cleanup();
      const client = standardRecaptchaClient();
      if (client) resolve(client);
      else {
        script?.remove();
        reject(
          new Error(
            "Security verification loaded without the standard reCAPTCHA API.",
          ),
        );
      }
    };
    const handleError = () => {
      cleanup();
      script?.remove();
      reject(
        new Error(
          "Security verification could not be loaded. Check your connection or content blocker.",
        ),
      );
    };

    if (!script) {
      script = document.createElement("script");
      script.id = RECAPTCHA_SCRIPT_ID;
      script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
      script.async = true;
      script.defer = true;
      shouldAppendScript = true;
    }

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
    timeoutId = window.setTimeout(() => {
      cleanup();
      script?.remove();
      reject(
        new Error(
          "Security verification timed out. Please check your connection and try again.",
        ),
      );
    }, SCRIPT_LOAD_TIMEOUT_MS);

    if (shouldAppendScript) document.head.appendChild(script);
  });
}

interface RecaptchaTokenOptions {
  allowDevelopmentBypass?: boolean;
}

export async function getRecaptchaToken(
  options: RecaptchaTokenOptions = {},
): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("Security verification is available only in the browser.");
  }

  const isNonProductionTestMode =
    import.meta.env.DEV ||
    import.meta.env.MODE === "e2e" ||
    import.meta.env.MODE === "test";
  const allowDevelopmentBypass =
    options.allowDevelopmentBypass !== false &&
    isNonProductionTestMode &&
    window.ARES_E2E_BYPASS === true;
  if (allowDevelopmentBypass) return "test-bypass-token";

  const siteKey = configuredSiteKey();
  if (!siteKey) {
    throw new Error(
      "Security verification is not configured. Please contact an ARES administrator.",
    );
  }

  const recaptcha = await loadRecaptcha(siteKey);
  return new Promise((resolve, reject) => {
    recaptcha.ready(() => {
      recaptcha
        .execute(siteKey, { action: "submit" })
        .then(resolve)
        .catch((executionError: unknown) => {
          reject(
            new Error(
              `Security verification failed: ${executionError instanceof Error ? executionError.message : String(executionError)}`,
            ),
          );
        });
    });
  });
}
