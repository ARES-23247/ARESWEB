import { useState, useEffect } from "react";
import { Search, FileText, Table, Presentation, PenTool, AlertCircle, RefreshCw, X, HardDrive } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { useGetDriveFiles } from "../api/google-drive";

interface DrivePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string, title: string) => void;
}

export default function DrivePickerModal({ isOpen, onClose, onSelect }: DrivePickerModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [pageToken, setPageToken] = useState<string | undefined>();

  // Debounce search input (300ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPageToken(undefined); // Reset pagination when search changes
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch Drive files
  const { data, isLoading, error, refetch } = useGetDriveFiles({
    q: debouncedQuery || undefined,
    pageToken,
    pageSize: 50,
  });

  const files = data?.files ?? [];
  const nextPageToken = data?.nextPageToken;

  // File type icon mapping
  const getFileIcon = (mimeType: string) => {
    switch (mimeType) {
      case "application/vnd.google-apps.document":
        return <FileText size={18} className="text-ares-cyan" />;
      case "application/vnd.google-apps.spreadsheet":
        return <Table size={18} className="text-ares-gold" />;
      case "application/vnd.google-apps.presentation":
        return <Presentation size={18} className="text-orange-400" />;
      case "application/vnd.google-apps.drawing":
        return <PenTool size={18} className="text-purple-400" />;
      default:
        return <FileText size={18} className="text-white/60" />;
    }
  };

  // File type label mapping
  const getFileTypeLabel = (mimeType: string): string => {
    switch (mimeType) {
      case "application/vnd.google-apps.document": return "Doc";
      case "application/vnd.google-apps.spreadsheet": return "Sheet";
      case "application/vnd.google-apps.presentation": return "Slides";
      case "application/vnd.google-apps.drawing": return "Drawing";
      default: return "File";
    }
  };

  // File type badge color mapping
  const getFileBadgeClass = (mimeType: string): string => {
    switch (mimeType) {
      case "application/vnd.google-apps.document": return "bg-ares-cyan/10 text-ares-cyan border-ares-cyan/20";
      case "application/vnd.google-apps.spreadsheet": return "bg-ares-gold/10 text-ares-gold border-ares-gold/20";
      case "application/vnd.google-apps.presentation": return "bg-orange-400/10 text-orange-400 border-orange-400/20";
      case "application/vnd.google-apps.drawing": return "bg-purple-400/10 text-purple-400 border-purple-400/20";
      default: return "bg-white/10 text-white/60 border-white/10";
    }
  };

  // Document URL mapping
  const getDocumentUrl = (fileId: string, mimeType: string): string => {
    switch (mimeType) {
      case "application/vnd.google-apps.document": return `https://docs.google.com/document/d/${fileId}/edit`;
      case "application/vnd.google-apps.spreadsheet": return `https://docs.google.com/spreadsheets/d/${fileId}/edit`;
      case "application/vnd.google-apps.presentation": return `https://docs.google.com/presentation/d/${fileId}/edit`;
      case "application/vnd.google-apps.drawing": return `https://docs.google.com/drawings/d/${fileId}/edit`;
      default: return `https://drive.google.com/file/d/${fileId}/view`;
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSearchQuery("");
      onClose();
    }
  };

  const handleSelectFile = (fileId: string, mimeType: string, webViewLink: string | undefined, name: string) => {
    const url = webViewLink || getDocumentUrl(fileId, mimeType);
    onSelect(url, name);
    onClose();
    setSearchQuery("");
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9998] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-[50%] top-[50%] z-[9998] translate-x-[-50%] translate-y-[-50%] bg-obsidian border border-white/10 shadow-2xl ares-cut-lg w-[calc(100%-2rem)] max-w-4xl max-h-[85vh] flex flex-col overflow-hidden focus:outline-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10 bg-black/40 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-ares-cyan/10 flex items-center justify-center ares-cut-sm border border-ares-cyan/20">
                <HardDrive className="text-ares-cyan" size={20} aria-hidden="true" />
              </div>
              <div>
                <Dialog.Title className="text-xl font-black text-white tracking-widest uppercase m-0">
                  Select Document
                </Dialog.Title>
                <Dialog.Description className="text-xs text-white/60 font-mono m-0 mb-3">
                  Browse Google Drive to embed a file
                </Dialog.Description>
                <div className="flex flex-wrap items-center gap-2">
                  <a href="https://docs.google.com/document/create" target="_blank" rel="noopener noreferrer" className="px-2 py-1 bg-ares-cyan/10 hover:bg-ares-cyan/20 text-ares-cyan font-bold uppercase tracking-widest ares-cut-sm transition-all flex items-center gap-1.5 border border-ares-cyan/20 text-[9px]">
                    <FileText size={10} /> New Doc
                  </a>
                  <a href="https://docs.google.com/spreadsheets/create" target="_blank" rel="noopener noreferrer" className="px-2 py-1 bg-ares-gold/10 hover:bg-ares-gold/20 text-ares-gold font-bold uppercase tracking-widest ares-cut-sm transition-all flex items-center gap-1.5 border border-ares-gold/20 text-[9px]">
                    <Table size={10} /> New Sheet
                  </a>
                  <a href="https://docs.google.com/presentation/create" target="_blank" rel="noopener noreferrer" className="px-2 py-1 bg-orange-400/10 hover:bg-orange-400/20 text-orange-400 font-bold uppercase tracking-widest ares-cut-sm transition-all flex items-center gap-1.5 border border-orange-400/20 text-[9px]">
                    <Presentation size={10} /> New Slide
                  </a>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <button
                onClick={() => refetch()}
                disabled={isLoading}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white font-bold uppercase tracking-widest ares-cut-sm transition-all flex items-center gap-2 border border-white/10 disabled:opacity-50 text-[10px]"
                title="Refresh file list"
              >
                <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} />
                Refresh
              </button>
              <Dialog.Close asChild>
                <button
                  aria-label="Close modal"
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </Dialog.Close>
            </div>
          </div>

          <div className="p-4 border-b border-white/10 shrink-0">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search drive by name..."
                className="w-full bg-black/50 border border-white/10 pl-10 pr-4 py-2.5 text-white placeholder:text-white/40 focus:border-ares-cyan focus:outline-none transition-all text-sm ares-cut-sm"
              />
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto bg-obsidian">
            {error ? (
              <div className="p-8 text-center flex flex-col items-center">
                <AlertCircle size={32} className="text-ares-red mb-3" />
                <p className="text-ares-red font-bold text-sm">Failed to load documents</p>
                <p className="text-white/40 text-xs mt-1">Check your connection or try again.</p>
              </div>
            ) : isLoading && files.length === 0 ? (
              <div className="w-full h-48 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-white/10 border-t-ares-cyan rounded-full animate-spin" />
              </div>
            ) : files.length === 0 ? (
              <div className="w-full h-48 flex flex-col items-center justify-center text-white/20 gap-4">
                <FileText size={48} className="opacity-50" />
                <p className="font-mono text-sm">
                  {debouncedQuery ? `No documents match "${debouncedQuery}"` : "No documents found"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-4 px-6 py-2 bg-black/30 sticky top-0 z-10 border-b border-white/10">
                  <div className="col-span-6 text-[10px] font-bold uppercase tracking-wider text-white/40">Name</div>
                  <div className="col-span-2 text-center text-[10px] font-bold uppercase tracking-wider text-white/40">Type</div>
                  <div className="col-span-2 text-right text-[10px] font-bold uppercase tracking-wider text-white/40">Modified</div>
                  <div className="col-span-2 text-right text-[10px] font-bold uppercase tracking-wider text-white/40">Owner</div>
                </div>

                {/* Table Body */}
                {files.map((file) => (
                  <div
                    key={file.id}
                    onClick={() => handleSelectFile(file.id, file.mimeType, file.webViewLink, file.name)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelectFile(file.id, file.mimeType, file.webViewLink, file.name);
                      }
                    }}
                    className="grid grid-cols-12 gap-4 px-6 py-3 hover:bg-white/5 transition-all cursor-pointer group"
                  >
                    <div className="col-span-6 flex items-center gap-3 min-w-0">
                      <div className="shrink-0">{getFileIcon(file.mimeType)}</div>
                      <span className="text-white font-medium text-sm truncate group-hover:text-ares-cyan transition-colors">
                        {file.name}
                      </span>
                    </div>

                    <div className="col-span-2 flex items-center justify-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getFileBadgeClass(file.mimeType)}`}>
                        {getFileTypeLabel(file.mimeType)}
                      </span>
                    </div>

                    <div className="col-span-2 flex items-center justify-end">
                      <span className="text-white/40 text-[10px]">{formatDate(file.modifiedTime)}</span>
                    </div>

                    <div className="col-span-2 flex items-center justify-end">
                      <span className="text-white/40 text-[10px] truncate">{file.owner || "Unknown"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Pagination Loading */}
            {isLoading && files.length > 0 && (
              <div className="p-4 flex justify-center border-t border-white/5">
                <div className="w-5 h-5 border-2 border-white/10 border-t-ares-cyan rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Footer */}
          {nextPageToken && !isLoading && (
            <div className="p-4 border-t border-white/10 bg-black/40 flex justify-center shrink-0">
              <button
                onClick={() => setPageToken(nextPageToken)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white ares-cut-sm text-xs font-bold transition-all border border-white/10"
              >
                Load more files
              </button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
