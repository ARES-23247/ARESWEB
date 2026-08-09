import { useState, useEffect } from "react";
import { Plus, Shield, FileText, FolderSync, Settings, Loader2, X } from "lucide-react";
import { useDashboardDocController } from "@/hooks/dashboard/useDashboardDocController";
import { authenticatedFetch } from "@/lib/api";
import { toast } from "sonner";
import DocListGrid from "@/components/dashboard/DocListGrid";
import DocFormDrawer from "@/components/dashboard/DocFormDrawer";
import * as Dialog from "@radix-ui/react-dialog";

const DOCUMENTS_CATEGORIES = ["spec", "guide", "business"];

export default function DocumentsManagementPage() {
  const {
    docs,
    loadingList,
    isLive,
    revisions,
    loadingRevisions,
    fetchRevisions,
    selectedDoc,
    isEditorOpen,
    canEdit,
    isApprover,
    handleOpenEdit,
    handleOpenCreate,
    handleCloseEditor,
    handleSave,
    handleDelete
  } = useDashboardDocController("documents", (d) => d.isDeleted !== 1);

  const [isSyncing, setIsSyncing] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [folderIdInput, setFolderIdInput] = useState("");
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Fetch current folder config on mount
  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await authenticatedFetch("/api/drive/config");
        if (res.ok) {
          const data = await res.json();
          setFolderIdInput(data.folderId || "");
        }
      } catch (err) {
        console.warn("Failed to load Google Drive config", err);
      }
    }
    loadConfig();
  }, []);

  const handleSyncDrive = async () => {
    try {
      setIsSyncing(true);
      const res = await authenticatedFetch("/api/drive/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || "Drive sync failed.");
      }

      toast.success(
        data.syncedCount > 0
          ? `Synced ${data.syncedCount} documents from Google Drive!`
          : "Drive folder is up to date."
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to sync Google Drive folder.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveFolderConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSavingConfig(true);
      const res = await authenticatedFetch("/api/drive/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: folderIdInput })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || "Failed to save Folder ID.");
      }

      toast.success("Saved Google Drive folder configuration!");
      setIsConfigOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save Google Drive config.");
    } finally {
      setIsSavingConfig(false);
    }
  };

  return (
    <div className="space-y-10 w-full text-left">
      {/* Header */}
      <header className="border-b border-white/5 pb-8 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter font-heading flex items-center gap-3">
            <FileText className="text-ares-gold" size={32} />
            Cloud Resources
            {isLive ? (
              <span className="inline-flex items-center rounded-full bg-ares-success/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-ares-success ring-1 ring-inset ring-ares-success/30 ml-2">
                ● Live Sync
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-ares-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-ares-gold ring-1 ring-inset ring-ares-gold/30 ml-2">
                ● Sandbox
              </span>
            )}
          </h1>
          <p className="text-marble/70 text-sm mt-2 max-w-2xl font-medium">
            Manage, upload, and link specifications, manuals, and business portfolios.
          </p>
        </div>

        {canEdit && (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleSyncDrive}
              disabled={isSyncing}
              className="bg-white/5 hover:bg-ares-cyan/10 border border-white/10 hover:border-ares-cyan/40 text-ares-cyan font-bold text-xs uppercase tracking-wider py-3 px-4 rounded inline-flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              title="Scan and sync configured Google Drive folder"
            >
              {isSyncing ? <Loader2 size={16} className="animate-spin" /> : <FolderSync size={16} />}
              {isSyncing ? "Syncing..." : "Sync Google Drive"}
            </button>

            {isApprover && (
              <button
                onClick={() => setIsConfigOpen(true)}
                className="bg-white/5 hover:bg-white/10 border border-white/10 text-marble/80 font-bold text-xs uppercase tracking-wider p-3 rounded flex items-center justify-center transition-all cursor-pointer"
                title="Configure Google Drive Folder ID"
              >
                <Settings size={16} />
              </button>
            )}

            <button
              onClick={handleOpenCreate}
              className="clipped-button bg-ares-red text-white hover:bg-ares-red-dark font-black text-xs uppercase tracking-widest py-3 px-5 inline-flex items-center gap-2 cursor-pointer shadow-xl focus:ring-2 focus:ring-ares-cyan focus:outline-none"
            >
              <Plus size={16} /> New Document
            </button>
          </div>
        )}
      </header>

      {/* Guest Warning */}
      {!canEdit && (
        <div className="glass-card ares-cut border border-ares-bronze/20 text-marble/80 px-6 py-5 text-center text-xs font-semibold max-w-lg mx-auto flex items-center gap-3 justify-center">
          <Shield size={16} className="text-ares-gold shrink-0" />
          <span>🔒 Read-only Guest Mode: Request authorization clearance to modify the Documents database.</span>
        </div>
      )}

      {/* List Grid View */}
      <DocListGrid
        items={docs}
        loadingList={loadingList}
        canEdit={canEdit}
        variant="documents"
        onEdit={handleOpenEdit}
        onDelete={handleDelete}
        searchPlaceholder="Search documents by title, category, or summary..."
        noItemsMessage="No documents indexed in the library. Click New Document or Sync Google Drive to get started."
      />

      {/* Drawer Article Editor */}
      {isEditorOpen && (
        <DocFormDrawer
          isOpen={isEditorOpen}
          onClose={handleCloseEditor}
          editDoc={selectedDoc}
          categories={DOCUMENTS_CATEGORIES}
          defaultCategory="spec"
          variant="documents"
          onSave={handleSave}
          revisions={revisions}
          loadingRevisions={loadingRevisions}
          fetchRevisions={fetchRevisions}
        />
      )}

      {/* Config Modal */}
      <Dialog.Root open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 animate-fade-in" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-black/90 border border-white/10 p-6 rounded-lg shadow-2xl z-50 text-left">
            <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-3">
              <Dialog.Title className="text-base font-extrabold uppercase text-white tracking-wider flex items-center gap-2">
                <Settings size={18} className="text-ares-gold" /> Google Drive Folder Config
              </Dialog.Title>
              <Dialog.Close className="text-marble/60 hover:text-white transition-colors cursor-pointer">
                <X size={18} />
              </Dialog.Close>
            </div>

            <form onSubmit={handleSaveFolderConfig} className="space-y-4">
              <div>
                <label htmlFor="folderIdInput" className="block text-xs font-bold uppercase tracking-wider text-marble/70 mb-2">
                  Shared Drive Folder ID or URL
                </label>
                <input
                  id="folderIdInput"
                  type="text"
                  placeholder="https://drive.google.com/drive/folders/1ABC... or 1ABC..."
                  value={folderIdInput}
                  onChange={(e) => setFolderIdInput(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-cyan"
                  required
                />
                <p className="text-[11px] text-marble/50 mt-2 leading-relaxed">
                  Enter the folder ID or browser URL of the Google Drive folder containing your team specs, manuals, and portfolios.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsConfigOpen(false)}
                  className="px-4 py-2 text-xs font-bold uppercase text-marble hover:text-white bg-white/5 rounded transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingConfig}
                  className="px-5 py-2 text-xs font-black uppercase text-black bg-ares-gold hover:bg-white rounded transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSavingConfig ? "Saving..." : "Save Config"}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
