import { useState, useMemo, ReactNode } from "react";
import { Folder, File, FileCode, Plus, Trash2, Edit2, ChevronRight } from "lucide-react";

interface SimFileExplorerProps {
  files: Record<string, string>;
  activeFile: string;
  setActiveFile: (f: string) => void;
  setFiles: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
}

type FileNode = {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: Record<string, FileNode>;
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

export function SimFileExplorer({ files, activeFile, setActiveFile, setFiles }: SimFileExplorerProps) {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({ "": true });

  const tree = useMemo(() => buildTree(Object.keys(files)), [files]);

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const handleCreateFile = (folderPath: string) => {
    const name = prompt("Enter file name (e.g., utils.ts):");
    if (!name) return;
    const fullPath = folderPath ? `${folderPath}/${name}` : name;
    if (files[fullPath]) return alert("File already exists");
    setFiles(prev => ({ ...prev, [fullPath]: "// new file\n" }));
    setActiveFile(fullPath);
    if (folderPath) setExpandedFolders(prev => ({ ...prev, [folderPath]: true }));
  };

  const handleDelete = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete ${path}?`)) return;
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
      setActiveFile(Object.keys(files).filter(k => k !== path && !k.startsWith(`${path}/`))[0] || "");
    }
  };

  const handleRename = (oldPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const parts = oldPath.split("/");
    const oldName = parts.pop();
    const folderPath = parts.join("/");
    const newName = prompt("Rename to:", oldName);
    if (!newName || newName === oldName) return;
    const newPath = folderPath ? `${folderPath}/${newName}` : newName;
    
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
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (isFolder) {
                toggleFolder(node.path);
              } else {
                setActiveFile(node.path);
              }
            }
          }}
          className={`group w-full flex items-center justify-between px-2 py-1 text-xs cursor-pointer select-none transition-colors ${
            isActive ? "bg-ares-gold/20 text-ares-gold" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
          }`}
          style={{ paddingLeft: `${(level * 12) + 8}px` }}
          onClick={() => isFolder ? toggleFolder(node.path) : setActiveFile(node.path)}
        >
          <div className="flex items-center gap-1.5 overflow-hidden">
            {isFolder ? (
              <>
                <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                <Folder className="w-3.5 h-3.5 shrink-0 text-blue-400" />
              </>
            ) : (
              <>
                <span className="w-3 h-3" /> {/* spacer for alignment */}
                {node.name.endsWith(".tsx") || node.name.endsWith(".ts") ? (
                  <FileCode className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                ) : (
                  <File className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
                )}
              </>
            )}
            <span className="truncate">{node.name}</span>
          </div>

          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
            {isFolder && (
              <button
                onClick={(e) => { e.stopPropagation(); handleCreateFile(node.path); }}
                className="p-1 hover:bg-white/10 rounded text-zinc-400 hover:text-white"
                title="New File in Folder"
              >
                <Plus className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={(e) => handleRename(node.path, e)}
              className="p-1 hover:bg-white/10 rounded text-zinc-400 hover:text-white"
              title="Rename"
            >
              <Edit2 className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => handleDelete(node.path, e)}
              className="p-1 hover:bg-white/10 rounded text-zinc-400 hover:text-red-400"
              title="Delete"
            >
              <Trash2 className="w-3 h-3" />
              </button>
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
    <div className="flex flex-col h-full bg-[#1e1e1e] border-r border-white/5">
      <div className="px-3 py-2 flex items-center justify-between border-b border-white/5">
        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Explorer</span>
        <div className="flex items-center gap-1">
          <button onClick={() => handleCreateFile("")} className="p-1 hover:bg-white/10 rounded text-zinc-400 hover:text-white" title="New File">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {renderNode(tree)}
      </div>
    </div>
  );
}
