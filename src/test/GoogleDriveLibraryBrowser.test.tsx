import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GoogleDriveLibraryBrowser from "@/components/dashboard/GoogleDriveLibraryBrowser";
import { authenticatedFetch } from "@/lib/api";
import { pickGoogleDriveFolder } from "@/lib/googleDrivePicker";

vi.mock("@/lib/api", () => ({ authenticatedFetch: vi.fn() }));
vi.mock("@/lib/googleDrivePicker", () => ({ pickGoogleDriveFolder: vi.fn() }));

function response(body: unknown, status = 200, statusText = "OK"): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { "Content-Type": "application/json" },
  });
}

const status = {
  provider: "google-drive" as const,
  accountOwner: "dedicated-team-storage-account" as const,
  credentialConfigured: true,
  credentialStorage: "secret-manager" as const,
  folderConfigured: true,
  folderName: "Team files",
  oauthClientId: "public-client-id",
  pickerAppId: "205869391101",
  capabilities: ["folder-picker", "paginated-preview", "draft-import"],
};

const config = {
  folderId: "1ROOT_FOLDER_123456789",
  folderName: "Team files",
  updatedAt: "2026-08-13T00:00:00.000Z",
  lastChangeCheckAt: null,
  lastChangeCount: 0,
};

const driveFile = {
  id: "1DRIVE_FILE_123456789",
  name: "Robot Guide",
  kind: "file" as const,
  mimeType: "application/vnd.google-apps.document",
  webViewLink: "https://drive.google.com/file/d/1DRIVE_FILE_123456789/view",
  createdTime: "2026-01-01T00:00:00.000Z",
  modifiedTime: "2026-08-13T00:00:00.000Z",
  description: "Robot documentation",
  size: null,
  imported: null,
};

function connectedApi(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = String(input);
  if (url === "/api/drive/status") return Promise.resolve(response(status));
  if (url === "/api/drive/config" && !init?.method) return Promise.resolve(response(config));
  if (url === "/api/drive/browse") {
    return Promise.resolve(response({
      rootFolder: { id: config.folderId, name: config.folderName },
      currentFolder: { id: config.folderId, name: config.folderName },
      files: [driveFile],
      nextPageToken: null,
    }));
  }
  throw new Error(`Unexpected request: ${url}`);
}

describe("GoogleDriveLibraryBrowser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_PICKER_API_KEY", "restricted-picker-key");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("reports the separate operator credential requirement without exposing secrets", async () => {
    vi.mocked(authenticatedFetch).mockImplementation(async (input) => {
      if (String(input) === "/api/drive/status") return response({ ...status, credentialConfigured: false, folderConfigured: false });
      return response({ ...config, folderId: "", folderName: "" });
    });
    render(<GoogleDriveLibraryBrowser />);

    expect(await screen.findByText("Operator connection required")).toBeInTheDocument();
    expect(screen.getByText(/GOOGLE_DRIVE_REFRESH_TOKEN/u)).toBeInTheDocument();
    expect(screen.queryByText("restricted-picker-key")).not.toBeInTheDocument();
  });

  it("previews Drive metadata and imports only explicitly selected files as drafts", async () => {
    let browseCount = 0;
    vi.mocked(authenticatedFetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === "/api/drive/status") return response(status);
      if (url === "/api/drive/config") return response(config);
      if (url === "/api/drive/browse") {
        browseCount += 1;
        return response({
          rootFolder: { id: config.folderId, name: config.folderName },
          currentFolder: { id: config.folderId, name: config.folderName },
          files: [{ ...driveFile, imported: browseCount > 1 ? { slug: `drive_${driveFile.id}`, status: "draft", syncState: "current" } : null }],
          nextPageToken: null,
        });
      }
      if (url === "/api/drive/import-drafts" && init?.method === "POST") {
        return response({ imported: [{ outcome: "created" }] }, 201, "Created");
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    render(<GoogleDriveLibraryBrowser />);

    expect(await screen.findByText("Robot Guide")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Robot Guide" }));
    fireEvent.click(screen.getByRole("button", { name: "Import 1 as draft" }));

    await waitFor(() => expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/drive/import-drafts",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          folderId: config.folderId,
          fileIds: [driveFile.id],
          includeGoogleDocText: true,
        }),
      }),
    ));
    expect(await screen.findByText("Imported as draft")).toBeInTheDocument();
  });

  it("uses Google Picker to choose a folder, then validates it server-side", async () => {
    vi.mocked(pickGoogleDriveFolder).mockResolvedValue({ id: "1PICKED_FOLDER_123456", name: "Picked files" });
    vi.mocked(authenticatedFetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === "/api/drive/status") return response({ ...status, folderConfigured: false, folderName: null });
      if (url === "/api/drive/config" && !init?.method) return response({ ...config, folderId: "", folderName: "" });
      if (url === "/api/drive/config" && init?.method === "POST") {
        return response({ success: true, config: { ...config, folderId: "1PICKED_FOLDER_123456", folderName: "Picked files" } });
      }
      if (url === "/api/drive/browse") {
        return response({
          rootFolder: { id: "1PICKED_FOLDER_123456", name: "Picked files" },
          currentFolder: { id: "1PICKED_FOLDER_123456", name: "Picked files" },
          files: [],
          nextPageToken: null,
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    render(<GoogleDriveLibraryBrowser />);

    fireEvent.click(await screen.findByRole("button", { name: "Choose root folder" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose with Google Drive" }));
    await waitFor(() => expect(screen.getByLabelText("Root folder link or ID")).toHaveValue("1PICKED_FOLDER_123456"));
    fireEvent.click(screen.getByRole("button", { name: "Save folder" }));

    await waitFor(() => expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/drive/config",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ folderId: "1PICKED_FOLDER_123456" }),
      }),
    ));
    expect(pickGoogleDriveFolder).toHaveBeenCalledWith({
      apiKey: "restricted-picker-key",
      appId: status.pickerAppId,
      clientId: status.oauthClientId,
    });
  });

  it("surfaces change checks and never silently converts failure into an empty folder", async () => {
    vi.mocked(authenticatedFetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === "/api/drive/status") return response(status);
      if (url === "/api/drive/config") return response(config);
      if (url === "/api/drive/browse") return connectedApi(input, init);
      if (url === "/api/drive/changes/check") return response({ error: "Drive authorization expired." }, 503, "Unavailable");
      throw new Error(`Unexpected request: ${url}`);
    });
    render(<GoogleDriveLibraryBrowser />);
    await screen.findByText("Robot Guide");
    fireEvent.click(screen.getByRole("button", { name: "Check changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Drive authorization expired");
    expect(screen.getByText("Robot Guide")).toBeInTheDocument();
  });
});
