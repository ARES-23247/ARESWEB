import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pickGoogleDriveFolder } from "@/lib/googleDrivePicker";

const options = { apiKey: "picker-key", appId: "205869391101", clientId: "client-id" };

class MockDocsView implements GooglePickerDocsView {
  setIncludeFolders = vi.fn(() => this);
  setSelectFolderEnabled = vi.fn(() => this);
}

function installLoadedScripts() {
  for (const id of ["google-identity-services", "google-picker-api"]) {
    const script = document.createElement("script");
    script.id = id;
    script.dataset.loaded = "true";
    document.head.append(script);
  }
}

function installGoogleApi(result: GooglePickerResult, tokenError = false) {
  let callback: ((data: GooglePickerResult) => void) | null = null;
  const builder: GooglePickerBuilder = {
    setAppId: vi.fn(() => builder),
    setDeveloperKey: vi.fn(() => builder),
    setOAuthToken: vi.fn(() => builder),
    addView: vi.fn(() => builder),
    setCallback: vi.fn((value) => {
      callback = value;
      return builder;
    }),
    build: vi.fn(() => ({
      setVisible: vi.fn(() => callback?.(result)),
    })),
  };
  window.gapi = { load: vi.fn((_name, config) => config.callback()) };
  window.google = {
    accounts: {
      oauth2: {
        initTokenClient: vi.fn((configuration) => ({
          requestAccessToken: vi.fn(() => {
            configuration.callback(tokenError ? { error: "denied" } : { access_token: "memory-only-token" });
          }),
        })),
      },
    },
    picker: {
      Action: { CANCEL: "cancel", PICKED: "picked" },
      ViewId: { FOLDERS: "folders" },
      DocsView: MockDocsView,
      PickerBuilder: class { constructor() { return builder; } } as unknown as new () => GooglePickerBuilder,
    },
  };
  return builder;
}

describe("Google Drive Picker", () => {
  beforeEach(() => installLoadedScripts());
  afterEach(() => {
    document.head.replaceChildren();
    delete window.google;
    delete window.gapi;
    vi.restoreAllMocks();
  });

  it("keeps the short-lived token in memory and returns only folder identity", async () => {
    const builder = installGoogleApi({ action: "picked", docs: [{ id: "1FOLDER_ID_123456789", name: "Team files" }] });
    await expect(pickGoogleDriveFolder(options)).resolves.toEqual({ id: "1FOLDER_ID_123456789", name: "Team files" });
    expect(builder.setOAuthToken).toHaveBeenCalledWith("memory-only-token");
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it("returns null when the user cancels", async () => {
    installGoogleApi({ action: "cancel" });
    await expect(pickGoogleDriveFolder(options)).resolves.toBeNull();
  });

  it("fails clearly on missing deployment configuration or denied authorization", async () => {
    await expect(pickGoogleDriveFolder({ ...options, apiKey: "" })).rejects.toThrow("not configured");
    installGoogleApi({ action: "cancel" }, true);
    await expect(pickGoogleDriveFolder(options)).rejects.toThrow("cancelled or denied");
  });
});
