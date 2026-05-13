import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect, useMemo } from 'react';
import { useGetDriveFiles } from '../../api/google-drive';
import { Search, FileText, Table, Presentation, PenTool, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/dashboard/drive-docs')({
  component: DriveDocs,
});

function DriveDocs() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
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

  // File type icon mapping per D-09
  const getFileIcon = (mimeType: string) => {
    switch (mimeType) {
      case 'application/vnd.google-apps.document':
        return <FileText size={18} className="text-ares-cyan" />;
      case 'application/vnd.google-apps.spreadsheet':
        return <Table size={18} className="text-ares-gold" />;
      case 'application/vnd.google-apps.presentation':
        return <Presentation size={18} className="text-orange-400" />;
      case 'application/vnd.google-apps.drawing':
        return <PenTool size={18} className="text-purple-400" />;
      default:
        return <FileText size={18} className="text-white/60" />;
    }
  };

  // File type label mapping
  const getFileTypeLabel = (mimeType: string): string => {
    switch (mimeType) {
      case 'application/vnd.google-apps.document':
        return 'Doc';
      case 'application/vnd.google-apps.spreadsheet':
        return 'Sheet';
      case 'application/vnd.google-apps.presentation':
        return 'Slides';
      case 'application/vnd.google-apps.drawing':
        return 'Drawing';
      default:
        return 'File';
    }
  };

  // File type badge color mapping
  const getFileBadgeClass = (mimeType: string): string => {
    switch (mimeType) {
      case 'application/vnd.google-apps.document':
        return 'bg-ares-cyan/10 text-ares-cyan border-ares-cyan/20';
      case 'application/vnd.google-apps.spreadsheet':
        return 'bg-ares-gold/10 text-ares-gold border-ares-gold/20';
      case 'application/vnd.google-apps.presentation':
        return 'bg-orange-400/10 text-orange-400 border-orange-400/20';
      case 'application/vnd.google-apps.drawing':
        return 'bg-purple-400/10 text-purple-400 border-purple-400/20';
      default:
        return 'bg-white/10 text-white/60 border-white/10';
    }
  };

  // Document URL mapping per D-06/D-07
  const getDocumentUrl = (fileId: string, mimeType: string): string => {
    switch (mimeType) {
      case 'application/vnd.google-apps.document':
        return `https://docs.google.com/document/d/${fileId}/edit`;
      case 'application/vnd.google-apps.spreadsheet':
        return `https://docs.google.com/spreadsheets/d/${fileId}/edit`;
      case 'application/vnd.google-apps.presentation':
        return `https://docs.google.com/presentation/d/${fileId}/edit`;
      case 'application/vnd.google-apps.drawing':
        return `https://docs.google.com/drawings/d/${fileId}/edit`;
      default:
        return `https://drive.google.com/file/d/${fileId}/view`;
    }
  };

  // Open document in new tab
  const handleOpenDocument = (fileId: string, mimeType: string, webViewLink?: string) => {
    const url = webViewLink || getDocumentUrl(fileId, mimeType);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Format date for display
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  // Handle keyboard navigation
  const handleKeyDown = (fileId: string, mimeType: string, webViewLink?: string) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleOpenDocument(fileId, mimeType, webViewLink);
    }
  };

  return (
    <div className="flex-1 w-full flex flex-col min-h-0">
      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tighter">Google Drive Documents</h2>
          <p className="text-marble/60 text-sm mt-1">Browse and open team documents from Google Drive.</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="px-4 py-2 bg-obsidian hover:bg-obsidian/80 text-white font-black uppercase tracking-widest ares-cut-sm transition-all flex items-center gap-2 border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
          title="Refresh file list"
        >
          <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Search Input */}
      <div className="mb-6">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents by name..."
            className="w-full bg-obsidian border border-white/10 pl-10 pr-4 py-3 text-white placeholder:text-white/40 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all text-sm"
            aria-label="Search documents"
          />
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 p-4 bg-ares-red/10 border border-ares-red/30 flex items-start gap-3">
          <AlertCircle size={20} className="text-ares-red shrink-0 mt-0.5" />
          <div>
            <p className="text-ares-red font-bold text-sm">Failed to load documents</p>
            <p className="text-marble/60 text-xs mt-1">Please try refreshing the page or contact support if the issue persists.</p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="w-full h-64 flex items-center justify-center bg-obsidian border border-white/10 ares-cut-sm">
          <div className="w-8 h-8 border-4 border-white/10 border-t-ares-red rounded-full animate-spin" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && files.length === 0 && (
        <div className="w-full h-64 flex flex-col items-center justify-center text-white/20 gap-4 bg-obsidian border border-white/10 ares-cut-sm">
          <FileText size={48} className="opacity-50" />
          <p className="font-mono text-sm">
            {debouncedQuery ? `No documents match "${debouncedQuery}"` : 'No documents found'}
          </p>
          {debouncedQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="px-4 py-2 bg-ares-red/20 hover:bg-ares-red/30 text-white ares-cut-sm text-sm font-bold transition-all border border-ares-red/30"
            >
              Clear search
            </button>
          )}
        </div>
      )}

      {/* File Table */}
      {!isLoading && files.length > 0 && (
        <div className="bg-obsidian border border-white/10 ares-cut-sm overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-white/10 bg-black/30">
            <div className="col-span-5 text-xs font-bold uppercase tracking-wider text-white/40">Name</div>
            <div className="col-span-2 text-center text-xs font-bold uppercase tracking-wider text-white/40">Type</div>
            <div className="col-span-3 text-right text-xs font-bold uppercase tracking-wider text-white/40">Modified</div>
            <div className="col-span-2 text-right text-xs font-bold uppercase tracking-wider text-white/40">Owner</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-white/5">
            {files.map((file) => (
              <div
                key={file.id}
                onClick={() => handleOpenDocument(file.id, file.mimeType, file.webViewLink)}
                onKeyDown={handleKeyDown(file.id, file.mimeType, file.webViewLink)}
                role="button"
                tabIndex={0}
                className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-ares-red/5 hover:border-ares-red/20 transition-all cursor-pointer group"
                title="Click to open document"
              >
                {/* Name */}
                <div className="col-span-5 flex items-center gap-3 min-w-0">
                  <div className="shrink-0">
                    {getFileIcon(file.mimeType)}
                  </div>
                  <span className="text-white font-medium text-sm truncate group-hover:text-ares-red transition-colors">
                    {file.name}
                  </span>
                </div>

                {/* Type Badge */}
                <div className="col-span-2 flex items-center justify-center">
                  <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider border ${getFileBadgeClass(file.mimeType)}`}>
                    {getFileTypeLabel(file.mimeType)}
                  </span>
                </div>

                {/* Modified Date */}
                <div className="col-span-3 flex items-center justify-end">
                  <span className="text-marble/60 text-xs">
                    {formatDate(file.modifiedTime)}
                  </span>
                </div>

                {/* Owner */}
                <div className="col-span-2 flex items-center justify-end gap-2">
                  <span className="text-marble/60 text-xs truncate">
                    {file.owner || 'Unknown'}
                  </span>
                  <ExternalLink size={14} className="text-white/20 group-hover:text-ares-red transition-colors shrink-0" />
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Footer */}
          {nextPageToken && (
            <div className="px-6 py-3 border-t border-white/10 bg-black/30 flex justify-center">
              <button
                onClick={() => setPageToken(nextPageToken)}
                className="px-4 py-2 bg-ares-red/20 hover:bg-ares-red/30 text-ares-red ares-cut-sm text-xs font-bold transition-all border border-ares-red/30"
              >
                Load more files
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
