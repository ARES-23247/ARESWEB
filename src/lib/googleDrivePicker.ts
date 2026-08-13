export interface GoogleDriveFolderSelection {
  id: string;
  name: string;
}

interface GoogleDrivePickerOptions {
  apiKey: string;
  appId: string;
  clientId: string;
}

const GIS_SCRIPT = "https://accounts.google.com/gsi/client";
const PICKER_SCRIPT = "https://apis.google.com/js/api.js";

function loadExternalScript(id: string, source: string): Promise<void> {
  const existing = document.getElementById(id) as HTMLScriptElement | null;
  if (existing?.dataset.loaded === "true") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = existing ?? document.createElement("script");
    script.id = id;
    script.src = source;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", () => reject(new Error("Google Drive Picker could not be loaded.")), { once: true });
    if (!existing) document.head.append(script);
  });
}

async function loadPickerLibrary(): Promise<void> {
  await Promise.all([
    loadExternalScript("google-identity-services", GIS_SCRIPT),
    loadExternalScript("google-picker-api", PICKER_SCRIPT),
  ]);
  if (!window.gapi || !window.google?.accounts?.oauth2) {
    throw new Error("Google Drive Picker is unavailable in this browser.");
  }
  await new Promise<void>((resolve, reject) => {
    window.gapi?.load("picker", {
      callback: resolve,
      onerror: () => reject(new Error("Google Drive Picker initialization failed.")),
      timeout: 10_000,
      ontimeout: () => reject(new Error("Google Drive Picker initialization timed out.")),
    });
  });
}

/**
 * Ask the administrator to choose one Drive folder. The short-lived Google
 * token stays only inside this function and is never persisted or sent to the
 * ARESWEB backend.
 */
export async function pickGoogleDriveFolder(options: GoogleDrivePickerOptions): Promise<GoogleDriveFolderSelection | null> {
  if (!options.apiKey || !options.appId || !options.clientId) {
    throw new Error("Google Drive Picker is not configured for this deployment.");
  }
  await loadPickerLibrary();
  const googleApi = window.google;
  const oauth2 = googleApi?.accounts?.oauth2;
  const pickerApi = googleApi?.picker;
  if (!oauth2 || !pickerApi) {
    throw new Error("Google Drive Picker is unavailable in this browser.");
  }

  const accessToken = await new Promise<string>((resolve, reject) => {
    const tokenClient = oauth2.initTokenClient({
      client_id: options.clientId,
      scope: "https://www.googleapis.com/auth/drive.file",
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error("Google Drive authorization was cancelled or denied."));
          return;
        }
        resolve(response.access_token);
      },
      error_callback: () => reject(new Error("Google Drive authorization could not be opened.")),
    });
    tokenClient.requestAccessToken({ prompt: "select_account" });
  });

  return new Promise<GoogleDriveFolderSelection | null>((resolve, reject) => {
    try {
      const folderView = new pickerApi.DocsView(pickerApi.ViewId.FOLDERS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true);
      const picker = new pickerApi.PickerBuilder()
        .setAppId(options.appId)
        .setDeveloperKey(options.apiKey)
        .setOAuthToken(accessToken)
        .addView(folderView)
        .setCallback((data) => {
          if (data.action === pickerApi.Action.CANCEL) {
            resolve(null);
            return;
          }
          if (data.action !== pickerApi.Action.PICKED) return;
          const selection = data.docs?.[0];
          if (!selection?.id || !selection.name) {
            reject(new Error("Google Drive did not return a valid folder selection."));
            return;
          }
          resolve({ id: selection.id, name: selection.name });
        })
        .build();
      picker.setVisible(true);
    } catch {
      reject(new Error("Google Drive Picker could not be displayed."));
    }
  });
}
