/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface Window {
  __PLAYWRIGHT_TEST__?: boolean;
  __TEST_PARTYKIT_HOST__?: string;
}

interface ImportMetaEnv {
  readonly VITE_PARTYKIT_HOST: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
