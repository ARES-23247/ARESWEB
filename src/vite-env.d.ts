/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface GooglePickerDocsView {
  setIncludeFolders: (value: boolean) => GooglePickerDocsView;
  setSelectFolderEnabled: (enabled: boolean) => GooglePickerDocsView;
}

interface GooglePickerResult {
  action?: string;
  docs?: Array<{ id?: string; name?: string }>;
}

interface GooglePickerBuilder {
  setAppId: (value: string) => GooglePickerBuilder;
  setDeveloperKey: (value: string) => GooglePickerBuilder;
  setOAuthToken: (value: string) => GooglePickerBuilder;
  addView: (view: GooglePickerDocsView) => GooglePickerBuilder;
  setCallback: (callback: (data: GooglePickerResult) => void) => GooglePickerBuilder;
  build: () => { setVisible: (visible: boolean) => void };
}

interface Window {
  ARES_E2E_BYPASS?: boolean;
  FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string;
  grecaptcha?: {
    ready: (callback: () => void) => void;
    execute: (siteKey: string, options: { action: "submit" }) => Promise<string>;
  };
  gapi?: {
    load: (name: "picker", options: {
      callback: () => void;
      onerror: () => void;
      timeout: number;
      ontimeout: () => void;
    }) => void;
  };
  google?: {
    accounts?: {
      oauth2?: {
        initTokenClient: (configuration: {
          client_id: string;
          scope: string;
          callback: (response: { access_token?: string; error?: string }) => void;
          error_callback: () => void;
        }) => { requestAccessToken: (options: { prompt: "select_account" }) => void };
      };
    };
    picker?: {
      Action: { CANCEL: string; PICKED: string };
      ViewId: { FOLDERS: string };
      DocsView: new (viewId: string) => GooglePickerDocsView;
      PickerBuilder: new () => GooglePickerBuilder;
    };
  };
}

// Monaco's contribution entry points ship without type declarations; they are
// side-effect imports that register language services at runtime.
declare module "monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution";
declare module "monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution";
declare module "monaco-editor/esm/vs/language/typescript/monaco.contribution";
