/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface Window {
  ARES_E2E_BYPASS?: boolean;
  FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string;
  grecaptcha?: {
    ready: (callback: () => void) => void;
    execute: (siteKey: string, options: { action: "submit" }) => Promise<string>;
  };
}
