import { useCallback, useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  File,
  FilePlus2,
  Folder,
  FolderOpen,
  Loader2,
  RefreshCw,
  Settings,
  ShieldAlert,
  X,
} from "lucide-react";
import { TableFrame } from "@/components/ui/TableFrame";
import { toast } from "sonner";
import { authenticatedFetch } from "@/lib/api";
import { pickGoogleDriveFolder } from "@/lib/googleDrivePicker";
import type {
  GoogleDriveBrowseResponse,
  GoogleDriveConfiguration,
  GoogleDriveItem,
  GoogleDriveStatus,
} from "@/types/googleDrive";
import { logger } from "@/utils/logger";

interface FolderTrailEntry {
  id: string;
  name: string;
}

async function responseJson<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => null) as (T & { error?: string; message?: string }) | null;
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${payload?.error ?? payload?.message ?? fallback}`);
  }
  if (!payload) throw new Error(`HTTP ${response.status} ${response.statusText}: The Drive API returned invalid JSON.`);
  return payload;
}

function formatBytes(value: string | null): string {
  if (!value || !/^\d+$/u.test(value)) return "—";
  const bytes = Number(value);
  if (!Number.isSafeInteger(bytes) || bytes < 0) return "—";
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function formatDate(value: string | null): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleDateString();
}

function fileTypeLabel(item: GoogleDriveItem): string {
  if (item.kind === "folder") return "Folder";
  if (item.mimeType === "application/vnd.google-apps.document") return "Google Doc";
  if (item.mimeType === "application/vnd.google-apps.spreadsheet") return "Google Sheet";
  if (item.mimeType === "application/vnd.google-apps.presentation") return "Google Slides";
  if (item.mimeType === "application/pdf") return "PDF";
  return item.mimeType.split("/").at(-1)?.replace(/^vnd\./u, "") ?? "File";
}

function importStatus(item: GoogleDriveItem): string {
  if (!item.imported) return "Not imported";
  if (item.imported.syncState === "changed") return "Drive changed — review needed";
  if (item.imported.syncState === "removed") return "Unavailable in Drive";
  return `Imported as ${item.imported.status}`;
}

export default function GoogleDriveLibraryBrowser() {
  const [status, setStatus] = useState<GoogleDriveStatus | null>(null);
  const [config, setConfig] = useState<GoogleDriveConfiguration | null>(null);
  const [items, setItems] = useState<GoogleDriveItem[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [folderTrail, setFolderTrail] = useState<FolderTrailEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingState, setLoadingState] = useState<"initial" | "folder" | "more" | "import" | "changes" | null>("initial");
  const [error, setError] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [folderInput, setFolderInput] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);
  const [openingPicker, setOpeningPicker] = useState(false);

  const pickerApiKey = import.meta.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY ?? "";
  const currentFolder = folderTrail.at(-1) ?? null;
  const selectedFiles = useMemo(
    () => items.filter((item) => item.kind === "file" && selectedIds.has(item.id)),
    [items, selectedIds],
  );

  const browseFolder = useCallback(async (
    folderId?: string,
    pageToken?: string,
    append = false,
  ) => {
    setLoadingState(append ? "more" : "folder");
    setError(null);
    try {
      const response = await authenticatedFetch("/api/drive/browse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId, pageToken, pageSize: 25 }),
      });
      const payload = await responseJson<GoogleDriveBrowseResponse>(response, "Drive folder could not be loaded.");
      setItems((current) => append ? [...current, ...payload.files] : payload.files);
      setNextPageToken(payload.nextPageToken);
      setSelectedIds(new Set());
      if (!append) {
        setFolderTrail((current) => {
          const existingIndex = current.findIndex((entry) => entry.id === payload.currentFolder.id);
          if (existingIndex >= 0) return current.slice(0, existingIndex + 1);
          if (payload.currentFolder.id === payload.rootFolder.id) return [payload.rootFolder];
          return current.length > 0 ? [...current, payload.currentFolder] : [payload.rootFolder, payload.currentFolder];
        });
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Drive folder could not be loaded.";
      logger.error("Google Drive preview failed", caught);
      setError(message);
    } finally {
      setLoadingState(null);
    }
  }, []);

  const loadConnection = useCallback(async () => {
    setLoadingState("initial");
    setError(null);
    try {
      const [statusResponse, configResponse] = await Promise.all([
        authenticatedFetch("/api/drive/status"),
        authenticatedFetch("/api/drive/config"),
      ]);
      const [nextStatus, nextConfig] = await Promise.all([
        responseJson<GoogleDriveStatus>(statusResponse, "Drive connection status could not be loaded."),
        responseJson<GoogleDriveConfiguration>(configResponse, "Drive configuration could not be loaded."),
      ]);
      setStatus(nextStatus);
      setConfig(nextConfig);
      setFolderInput(nextConfig.folderId);
      if (nextStatus.credentialConfigured && nextConfig.folderId) {
        await browseFolder(nextConfig.folderId);
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Drive connection could not be loaded.";
      logger.error("Google Drive connection load failed", caught);
      setError(message);
    } finally {
      setLoadingState(null);
    }
  }, [browseFolder]);

  useEffect(() => {
    void loadConnection();
  }, [loadConnection]);

  const chooseFolder = async () => {
    if (!status?.oauthClientId || !status.pickerAppId || !pickerApiKey) {
      setError("Google Picker needs the deployment API key before it can open. You can still paste a folder link below.");
      return;
    }
    setOpeningPicker(true);
    setError(null);
    try {
      const selection = await pickGoogleDriveFolder({
        apiKey: pickerApiKey,
        appId: status.pickerAppId,
        clientId: status.oauthClientId,
      });
      if (selection) setFolderInput(selection.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Google Drive Picker could not be opened.");
    } finally {
      setOpeningPicker(false);
    }
  };

  const saveConfiguration = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingConfig(true);
    setError(null);
    try {
      const response = await authenticatedFetch("/api/drive/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: folderInput }),
      });
      const payload = await responseJson<{ success: true; config: GoogleDriveConfiguration }>(response, "Drive configuration could not be saved.");
      setConfig(payload.config);
      setStatus((current) => current ? { ...current, folderConfigured: true, folderName: payload.config.folderName } : current);
      setConfigOpen(false);
      setFolderTrail([]);
      await browseFolder(payload.config.folderId);
      toast.success(`Connected the Drive folder “${payload.config.folderName}”.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Drive configuration could not be saved.");
    } finally {
      setSavingConfig(false);
    }
  };

  const toggleSelection = (item: GoogleDriveItem) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(item.id)) next.delete(item.id);
      else if (next.size < 10) next.add(item.id);
      else toast.error("Import at most 10 files at a time.");
      return next;
    });
  };

  const importDrafts = async () => {
    if (!currentFolder || selectedFiles.length === 0) return;
    setLoadingState("import");
    setError(null);
    try {
      const response = await authenticatedFetch("/api/drive/import-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderId: currentFolder.id,
          fileIds: selectedFiles.map((item) => item.id),
          includeGoogleDocText: true,
        }),
      });
      const payload = await responseJson<{ imported: Array<{ outcome: "created" | "updated" }> }>(response, "Selected files could not be imported.");
      const created = payload.imported.filter((item) => item.outcome === "created").length;
      toast.success(created > 0 ? `Created ${created} document draft${created === 1 ? "" : "s"}.` : "Refreshed the selected Drive links.");
      await browseFolder(currentFolder.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Selected files could not be imported.");
    } finally {
      setLoadingState(null);
    }
  };

  const checkChanges = async () => {
    setLoadingState("changes");
    setError(null);
    try {
      const response = await authenticatedFetch("/api/drive/changes/check", { method: "POST" });
      const payload = await responseJson<{ updatedDocuments: number; hasMore: boolean }>(response, "Drive changes could not be checked.");
      toast.success(payload.updatedDocuments > 0
        ? `${payload.updatedDocuments} linked document${payload.updatedDocuments === 1 ? " needs" : "s need"} review.`
        : "Linked Drive files are current.");
      if (currentFolder) await browseFolder(currentFolder.id);
      if (payload.hasMore) toast.info("More Drive changes remain and will be checked during the next scheduled pass.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Drive changes could not be checked.");
    } finally {
      setLoadingState(null);
    }
  };

  return (
    <section aria-labelledby="drive-library-heading" className="glass-card ares-cut space-y-5 border border-white/10 p-5 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 id="drive-library-heading" className="flex items-center gap-2 font-heading text-xl font-black uppercase tracking-tight text-white">
            <FolderOpen aria-hidden="true" className="text-ares-gold" size={22} /> Google Drive library
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-marble/70">
            Preview the dedicated team storage folder, then import only selected files as unpublished drafts. Drive changes never publish automatically.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setConfigOpen(true)} className="inline-flex items-center gap-2 rounded border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold uppercase tracking-wider text-marble hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-ares-cyan">
            <Settings aria-hidden="true" size={15} /> Configure
          </button>
          {config?.folderId && (
            <button type="button" onClick={checkChanges} disabled={loadingState !== null} className="inline-flex items-center gap-2 rounded border border-ares-cyan/30 bg-ares-cyan/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-ares-cyan hover:bg-ares-cyan/20 focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50">
              {loadingState === "changes" ? <Loader2 aria-hidden="true" className="animate-spin" size={15} /> : <RefreshCw aria-hidden="true" size={15} />} Check changes
            </button>
          )}
        </div>
      </div>

      {loadingState === "initial" && <p role="status" className="text-sm text-marble/70">Loading Drive connection…</p>}
      {error && <div role="alert" className="flex gap-2 rounded border border-ares-red-light/40 bg-ares-red/10 p-3 text-sm text-ares-red-light"><ShieldAlert aria-hidden="true" className="mt-0.5 shrink-0" size={17} /><span>{error}</span></div>}

      {status && !status.credentialConfigured && (
        <div className="rounded border border-ares-gold/30 bg-ares-gold/10 p-4 text-sm text-marble">
          <p className="font-bold text-ares-gold">Operator connection required</p>
          <p className="mt-1">Add the dedicated <code>GOOGLE_DRIVE_REFRESH_TOKEN</code> Secret Manager value before browsing. The Photos token is intentionally not reused.</p>
        </div>
      )}

      {status?.credentialConfigured && !config?.folderId && (
        <div className="rounded border border-white/10 bg-black/20 p-5 text-center">
          <p className="text-sm font-bold text-white">No Drive root folder selected</p>
          <p className="mt-1 text-xs text-marble/60">Choose the folder that should be visible to ARESWEB. No files will be imported yet.</p>
          <button type="button" onClick={() => setConfigOpen(true)} className="mt-4 rounded bg-ares-gold px-4 py-2 text-xs font-black uppercase tracking-wider text-black focus-visible:ring-2 focus-visible:ring-ares-cyan">Choose root folder</button>
        </div>
      )}

      {status?.credentialConfigured && config?.folderId && (
        <>
          <nav aria-label="Google Drive folder path" className="flex flex-wrap items-center gap-2 text-xs text-marble/70">
            {folderTrail.map((entry, index) => (
              <span key={entry.id} className="inline-flex items-center gap-2">
                {index > 0 && <span aria-hidden="true">/</span>}
                <button type="button" onClick={() => browseFolder(entry.id)} disabled={entry.id === currentFolder?.id || loadingState !== null} className="font-bold text-ares-cyan underline-offset-2 hover:underline disabled:text-marble/60 disabled:no-underline">{entry.name}</button>
              </span>
            ))}
          </nav>

          <TableFrame
            caption="Google Drive folder contents"
            containerClassName="rounded border border-white/10"
            className="min-w-[760px]"
          >
              <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-marble/60">
                <tr><th className="w-12 p-3"><span className="sr-only">Select</span></th><th className="p-3">Name</th><th className="p-3">Type</th><th className="p-3">Modified</th><th className="p-3">Size</th><th className="p-3">Import state</th><th className="w-12 p-3"><span className="sr-only">Open</span></th></tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {items.map((item) => (
                  <tr key={item.id} className="text-marble/80 hover:bg-white/[0.03]">
                    <td className="p-3">
                      {item.kind === "file" && <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelection(item)} aria-label={`Select ${item.name}`} className="h-4 w-4 accent-ares-red focus-visible:ring-2 focus-visible:ring-ares-cyan" />}
                    </td>
                    <td className="p-3 font-semibold text-white">
                      {item.kind === "folder" ? <button type="button" onClick={() => browseFolder(item.id)} disabled={loadingState !== null} className="inline-flex items-center gap-2 text-left text-ares-cyan hover:underline disabled:opacity-50"><Folder aria-hidden="true" size={16} />{item.name}</button> : <span className="inline-flex items-center gap-2"><File aria-hidden="true" size={16} className="text-marble/50" />{item.name}</span>}
                    </td>
                    <td className="p-3">{fileTypeLabel(item)}</td><td className="p-3">{formatDate(item.modifiedTime)}</td><td className="p-3">{formatBytes(item.size)}</td>
                    <td className="p-3"><span className={item.imported?.syncState === "changed" || item.imported?.syncState === "removed" ? "text-ares-gold" : item.imported ? "text-ares-cyan" : "text-marble/50"}>{importStatus(item)}</span></td>
                    <td className="p-3"><a href={item.webViewLink} target="_blank" rel="noopener noreferrer" aria-label={`Open ${item.name} in Google Drive`} className="text-marble/60 hover:text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"><ExternalLink aria-hidden="true" size={15} /></a></td>
                  </tr>
                ))}
                {items.length === 0 && loadingState !== "folder" && <tr><td colSpan={7} className="p-8 text-center text-marble/60">This Drive folder is empty.</td></tr>}
              </tbody>
          </TableFrame>

          {loadingState === "folder" && <p role="status" className="text-sm text-marble/70">Loading folder contents…</p>}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2">
              {folderTrail.length > 1 && <button type="button" onClick={() => browseFolder(folderTrail.at(-2)?.id)} disabled={loadingState !== null} className="inline-flex items-center gap-2 rounded border border-white/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-marble hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50"><ArrowLeft aria-hidden="true" size={14} /> Parent folder</button>}
              {nextPageToken && currentFolder && <button type="button" onClick={() => browseFolder(currentFolder.id, nextPageToken, true)} disabled={loadingState !== null} className="rounded border border-white/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-marble hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50">{loadingState === "more" ? "Loading…" : "Load more"}</button>}
            </div>
            <button type="button" onClick={importDrafts} disabled={selectedFiles.length === 0 || loadingState !== null} className="inline-flex items-center justify-center gap-2 rounded bg-ares-red px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-ares-bronze focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:cursor-not-allowed disabled:opacity-50">
              {loadingState === "import" ? <Loader2 aria-hidden="true" className="animate-spin" size={16} /> : <FilePlus2 aria-hidden="true" size={16} />} Import {selectedFiles.length || "selected"} as draft{selectedFiles.length === 1 ? "" : "s"}
            </button>
          </div>
        </>
      )}

      <Dialog.Root open={configOpen} onOpenChange={setConfigOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded border border-white/10 bg-obsidian p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><Dialog.Title className="font-heading text-lg font-black uppercase text-white">Configure Google Drive</Dialog.Title><Dialog.Description className="mt-1 text-sm text-marble/60">Use the dedicated team storage account. Saving validates the folder but does not import its files.</Dialog.Description></div>
              <Dialog.Close aria-label="Close Drive configuration" className="rounded p-1 text-marble/60 hover:text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"><X aria-hidden="true" size={18} /></Dialog.Close>
            </div>
            <form onSubmit={saveConfiguration} className="mt-5 space-y-4">
              <button type="button" onClick={chooseFolder} disabled={openingPicker || !status?.oauthClientId || !pickerApiKey} className="inline-flex w-full items-center justify-center gap-2 rounded border border-ares-cyan/30 bg-ares-cyan/10 px-4 py-3 text-xs font-black uppercase tracking-wider text-ares-cyan hover:bg-ares-cyan/20 focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50">
                {openingPicker ? <Loader2 aria-hidden="true" className="animate-spin" size={16} /> : <FolderOpen aria-hidden="true" size={16} />} Choose with Google Drive
              </button>
              {!pickerApiKey && <p className="text-xs text-ares-gold">Picker is waiting for the restricted <code>NEXT_PUBLIC_GOOGLE_PICKER_API_KEY</code> deployment variable. Manual entry remains available.</p>}
              <div><label htmlFor="driveFolderInput" className="mb-2 block text-xs font-bold uppercase tracking-wider text-marble/70">Root folder link or ID</label><input id="driveFolderInput" value={folderInput} onChange={(event) => setFolderInput(event.target.value)} placeholder="https://drive.google.com/drive/folders/…" required className="w-full rounded border border-white/10 bg-black/60 px-4 py-3 text-sm text-white focus:border-ares-cyan focus:outline-none focus:ring-2 focus:ring-ares-cyan" /></div>
              <div className="rounded border border-white/10 bg-white/5 p-3 text-xs text-marble/70"><CheckCircle2 aria-hidden="true" className="mr-2 inline text-ares-cyan" size={15} />Files remain private in Drive. ARESWEB stores metadata only until an administrator explicitly imports a draft.</div>
              <div className="flex justify-end gap-3 border-t border-white/10 pt-4"><Dialog.Close type="button" className="rounded px-4 py-2 text-xs font-bold uppercase text-marble hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-ares-cyan">Cancel</Dialog.Close><button type="submit" disabled={savingConfig || !status?.credentialConfigured} className="rounded bg-ares-gold px-4 py-2 text-xs font-black uppercase text-black focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50">{savingConfig ? "Validating…" : "Save folder"}</button></div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
