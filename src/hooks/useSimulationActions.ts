import { useState, useCallback } from "react";
import { logger } from "../utils/logger";
import { toastApiError } from "../api/apiClient";

interface UseSimulationActionsProps {
  files: Record<string, string>;
  activeFile: string;
  simName: string;
  simId: string | null;
  setFiles: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setSimId: React.Dispatch<React.SetStateAction<string | null>>;
}

export function useSimulationActions({
  files,
  activeFile,
  simName,
  simId,
  setFiles,
  setSimId
}: UseSimulationActionsProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isSharingGist, setIsSharingGist] = useState(false);

  const handleSave = useCallback(async () => {
    if (!simName.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: simName, files: files, ...(simId ? { id: simId } : {}) }),
      });
      if (res.ok) {
        const data = await res.json() as { id?: string };
        if (data.id && !simId) {
          setSimId(data.id);
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set("simId", data.id.toString());
          window.history.replaceState({}, "", newUrl.toString());
        }
        const { toast } = await import("sonner");
        toast.success("Saved simulation!");
      } else {
        const errData = await res.json().catch(() => ({})) as { error?: string, message?: string, code?: string };
        toastApiError({ 
          message: errData.message || errData.error || res.statusText, 
          status: res.status,
          code: errData.code 
        }, "Save failed");
      }
    } catch (e) {
      logger.error("[SimPlayground] Save failed:", e);
      toastApiError(e, "Network error while saving simulation");
    } finally {
      setIsSaving(false);
    }
  }, [simName, files, simId, setSimId]);

  const handleShareGist = useCallback(async () => {
    setIsSharingGist(true);
    try {
      const res = await fetch("/api/simulations/gist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: simName, files }),
      });
      if (res.ok) {
        const data = await res.json() as { gistId: string, url: string };
        const shareUrl = `${window.location.origin}/academy/playground?gist=${encodeURIComponent(data.gistId)}`;
        await navigator.clipboard.writeText(shareUrl);
        setSimId(`gist:${data.gistId}`);
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete("simId");
        newUrl.searchParams.set("gist", data.gistId);
        window.history.replaceState({}, "", newUrl.toString());
        const { toast } = await import("sonner");
        toast.success("Shareable link generated and copied!");
      } else {
        throw new Error("Failed to create Gist");
      }
    } catch (e) {
      logger.error("[SimPlayground] Gist Share failed:", e);
      toastApiError(e, "Gist Generation Failed");
    } finally {
      setIsSharingGist(false);
    }
  }, [simName, files, setSimId]);

  const handleFormatCode = useCallback(async () => {
    try {
      const code = files[activeFile];
      if (!code) return;
      const prettier = (await import("prettier/standalone")).default;
      const prettierPluginBabel = await import("prettier/plugins/babel");
      const prettierPluginEstree = await import("prettier/plugins/estree");
      const prettierPluginTs = await import("prettier/plugins/typescript");
      const formatted = await prettier.format(code, {
        parser: "typescript",
        plugins: [prettierPluginBabel, prettierPluginEstree, prettierPluginTs],
        tabWidth: 2,
        printWidth: 100,
        semi: true,
      });
      setFiles(prev => ({ ...prev, [activeFile]: formatted }));
      const { toast } = await import("sonner");
      toast.success("Code formatted");
    } catch (e) {
      logger.error("Failed to format code:", e);
      toastApiError(e, "Format failed");
    }
  }, [files, activeFile, setFiles]);

  const handleDownloadZip = useCallback(async () => {
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      Object.entries(files).forEach(([path, content]) => {
        zip.file(path, content);
      });
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${simName.replace(/[^a-z0-9]/gi, "_").toLowerCase() || "simulation"}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      logger.error("Failed to download zip:", e);
    }
  }, [files, simName]);

  return {
    isSaving,
    isSharingGist,
    handleSave,
    handleShareGist,
    handleFormatCode,
    handleDownloadZip
  };
}
