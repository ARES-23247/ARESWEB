export interface GoogleDriveStatus {
  provider: "google-drive";
  accountOwner: "dedicated-team-storage-account";
  credentialConfigured: boolean;
  credentialStorage: "secret-manager";
  folderConfigured: boolean;
  folderName: string | null;
  oauthClientId: string | null;
  pickerAppId: string;
  capabilities: string[];
}

export interface GoogleDriveConfiguration {
  folderId: string;
  folderName: string;
  updatedAt: string | null;
  lastChangeCheckAt: string | null;
  lastChangeCount: number;
}

export interface GoogleDriveItem {
  id: string;
  name: string;
  kind: "folder" | "file";
  mimeType: string;
  webViewLink: string;
  createdTime: string | null;
  modifiedTime: string | null;
  description: string | null;
  size: string | null;
  imported: null | {
    slug: string;
    status: string;
    syncState: "current" | "changed" | "removed";
  };
}

export interface GoogleDriveBrowseResponse {
  rootFolder: { id: string; name: string };
  currentFolder: { id: string; name: string };
  files: GoogleDriveItem[];
  nextPageToken: string | null;
}
