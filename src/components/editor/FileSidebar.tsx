import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

interface FileSidebarProps {
  files: Record<string, string>;
  activeFile: string;
  onActiveFileChange: (filename: string) => void;
  onFilesChange: (newFiles: Record<string, string>) => void;
  onCompile: (files: Record<string, string>) => void;
}

export function FileSidebar({ files, activeFile, onActiveFileChange, onFilesChange, onCompile }: FileSidebarProps) {
  const handleAddFile = () => {
    const name = prompt("Filename (e.g. Utils.js):");
    if (name && !files[name]) {
      const nf = { ...files, [name]: "// new file\\n" };
      onFilesChange(nf);
      onCompile(nf);
      onActiveFileChange(name);
    }
  };

  const handleDeleteFile = (f: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete ${f}?`)) {
      const nf = { ...files };
      delete nf[f];
      onFilesChange(nf);
      onCompile(nf);
      if (activeFile === f) onActiveFileChange('SimComponent.jsx');
    }
  };

  return (
    <div className="w-40 bg-obsidian border-r border-white/5 flex flex-col">
      <div className="p-2 text-xs font-bold text-white/50 uppercase tracking-wider flex justify-between items-center">
        Files
        <button onClick={handleAddFile} className="hover:text-white transition-colors">
          <Plus className="w-3 h-3"/>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {Object.keys(files).map(f => (
          <div key={f} 
               role="button"
               tabIndex={0}
               onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onActiveFileChange(f); }}
               className={`px-3 py-1.5 text-xs cursor-pointer flex justify-between items-center group transition-colors ${activeFile === f ? 'bg-ares-gray-dark text-ares-gold border-r-2 border-ares-gold' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
               onClick={() => onActiveFileChange(f)}>
             <span className="truncate">{f}</span>
             {f !== 'SimComponent.jsx' && (
               <button onClick={(e) => handleDeleteFile(f, e)} className="opacity-0 group-hover:opacity-100 hover:text-red-400">
                  <Trash2 className="w-3 h-3"/>
               </button>
             )}
          </div>
        ))}
      </div>
    </div>
  );
}
