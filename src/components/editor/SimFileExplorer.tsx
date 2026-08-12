import { useId, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, ChevronRight, Edit2, File, FileCode, Folder, FolderPlus, Lock, Plus, Trash2, X } from "lucide-react";

interface SimFileExplorerProps {
  files: Record<string, string>;
  activeFile: string;
  setActiveFile: (f: string) => void;
  setFiles: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  readOnlyFiles?: string[];
}

type FileNode = {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: Record<string, FileNode>;
};

type ExplorerDiagnostic = {
  kind: "error" | "status";
  message: string;
  detail: string;
};

type PendingDelete = {
  path: string;
  isFolder: boolean;
};

function buildTree(filePaths: string[]): FileNode {
  const root: FileNode = { name: "root", path: "", type: "folder", children: {} };
  for (const path of filePaths) {
    const parts = path.split("/");
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!current.children) current.children = {};
      if (i === parts.length - 1) {
        current.children[part] = { name: part, path, type: "file" };
      } else {
        if (!current.children[part]) {
          current.children[part] = { name: part, path: parts.slice(0, i + 1).join("/"), type: "folder", children: {} };
        }
        current = current.children[part];
      }
    }
  }
  return root;
}

export function SimFileExplorer({ files, activeFile, setActiveFile, setFiles, readOnlyFiles = [] }: SimFileExplorerProps) {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({ "": true });
  const [diagnostic, setDiagnostic] = useState<ExplorerDiagnostic | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const deleteHeadingId = useId();

  const tree = useMemo(() => buildTree(Object.keys(files)), [files]);

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const handleCreateFile = (folderPath: string) => {
    const name = prompt("Enter file name (e.g., utils.ts):");
    if (!name) return;
    const fullPath = folderPath ? `${folderPath}/${name}` : name;
    if (files[fullPath] !== undefined) {
      setDiagnostic({
        kind: "error",
        message: "File was not created.",
        detail: `A file already exists at ${fullPath}.`,
      });
      return;
    }
    setFiles(prev => ({ ...prev, [fullPath]: "// new file\n" }));
    setActiveFile(fullPath);
    if (folderPath) setExpandedFolders(prev => ({ ...prev, [folderPath]: true }));
    setDiagnostic({ kind: "status", message: "File created.", detail: fullPath });
  };

  const handleCreateFolder = (parentPath: string) => {
    const name = prompt("Enter folder name:");
    if (!name) return;
    const fullPath = parentPath ? `${parentPath}/${name}` : name;
    
    // Check if any file already exists with this prefix
    const exists = Object.keys(files).some(k => k === fullPath || k.startsWith(`${fullPath}/`));
    if (exists) {
      setDiagnostic({
        kind: "error",
        message: "Folder was not created.",
        detail: `A file or folder already exists at ${fullPath}.`,
      });
      return;
    }

    // We create a placeholder file so the folder shows up in the tree
    const placeholder = `${fullPath}/README.md`;
    setFiles(prev => ({ ...prev, [placeholder]: `# ${name}\n\nFolder created for organization.` }));
    if (parentPath) setExpandedFolders(prev => ({ ...prev, [parentPath]: true }));
    setExpandedFolders(prev => ({ ...prev, [fullPath]: true }));
    setDiagnostic({ kind: "status", message: "Folder created.", detail: fullPath });
  };

  const requestDelete = (path: string, isFolder: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    if (readOnlyFiles.includes(path)) {
      setDiagnostic({
        kind: "error",
        message: "This file is read-only.",
        detail: `${path} cannot be deleted from this explorer.`,
      });
      return;
    }
    setPendingDelete({ path, isFolder });
    setDiagnostic(null);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const { path } = pendingDelete;
    const remainingFiles = Object.keys(files).filter(k => k !== path && !k.startsWith(`${path}/`));
    setFiles(prev => {
      const next = { ...prev };
      // if it's a folder, delete all files inside
      Object.keys(next).forEach(k => {
        if (k === path || k.startsWith(`${path}/`)) {
          delete next[k];
        }
      });
      return next;
    });
    if (activeFile === path || activeFile.startsWith(`${path}/`)) {
      setActiveFile(remainingFiles[0] || "");
    }
    setPendingDelete(null);
    setDiagnostic({ kind: "status", message: "Item deleted.", detail: path });
  };

  const handleRename = (oldPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (readOnlyFiles.includes(oldPath)) {
      setDiagnostic({
        kind: "error",
        message: "This file is read-only.",
        detail: `${oldPath} cannot be renamed from this explorer.`,
      });
      return;
    }
    const parts = oldPath.split("/");
    const oldName = parts.pop();
    const folderPath = parts.join("/");
    const newName = prompt("Rename to:", oldName);
    if (!newName || newName === oldName) return;
    const newPath = folderPath ? `${folderPath}/${newName}` : newName;
    const targetExists = Object.keys(files).some(path => (
      path === newPath || (path.startsWith(`${newPath}/`) && !path.startsWith(`${oldPath}/`))
    ));
    if (targetExists) {
      setDiagnostic({
        kind: "error",
        message: "Item was not renamed.",
        detail: `A file or folder already exists at ${newPath}.`,
      });
      return;
    }
    
    setFiles(prev => {
      const next = { ...prev };
      // if file
      if (next[oldPath] !== undefined) {
        next[newPath] = next[oldPath];
        delete next[oldPath];
      } else {
        // if folder
        Object.keys(next).forEach(k => {
          if (k.startsWith(`${oldPath}/`)) {
            const newChildPath = k.replace(`${oldPath}/`, `${newPath}/`);
            next[newChildPath] = next[k];
            delete next[k];
          }
        });
      }
      return next;
    });
    if (activeFile === oldPath || activeFile.startsWith(`${oldPath}/`)) {
      setActiveFile(activeFile.replace(oldPath, newPath));
    }
    setDiagnostic({ kind: "status", message: "Item renamed.", detail: `${oldPath} → ${newPath}` });
  };

  const renderNode = (node: FileNode, level: number = 0): ReactNode => {
    if (node.name === "root") {
      return Object.values(node.children || {}).sort((a,b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === "folder" ? -1 : 1;
      }).map(child => renderNode(child, 0));
    }

    const isFolder = node.type === "folder";
    const isExpanded = expandedFolders[node.path];
    const isActive = activeFile === node.path;

    return (
      <div key={node.path}>
        <div
          className={`group w-full flex items-center justify-between py-0.5 pr-2 text-xs select-none transition-colors ${
            isActive ? "bg-ares-gold/20 text-ares-gold" : "text-marble/60 hover:bg-white/5 hover:text-marble/90"
          }`}
          style={{ paddingLeft: `${(level * 12) + 8}px` }}
        >
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-0 py-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            onClick={() => isFolder ? toggleFolder(node.path) : setActiveFile(node.path)}
            aria-expanded={isFolder ? Boolean(isExpanded) : undefined}
            aria-label={isFolder
              ? `${isExpanded ? "Collapse" : "Expand"} folder ${node.name}`
              : `Open file ${node.name}`}
          >
            {isFolder ? (
              <>
                <ChevronRight aria-hidden="true" className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                <Folder aria-hidden="true" className="w-3.5 h-3.5 shrink-0 text-ares-cyan" />
              </>
            ) : (
              <>
                <span aria-hidden="true" className="w-3 h-3" />
                {node.name.endsWith(".tsx") || node.name.endsWith(".ts") ? (
                  <FileCode aria-hidden="true" className="w-3.5 h-3.5 shrink-0 text-ares-cyan" />
                ) : (
                  <File aria-hidden="true" className="w-3.5 h-3.5 shrink-0 text-marble/60" />
                )}
              </>
            )}
            <span className="truncate">{node.name}</span>
            {readOnlyFiles.includes(node.path) && (
              <>
                <Lock aria-hidden="true" className="w-2.5 h-2.5 text-marble/60 ml-1 shrink-0" />
                <span className="sr-only">Read-only</span>
              </>
            )}
          </button>

          <div className="flex items-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            {isFolder && (
              <>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleCreateFile(node.path); }}
                  className="p-1 hover:bg-white/10 rounded text-marble/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                  title="New File"
                  aria-label={`Create file in ${node.path}`}
                >
                  <Plus aria-hidden="true" className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleCreateFolder(node.path); }}
                  className="p-1 hover:bg-white/10 rounded text-marble/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                  title="New Folder"
                  aria-label={`Create folder in ${node.path}`}
                >
                  <FolderPlus aria-hidden="true" className="w-3 h-3" />
                </button>
              </>
            )}
            {!readOnlyFiles.includes(node.path) && (
              <>
                <button
                  type="button"
                  onClick={(e) => handleRename(node.path, e)}
                  className="p-1 hover:bg-white/10 rounded text-marble/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                  title="Rename"
                  aria-label={`Rename ${isFolder ? "folder" : "file"} ${node.path}`}
                >
                  <Edit2 aria-hidden="true" className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={(e) => requestDelete(node.path, isFolder, e)}
                  className="p-1 rounded text-marble/60 hover:bg-ares-red hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                  title={isFolder ? "Delete Folder" : "Delete"}
                  aria-label={`Delete ${isFolder ? "folder" : "file"} ${node.path}`}
                >
                  <Trash2 aria-hidden="true" className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
        </div>

        {isFolder && isExpanded && node.children && (
          <div>
            {Object.values(node.children).sort((a,b) => {
              if (a.type === b.type) return a.name.localeCompare(b.name);
              return a.type === "folder" ? -1 : 1;
            }).map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <nav aria-label="Simulation file explorer" className="flex flex-col h-full bg-obsidian-surface border-r border-white/5">
      <div className="px-3 py-2 flex items-center justify-between border-b border-white/5">
        <span className="text-xs font-bold text-marble/60 uppercase tracking-wider">Explorer</span>
        <div className="flex items-center gap-0.5">
          <button type="button" onClick={() => handleCreateFile("")} className="p-1 hover:bg-white/10 rounded text-marble/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan" title="New File" aria-label="Create file">
            <Plus aria-hidden="true" className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={() => handleCreateFolder("")} className="p-1 hover:bg-white/10 rounded text-marble/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan" title="New Folder" aria-label="Create folder">
            <FolderPlus aria-hidden="true" className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {diagnostic && (
        <div
          role={diagnostic.kind === "error" ? "alert" : "status"}
          className={`mx-2 mt-2 border px-2 py-2 text-xs ${diagnostic.kind === "error"
            ? "border-ares-red bg-ares-red/10 text-white"
            : "border-ares-bronze bg-ares-bronze/10 text-marble"}`}
        >
          <div className="flex items-start gap-2">
            {diagnostic.kind === "error" && <AlertTriangle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white" />}
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{diagnostic.message}</p>
              <p className="mt-0.5 break-words font-mono text-marble/80">{diagnostic.detail}</p>
            </div>
            <button
              type="button"
              onClick={() => setDiagnostic(null)}
              className="rounded p-0.5 text-marble/70 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
              aria-label="Dismiss explorer message"
            >
              <X aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
      {pendingDelete && (
        <section aria-labelledby={deleteHeadingId} className="mx-2 mt-2 border border-ares-red bg-ares-red/10 p-2 text-xs text-white">
          <p id={deleteHeadingId} className="font-semibold">
            Delete {pendingDelete.isFolder ? "folder" : "file"}?
          </p>
          <p className="mt-1 break-words font-mono text-marble/80">{pendingDelete.path}</p>
          {pendingDelete.isFolder && <p className="mt-1 text-marble/80">Every file in this folder will be removed.</p>}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={confirmDelete}
              className="rounded bg-ares-red px-2 py-1 font-semibold text-white hover:bg-ares-bronze focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              Confirm delete
            </button>
            <button
              type="button"
              onClick={() => setPendingDelete(null)}
              className="rounded border border-marble/40 px-2 py-1 text-marble hover:border-white hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
              autoFocus
            >
              Cancel
            </button>
          </div>
        </section>
      )}
      <div className="flex-1 overflow-y-auto py-2">
        {renderNode(tree)}
      </div>
    </nav>
  );
}
