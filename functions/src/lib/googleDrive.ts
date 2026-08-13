import { ApiError } from "../middleware/errorHandler";
import { getGoogleDriveAccessToken } from "./googleAuth";
import { logger } from "./logger";

const DRIVE_API_ORIGIN = "https://www.googleapis.com";
const DRIVE_ID_PATTERN = /^[A-Za-z0-9_-]{10,200}$/;
// Drive cursors are opaque. Accept visible ASCII and rely on URLSearchParams
// for encoding rather than guessing Google's current token alphabet.
const DRIVE_PAGE_TOKEN_PATTERN = /^[\x21-\x7E]{1,2048}$/;
const DRIVE_REQUEST_TIMEOUT_MS = 15_000;
const MAX_EXPORT_BYTES = 256 * 1024;
const MAX_ANCESTRY_DEPTH = 32;

export const GOOGLE_DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
export const GOOGLE_DOCUMENT_MIME_TYPE = "application/vnd.google-apps.document";

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  createdTime: string | null;
  modifiedTime: string | null;
  description: string | null;
  parents: string[];
  trashed: boolean;
  md5Checksum: string | null;
  size: string | null;
}

export interface GoogleDriveChange {
  fileId: string;
  removed: boolean;
  file: GoogleDriveFile | null;
}

interface DriveFileListResponse {
  files?: unknown;
  nextPageToken?: unknown;
}

interface DriveChangesResponse {
  changes?: unknown;
  nextPageToken?: unknown;
  newStartPageToken?: unknown;
}

function driveUrl(path: string, parameters: Readonly<Record<string, string | undefined>> = {}): URL {
  const url = new URL(path, DRIVE_API_ORIGIN);
  if (url.origin !== DRIVE_API_ORIGIN || !url.pathname.startsWith("/drive/v3/")) {
    throw new Error("Invalid Google Drive API request path.");
  }
  for (const [key, value] of Object.entries(parameters)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  return url;
}

function requiredDriveId(value: unknown, label = "Google Drive ID"): string {
  if (typeof value !== "string" || !DRIVE_ID_PATTERN.test(value)) {
    throw new ApiError(400, `Invalid ${label}.`);
  }
  return value;
}

function optionalPageToken(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !DRIVE_PAGE_TOKEN_PATTERN.test(value)) {
    throw new ApiError(400, "Invalid Google Drive page cursor.");
  }
  return value;
}

function boundedString(value: unknown, maximum: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maximum) : null;
}

function safeDriveLink(value: unknown, id: string): string {
  if (typeof value === "string") {
    try {
      const candidate = new URL(value);
      if (
        candidate.protocol === "https:"
        && candidate.hostname === "drive.google.com"
        && candidate.port === ""
        && candidate.username === ""
        && candidate.password === ""
      ) return candidate.toString();
    } catch {
      // Fall through to the canonical link.
    }
  }
  return `https://drive.google.com/open?id=${encodeURIComponent(id)}`;
}

function parseDriveFile(value: unknown): GoogleDriveFile {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(502, "Google Drive returned an invalid file record.");
  }
  const source = value as Record<string, unknown>;
  const id = requiredDriveId(source.id, "Google Drive file ID");
  const name = boundedString(source.name, 300);
  const mimeType = boundedString(source.mimeType, 200);
  if (!name || !mimeType) {
    throw new ApiError(502, "Google Drive returned an incomplete file record.");
  }
  const parents = Array.isArray(source.parents)
    ? source.parents.filter((parent): parent is string => typeof parent === "string" && DRIVE_ID_PATTERN.test(parent)).slice(0, 8)
    : [];
  return {
    id,
    name,
    mimeType,
    webViewLink: safeDriveLink(source.webViewLink, id),
    createdTime: boundedString(source.createdTime, 64),
    modifiedTime: boundedString(source.modifiedTime, 64),
    description: boundedString(source.description, 1_000),
    parents,
    trashed: source.trashed === true,
    md5Checksum: boundedString(source.md5Checksum, 128),
    size: typeof source.size === "string" && /^\d{1,20}$/.test(source.size) ? source.size : null,
  };
}

async function driveFetch(path: string, parameters?: Readonly<Record<string, string | undefined>>): Promise<Response> {
  const token = await getGoogleDriveAccessToken();
  const response = await fetch(driveUrl(path, parameters), {
    headers: { Authorization: `Bearer ${token}` },
    redirect: "error",
    signal: AbortSignal.timeout(DRIVE_REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    logger.error("drive", "Google Drive API request failed", { status: response.status });
    if (response.status === 404) {
      throw new ApiError(404, "The selected Google Drive item was not found or is no longer shared with the app.");
    }
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(503, "Google Drive authorization is unavailable. Reconnect the dedicated Drive account.");
    }
    throw new ApiError(502, "Google Drive could not complete the request. Try again later.");
  }
  return response;
}

const DRIVE_FILE_FIELDS = "id,name,mimeType,webViewLink,createdTime,modifiedTime,description,parents,trashed,md5Checksum,size";

export function isGoogleDriveId(value: unknown): value is string {
  return typeof value === "string" && DRIVE_ID_PATTERN.test(value);
}

export async function getGoogleDriveFile(fileId: string): Promise<GoogleDriveFile> {
  const id = requiredDriveId(fileId, "Google Drive file ID");
  const response = await driveFetch(`/drive/v3/files/${encodeURIComponent(id)}`, {
    fields: DRIVE_FILE_FIELDS,
    supportsAllDrives: "true",
  });
  return parseDriveFile(await response.json());
}

export async function listGoogleDriveFolder(input: {
  folderId: string;
  pageToken?: string;
  pageSize: number;
}): Promise<{ files: GoogleDriveFile[]; nextPageToken: string | null }> {
  const folderId = requiredDriveId(input.folderId, "Google Drive folder ID");
  const pageToken = optionalPageToken(input.pageToken);
  const pageSize = Number.isSafeInteger(input.pageSize) && input.pageSize >= 1 && input.pageSize <= 50
    ? input.pageSize
    : 25;
  const response = await driveFetch("/drive/v3/files", {
    q: `'${folderId}' in parents and trashed = false`,
    fields: `nextPageToken,files(${DRIVE_FILE_FIELDS})`,
    pageSize: String(pageSize),
    pageToken,
    orderBy: "folder,name_natural",
    spaces: "drive",
    includeItemsFromAllDrives: "true",
    supportsAllDrives: "true",
  });
  const payload = await response.json() as DriveFileListResponse;
  const files = Array.isArray(payload.files) ? payload.files.map(parseDriveFile) : [];
  return {
    files,
    nextPageToken: optionalPageToken(payload.nextPageToken) ?? null,
  };
}

export async function isDriveItemWithinRoot(itemId: string, rootFolderId: string): Promise<boolean> {
  const rootId = requiredDriveId(rootFolderId, "Google Drive root folder ID");
  let currentId = requiredDriveId(itemId, "Google Drive item ID");
  const seen = new Set<string>();
  for (let depth = 0; depth < MAX_ANCESTRY_DEPTH; depth += 1) {
    if (currentId === rootId) return true;
    if (seen.has(currentId)) return false;
    seen.add(currentId);
    const current = await getGoogleDriveFile(currentId);
    const parent = current.parents[0];
    if (!parent) return false;
    currentId = parent;
  }
  return false;
}

async function readBoundedText(response: Response): Promise<string | null> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_EXPORT_BYTES) return null;
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    total += result.value.byteLength;
    if (total > MAX_EXPORT_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(result.value);
  }
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(joined).trim() || null;
}

export async function exportGoogleDocumentText(fileId: string): Promise<string | null> {
  const id = requiredDriveId(fileId, "Google Drive file ID");
  const response = await driveFetch(`/drive/v3/files/${encodeURIComponent(id)}/export`, {
    mimeType: "text/plain",
  });
  return readBoundedText(response);
}

export async function getGoogleDriveStartPageToken(): Promise<string> {
  const response = await driveFetch("/drive/v3/changes/startPageToken", {
    supportsAllDrives: "true",
  });
  const payload = await response.json() as { startPageToken?: unknown };
  const token = optionalPageToken(payload.startPageToken);
  if (!token) throw new ApiError(502, "Google Drive returned an invalid change cursor.");
  return token;
}

export async function listGoogleDriveChanges(pageToken: string): Promise<{
  changes: GoogleDriveChange[];
  nextPageToken: string | null;
  newStartPageToken: string | null;
}> {
  const token = optionalPageToken(pageToken);
  if (!token) throw new ApiError(400, "A Google Drive change cursor is required.");
  const response = await driveFetch("/drive/v3/changes", {
    pageToken: token,
    pageSize: "100",
    fields: `nextPageToken,newStartPageToken,changes(fileId,removed,file(${DRIVE_FILE_FIELDS}))`,
    spaces: "drive",
    includeItemsFromAllDrives: "true",
    supportsAllDrives: "true",
  });
  const payload = await response.json() as DriveChangesResponse;
  const changes = Array.isArray(payload.changes)
    ? payload.changes.flatMap((value): GoogleDriveChange[] => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return [];
      const source = value as Record<string, unknown>;
      if (!isGoogleDriveId(source.fileId)) return [];
      let file: GoogleDriveFile | null = null;
      if (source.file !== undefined && source.file !== null) {
        try {
          file = parseDriveFile(source.file);
        } catch {
          return [];
        }
      }
      return [{ fileId: source.fileId, removed: source.removed === true, file }];
    })
    : [];
  return {
    changes,
    nextPageToken: optionalPageToken(payload.nextPageToken) ?? null,
    newStartPageToken: optionalPageToken(payload.newStartPageToken) ?? null,
  };
}
