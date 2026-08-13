import { adminDb } from "./firebase-admin";
import {
  exportGoogleDocumentText,
  getGoogleDriveFile,
  getGoogleDriveStartPageToken,
  GOOGLE_DOCUMENT_MIME_TYPE,
  GOOGLE_DRIVE_FOLDER_MIME_TYPE,
  isDriveItemWithinRoot,
  listGoogleDriveChanges,
  listGoogleDriveFolder,
  type GoogleDriveFile,
} from "./googleDrive";
import { ApiError } from "../middleware/errorHandler";
import { logger } from "./logger";

const DRIVE_CONFIG_PATH = "system_settings/drive_config";
const MAX_CHANGE_PAGES_PER_RUN = 5;

interface StoredDriveConfiguration {
  rootFolderId: string;
  rootFolderName: string;
  changePageToken: string;
  updatedAt: string;
  lastChangeCheckAt?: string;
  lastChangeCount?: number;
}

export interface DriveConfigurationDto {
  folderId: string;
  folderName: string;
  updatedAt: string | null;
  lastChangeCheckAt: string | null;
  lastChangeCount: number;
}

export interface DriveItemDto {
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

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseStoredConfiguration(value: FirebaseFirestore.DocumentData | undefined): StoredDriveConfiguration | null {
  const rootFolderId = optionalString(value?.rootFolderId ?? value?.folderId);
  const rootFolderName = optionalString(value?.rootFolderName);
  const changePageToken = optionalString(value?.changePageToken);
  const updatedAt = optionalString(value?.updatedAt);
  const lastChangeCount = value?.lastChangeCount;
  if (!rootFolderId || !rootFolderName || !changePageToken || !updatedAt) return null;
  return {
    rootFolderId,
    rootFolderName,
    changePageToken,
    updatedAt,
    lastChangeCheckAt: optionalString(value?.lastChangeCheckAt) ?? undefined,
    lastChangeCount: Number.isSafeInteger(lastChangeCount) && typeof lastChangeCount === "number" && lastChangeCount >= 0
      ? lastChangeCount
      : undefined,
  };
}

function configDto(config: StoredDriveConfiguration | null): DriveConfigurationDto {
  return {
    folderId: config?.rootFolderId ?? "",
    folderName: config?.rootFolderName ?? "",
    updatedAt: config?.updatedAt ?? null,
    lastChangeCheckAt: config?.lastChangeCheckAt ?? null,
    lastChangeCount: config?.lastChangeCount ?? 0,
  };
}

function safeStatus(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.slice(0, 40) : "draft";
}

function safeSyncState(value: unknown): "current" | "changed" | "removed" {
  return value === "changed" || value === "removed" ? value : "current";
}

function fileDescription(file: GoogleDriveFile): string {
  return file.description ?? `Linked from Google Drive (${file.name})`;
}

function titleWithoutExtension(name: string): string {
  return name.replace(/\.[^/.]+$/u, "").trim().slice(0, 200) || "Untitled Drive file";
}

export function inferDriveDocumentCategory(name: string, mimeType = ""): "spec" | "guide" | "business" {
  const lowerName = name.toLowerCase();
  const lowerMime = mimeType.toLowerCase();
  if (
    lowerMime.includes("spreadsheet")
    || lowerMime.includes("presentation")
    || ["business", "portfolio", "finance", "budget", "sponsor"].some((term) => lowerName.includes(term))
  ) return "business";
  if (["guide", "manual", "tutorial", "checklist", "rule", "handbook"].some((term) => lowerName.includes(term))) {
    return "guide";
  }
  return "spec";
}

export async function getDriveConfiguration(): Promise<DriveConfigurationDto> {
  const snapshot = await adminDb.doc(DRIVE_CONFIG_PATH).get();
  return configDto(snapshot.exists ? parseStoredConfiguration(snapshot.data()) : null);
}

async function requireStoredDriveConfiguration(): Promise<StoredDriveConfiguration> {
  const snapshot = await adminDb.doc(DRIVE_CONFIG_PATH).get();
  const config = snapshot.exists ? parseStoredConfiguration(snapshot.data()) : null;
  if (!config) {
    throw new ApiError(409, "Configure a Google Drive root folder before browsing or importing files.");
  }
  return config;
}

export async function configureDriveRoot(folderId: string): Promise<DriveConfigurationDto> {
  const folder = await getGoogleDriveFile(folderId);
  if (folder.trashed || folder.mimeType !== GOOGLE_DRIVE_FOLDER_MIME_TYPE) {
    throw new ApiError(400, "The selected Google Drive item must be an active folder.");
  }
  const changePageToken = await getGoogleDriveStartPageToken();
  const now = new Date().toISOString();
  const config: StoredDriveConfiguration = {
    rootFolderId: folder.id,
    rootFolderName: folder.name,
    changePageToken,
    updatedAt: now,
  };
  await adminDb.doc(DRIVE_CONFIG_PATH).set(config);
  logger.info("drive", "Updated the Google Drive root folder configuration");
  return configDto(config);
}

async function importedState(fileId: string): Promise<DriveItemDto["imported"]> {
  const slug = `drive_${fileId}`;
  const snapshot = await adminDb.collection("documents").doc(slug).get();
  if (!snapshot.exists) return null;
  const data = snapshot.data();
  if (data?.source !== "google_drive" || data?.driveFileId !== fileId) return null;
  return {
    slug,
    status: safeStatus(data.status),
    syncState: safeSyncState(data.driveSyncState),
  };
}

async function driveItemDto(file: GoogleDriveFile): Promise<DriveItemDto> {
  return {
    id: file.id,
    name: file.name,
    kind: file.mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE ? "folder" : "file",
    mimeType: file.mimeType,
    webViewLink: file.webViewLink,
    createdTime: file.createdTime,
    modifiedTime: file.modifiedTime,
    description: file.description,
    size: file.size,
    imported: file.mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE ? null : await importedState(file.id),
  };
}

export async function browseDriveFolder(input: {
  folderId?: string;
  pageToken?: string;
  pageSize: number;
}): Promise<{
  rootFolder: { id: string; name: string };
  currentFolder: { id: string; name: string };
  files: DriveItemDto[];
  nextPageToken: string | null;
}> {
  const config = await requireStoredDriveConfiguration();
  const folderId = input.folderId ?? config.rootFolderId;
  if (!(await isDriveItemWithinRoot(folderId, config.rootFolderId))) {
    throw new ApiError(403, "The selected folder is outside the configured Google Drive root.");
  }
  const folder = await getGoogleDriveFile(folderId);
  if (folder.trashed || folder.mimeType !== GOOGLE_DRIVE_FOLDER_MIME_TYPE) {
    throw new ApiError(400, "The selected Google Drive item is not an active folder.");
  }
  const page = await listGoogleDriveFolder({
    folderId,
    pageToken: input.pageToken,
    pageSize: input.pageSize,
  });
  return {
    rootFolder: { id: config.rootFolderId, name: config.rootFolderName },
    currentFolder: { id: folder.id, name: folder.name },
    files: await Promise.all(page.files.map(driveItemDto)),
    nextPageToken: page.nextPageToken,
  };
}

export async function importDriveDrafts(input: {
  folderId: string;
  fileIds: string[];
  includeGoogleDocText: boolean;
}): Promise<Array<{ id: string; slug: string; title: string; outcome: "created" | "updated"; textImported: boolean }>> {
  const config = await requireStoredDriveConfiguration();
  if (!(await isDriveItemWithinRoot(input.folderId, config.rootFolderId))) {
    throw new ApiError(403, "The selected folder is outside the configured Google Drive root.");
  }
  const files = await Promise.all(input.fileIds.map(getGoogleDriveFile));
  for (const file of files) {
    if (file.trashed || file.mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE || !file.parents.includes(input.folderId)) {
      throw new ApiError(400, "Every selected item must be an active file in the current Drive folder.");
    }
  }

  const refs = files.map((file) => adminDb.collection("documents").doc(`drive_${file.id}`));
  const existing = await Promise.all(refs.map((ref) => ref.get()));
  const exportedText = await Promise.all(files.map((file) => (
    input.includeGoogleDocText && file.mimeType === GOOGLE_DOCUMENT_MIME_TYPE
      ? exportGoogleDocumentText(file.id)
      : Promise.resolve(null)
  )));
  const now = new Date().toISOString();
  const batch = adminDb.batch();
  const results = files.map((file, index) => {
    const slug = `drive_${file.id}`;
    const sourceMetadata = {
      source: "google_drive",
      driveFileId: file.id,
      driveName: file.name,
      driveMimeType: file.mimeType,
      driveModifiedTime: file.modifiedTime,
      driveMd5Checksum: file.md5Checksum,
      driveSyncState: "current",
      driveCheckedAt: now,
      fileUrl: file.webViewLink,
    };
    const isExisting = existing[index].exists;
    if (isExisting) {
      const existingData = existing[index].data();
      if (existingData?.source !== "google_drive" || existingData?.driveFileId !== file.id) {
        throw new ApiError(409, "A document already uses the reserved Google Drive record identifier.");
      }
      batch.set(refs[index], sourceMetadata, { merge: true });
    } else {
      const createdDate = file.createdTime?.split("T")[0] ?? now.split("T")[0];
      batch.set(refs[index], {
        title: titleWithoutExtension(file.name),
        category: inferDriveDocumentCategory(file.name, file.mimeType),
        sortOrder: 0,
        description: fileDescription(file),
        content: exportedText[index] ?? `Linked Google Drive file: [${file.name}](${file.webViewLink})`,
        status: "draft",
        approvalStatus: "draft",
        isDeleted: 0,
        displayInAreslib: 0,
        displayInMathCorner: 0,
        displayInScienceCorner: 0,
        isPortfolio: 0,
        isExecutiveSummary: 0,
        createdAt: createdDate,
        date: createdDate,
        updatedAt: now,
        driveImportedAt: now,
        ...sourceMetadata,
      });
    }
    return {
      id: file.id,
      slug,
      title: titleWithoutExtension(file.name),
      outcome: isExisting ? "updated" as const : "created" as const,
      textImported: exportedText[index] !== null,
    };
  });
  await batch.commit();
  logger.info("drive", "Imported selected Google Drive files as document drafts", { count: results.length });
  return results;
}

export async function syncImportedDriveChanges(): Promise<{
  checkedChanges: number;
  updatedDocuments: number;
  hasMore: boolean;
}> {
  const config = await requireStoredDriveConfiguration();
  let cursor = config.changePageToken;
  let checkedChanges = 0;
  let updatedDocuments = 0;
  let hasMore = false;
  const now = new Date().toISOString();

  for (let pageIndex = 0; pageIndex < MAX_CHANGE_PAGES_PER_RUN; pageIndex += 1) {
    const page = await listGoogleDriveChanges(cursor);
    checkedChanges += page.changes.length;
    const refs = page.changes.map((change) => adminDb.collection("documents").doc(`drive_${change.fileId}`));
    const snapshots = await Promise.all(refs.map((ref) => ref.get()));
    const batch = adminDb.batch();
    let pageUpdates = 0;
    page.changes.forEach((change, index) => {
      const snapshot = snapshots[index];
      const data = snapshot.data();
      if (!snapshot.exists || data?.source !== "google_drive" || data?.driveFileId !== change.fileId) return;
      const removed = change.removed || change.file?.trashed === true || change.file === null;
      batch.set(refs[index], {
        driveSyncState: removed ? "removed" : "changed",
        driveCheckedAt: now,
        driveName: change.file?.name ?? data.driveName ?? null,
        driveMimeType: change.file?.mimeType ?? data.driveMimeType ?? null,
        driveModifiedTime: change.file?.modifiedTime ?? data.driveModifiedTime ?? null,
        driveMd5Checksum: change.file?.md5Checksum ?? data.driveMd5Checksum ?? null,
        ...(removed ? {} : { fileUrl: change.file?.webViewLink }),
      }, { merge: true });
      pageUpdates += 1;
      updatedDocuments += 1;
    });
    if (pageUpdates > 0) await batch.commit();

    if (page.nextPageToken) {
      cursor = page.nextPageToken;
      hasMore = pageIndex === MAX_CHANGE_PAGES_PER_RUN - 1;
      if (hasMore) break;
      continue;
    }
    if (!page.newStartPageToken) {
      throw new ApiError(502, "Google Drive did not return a continuation cursor.");
    }
    cursor = page.newStartPageToken;
    hasMore = false;
    break;
  }

  await adminDb.doc(DRIVE_CONFIG_PATH).set({
    changePageToken: cursor,
    lastChangeCheckAt: now,
    lastChangeCount: updatedDocuments,
  }, { merge: true });
  logger.info("drive", "Checked imported Google Drive files for changes", {
    checkedChanges,
    updatedDocuments,
    hasMore,
  });
  return { checkedChanges, updatedDocuments, hasMore };
}
