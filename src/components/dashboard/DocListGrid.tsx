import React, { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Pencil, Archive, ExternalLink, Search, CheckCircle2, RotateCcw, Share2 } from "lucide-react";
import { cleanThumbnailUrl } from "@/lib/utils";
import type { DocRecord, DocumentConnectionState } from "@/hooks/useDocumentSync";
import AuthenticatedImage from "@/components/media/AuthenticatedImage";
import { TableFrame } from "@/components/ui/TableFrame";

interface DocListGridProps {
  items: DocRecord[];
  loadingList: boolean;
  canEdit: boolean;
  isApprover?: boolean;
  onApprove?: (item: DocRecord) => void | Promise<unknown>;
  reviewingSlug?: string | null;
  approvingSlug?: string | null;
  onSyndicate?: (item: DocRecord) => void | Promise<void>;
  syndicatingSlug?: string | null;
  variant?: "docs" | "documents" | "blog";
  onEdit: (item: DocRecord) => void;
  onDelete: (slug: string) => void;
  onRestore?: (slug: string) => void;
  pendingArchiveSlug?: string | null;
  isArchiving?: boolean;
  archiveError?: string | null;
  onConfirmArchive?: () => void;
  onCancelArchive?: () => void;
  connectionState?: DocumentConnectionState;
  error?: string | null;
  hasMore?: boolean;
  onLoadMore?: () => void;
  searchPlaceholder?: string;
  noItemsMessage?: string;
}

export default function DocListGrid({
  items,
  loadingList,
  canEdit,
  isApprover = false,
  onApprove,
  reviewingSlug = null,
  approvingSlug = null,
  onSyndicate,
  syndicatingSlug = null,
  variant = "docs",
  onEdit,
  onDelete,
  onRestore,
  pendingArchiveSlug = null,
  isArchiving = false,
  archiveError = null,
  onConfirmArchive,
  onCancelArchive,
  connectionState = "connected",
  error = null,
  hasMore = false,
  onLoadMore,
  searchPlaceholder = "Search records...",
  noItemsMessage = "No records found."
}: DocListGridProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<"updated" | "title" | "category">("updated");
  const archiveCancelRef = useRef<HTMLButtonElement>(null);

  const filteredItems = useMemo(() => {
    const queryStr = searchQuery.toLowerCase().trim();
    const filtered = items.filter((item) => !queryStr
      || item.title.toLowerCase().includes(queryStr)
      || item.description.toLowerCase().includes(queryStr)
      || item.category.toLowerCase().includes(queryStr)
      || item.slug.toLowerCase().includes(queryStr));
    return filtered.sort((left, right) => {
      if (sortMode === "title") return left.title.localeCompare(right.title);
      if (sortMode === "category") return left.category.localeCompare(right.category) || left.title.localeCompare(right.title);
      return (right.updatedAt || right.createdAt || "").localeCompare(left.updatedAt || left.createdAt || "");
    });
  }, [items, searchQuery, sortMode]);

  const pendingArchiveItem = items.find((item) => item.slug === pendingArchiveSlug);

  useEffect(() => {
    if (pendingArchiveSlug) archiveCancelRef.current?.focus();
  }, [pendingArchiveSlug]);

  return (
    <div className="glass-card border border-white/10 ares-cut-lg overflow-hidden shadow-xl">
      {/* List Header and Search */}
      <div className="p-6 border-b border-white/5 bg-black/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="text-xs font-black uppercase text-ares-gold tracking-widest">
          {variant === "docs" && <span>Active Documentation Articles</span>}
          {variant === "documents" && <span>Active Team Documents</span>}
          {variant === "blog" && <span>Active Blog Posts</span>}
          <span className="text-marble/40 ml-2 font-mono">
            {loadingList ? "Syncing..." : `(${filteredItems.length} records)`}
          </span>
        </div>
        <div className="flex w-full sm:w-auto flex-col sm:flex-row gap-2">
          <div>
            <label htmlFor={`record-sort-${variant}`} className="sr-only">Sort records</label>
            <select
              id={`record-sort-${variant}`}
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as typeof sortMode)}
              className="w-full bg-black/40 border border-white/10 text-white text-xs rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ares-cyan"
            >
              <option value="updated">Recently updated</option>
              <option value="title">Title A–Z</option>
              <option value="category">Category</option>
            </select>
          </div>
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-marble/40" aria-hidden="true" />
            <label htmlFor={`record-search-${variant}`} className="sr-only">Search records</label>
            <input
              id={`record-search-${variant}`}
              type="search"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-black/40 border border-white/10 text-white placeholder-marble/40 text-xs rounded font-medium focus:outline-none focus:border-ares-cyan focus:ring-1 focus:ring-ares-cyan transition-all"
            />
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="border-b border-ares-red/45 bg-ares-red/15 px-6 py-4 text-white">
          <p className="text-xs font-bold">
            {connectionState === "offline" ? "The library is offline. Previously loaded records may be shown." : "The record library could not be loaded."}
          </p>
          <p className="mt-1 break-words font-mono text-[10px] text-white/80">{error}</p>
        </div>
      )}

      <TableFrame
        caption={variant === "docs" ? "Documentation articles" : variant === "documents" ? "Team documents" : "Blog posts"}
      >
          <thead>
            <tr className="border-b border-white/10 text-marble/40 uppercase font-black tracking-widest text-[9px] bg-black/5">
              {variant === "docs" && (
                <>
                  <th className="p-4">Document / Guide</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Order</th>
                  <th className="p-4">Destinations</th>
                  <th className="p-4">Status</th>
                </>
              )}
              {variant === "documents" && (
                <>
                  <th className="p-4">Document</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Created At</th>
                  <th className="p-4">Access File</th>
                </>
              )}
              {variant === "blog" && (
                <>
                  <th className="p-4">Blog Post</th>
                  <th className="p-4">Status</th>
                </>
              )}
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 bg-black/10">
            {loadingList ? (
              <tr>
                <td
                  colSpan={variant === "docs" ? 6 : variant === "documents" ? 5 : 3}
                  className="p-12 text-center text-marble/40 font-mono"
                >
                  Syncing database records...
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td
                  colSpan={variant === "docs" ? 6 : variant === "documents" ? 5 : 3}
                  className="p-12 text-center text-marble/40 font-mono"
                >
                  {noItemsMessage}
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const isPublished = item.status === "published";
                const isPendingApproval = item.status === "pending_approval"
                  || item.approvalStatus === "pending_approval";

                return (
                  <tr key={item.slug} className="hover:bg-white/5 transition-colors">
                    {/* Document / Post Info Column */}
                    <td className="p-4 max-w-sm">
                      <div className="flex gap-3">
                        {variant === "blog" && item.thumbnail ? (
                          <div className="w-12 h-12 ares-cut border border-white/10 overflow-hidden shrink-0 mt-0.5 shadow-md">
                            <AuthenticatedImage
                              src={cleanThumbnailUrl(item.thumbnail)}
                              alt={`Thumbnail for ${item.title}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <FileText className="text-ares-gold shrink-0 mt-0.5" size={16} />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-extrabold text-white text-sm tracking-tight truncate">
                            {item.title}
                          </p>
                          <p className="text-[11px] text-marble/60 mt-0.5 font-medium leading-relaxed truncate">
                            {item.description || "No description provided."}
                          </p>
                          {variant === "blog" && (
                            <p className="text-[9px] text-marble/40 font-bold uppercase tracking-widest mt-1">
                              By {item.author} • {item.date}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Variant Specific Columns */}
                    {variant === "docs" && (
                      <>
                        <td className="p-4">
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 border border-white/15 bg-white/5 text-white rounded">
                            {item.category}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-marble/60 font-semibold">
                          {item.sortOrder}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1">
                            {item.displayInMathCorner === 1 && (
                              <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 bg-ares-red/10 text-ares-red border border-ares-red/20 rounded">
                                Math
                              </span>
                            )}
                            {item.displayInScienceCorner === 1 && (
                              <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 bg-ares-bronze/10 text-ares-bronze border border-ares-bronze/20 rounded">
                                Science
                              </span>
                            )}
                            {item.displayInAreslib === 1 && (
                              <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 bg-white/5 text-marble border border-white/10 rounded">
                                ARESLib
                              </span>
                            )}
                            {item.isPortfolio === 1 && (
                              <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 bg-ares-gold/10 text-ares-gold border border-ares-gold/20 rounded">
                                Portfolio
                              </span>
                            )}
                            {item.isExecutiveSummary === 1 && (
                              <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 bg-ares-cyan/10 text-ares-cyan border border-ares-cyan/20 rounded">
                                Exec
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <span
                            className={`text-[9px] font-black uppercase px-2 py-0.5 border rounded ${
                              isPendingApproval
                                ? "bg-ares-gold/15 border-ares-gold/30 text-ares-gold"
                                : isPublished
                                ? "bg-ares-cyan/15 border-ares-cyan/30 text-ares-cyan"
                                : "bg-ares-gold/15 border-ares-gold/30 text-ares-gold"
                            }`}
                          >
                            {isPendingApproval ? "Pending Approval" : (item.status || "published")}
                          </span>
                        </td>
                      </>
                    )}

                    {variant === "documents" && (
                      <>
                        <td className="p-4">
                          <span
                            className={`text-[9px] font-black uppercase px-2 py-0.5 border rounded ${
                              item.category === "spec"
                                ? "bg-ares-red/15 border-ares-red/30 text-white"
                                : item.category === "guide"
                                ? "bg-ares-cyan/15 border-ares-cyan/30 text-ares-cyan"
                                : "bg-ares-gold/15 border-ares-gold/30 text-ares-gold"
                            }`}
                          >
                            {item.category}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-marble/60 text-[10px]">
                          {item.createdAt}
                        </td>
                        <td className="p-4">
                          <a
                            href={item.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-ares-cyan hover:text-white font-bold uppercase tracking-widest inline-flex items-center gap-1"
                          >
                            Access File <ExternalLink size={10} />
                          </a>
                        </td>
                      </>
                    )}

                    {variant === "blog" && (
                      <td className="p-4">
                        <span
                          className={`text-[9px] font-black uppercase px-2 py-0.5 border rounded ${
                            isPendingApproval
                              ? "bg-ares-gold/15 border-ares-gold/30 text-ares-gold animate-pulse"
                              : isPublished
                              ? "bg-ares-cyan/15 border-ares-cyan/30 text-ares-cyan"
                              : "bg-ares-gold/15 border-ares-gold/30 text-ares-gold"
                          }`}
                        >
                          {isPendingApproval
                            ? "Pending Approval"
                            : (item.status || "published")}
                        </span>
                      </td>
                    )}

                    {/* Actions Column */}
                    <td className="p-4 text-right">
                      <div className="inline-flex gap-1.5 items-center">
                        {isApprover && onApprove && isPendingApproval && (
                          <button
                            type="button"
                            onClick={() => void onApprove(item)}
                            disabled={reviewingSlug !== null || approvingSlug === item.slug}
                            className="px-2 py-1 bg-ares-gold/15 hover:bg-ares-gold/30 text-ares-gold border border-ares-gold/40 text-[9px] font-black uppercase tracking-wider rounded transition-all cursor-pointer inline-flex items-center gap-1 disabled:cursor-wait disabled:opacity-60"
                            aria-label={variant === "docs" ? `Review and approve ${item.title}` : `Approve ${item.title}`}
                            title={variant === "docs" ? "Review & Publish" : "Approve & Publish"}
                          >
                            <CheckCircle2 size={12} aria-hidden="true" /> {reviewingSlug === item.slug ? "Loading review…" : approvingSlug === item.slug ? "Approving…" : variant === "docs" ? "Review" : "Approve"}
                          </button>
                        )}
                        {variant === "blog" && isApprover && onSyndicate && isPublished && item.isDeleted !== 1 && (
                          <button
                            type="button"
                            onClick={() => void onSyndicate(item)}
                            disabled={syndicatingSlug !== null}
                            className="inline-flex min-h-9 items-center gap-1 rounded border border-ares-cyan/40 bg-ares-cyan/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-ares-cyan transition-all hover:bg-ares-cyan/20 focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:cursor-wait disabled:opacity-60"
                            aria-label={`Crosspost or retry social delivery for ${item.title}`}
                            title="Crosspost / Retry social delivery"
                          >
                            <Share2 size={12} aria-hidden="true" />
                            {syndicatingSlug === item.slug ? "Sending…" : "Crosspost"}
                          </button>
                        )}
                        {item.isDeleted === 1 && canEdit && onRestore ? (
                          <button
                            onClick={() => onRestore(item.slug)}
                            className="px-2 py-1 bg-ares-gold/15 hover:bg-ares-gold/30 text-ares-gold border border-ares-gold/40 text-[9px] font-black uppercase tracking-wider rounded transition-all cursor-pointer inline-flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-ares-cyan"
                            aria-label={`Restore ${item.title}`}
                          >
                            <RotateCcw size={12} aria-hidden="true" /> Restore
                          </button>
                        ) : canEdit ? (
                          <>
                            <button
                              onClick={() => onEdit(item)}
                              className="p-2 bg-white/5 hover:bg-ares-gold/20 text-white/70 hover:text-white border border-white/10 rounded transition-all cursor-pointer focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                              title="Edit Record"
                              aria-label={`Edit ${item.title}`}
                            >
                              <Pencil size={12} aria-hidden="true" />
                            </button>
                            <button
                              onClick={() => onDelete(item.slug)}
                              className="p-2 bg-white/5 hover:bg-ares-red/20 text-white/70 hover:text-white border border-white/10 rounded transition-all cursor-pointer focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                              title="Archive Record"
                              aria-label={`Archive ${item.title}`}
                            >
                              <Archive size={12} aria-hidden="true" />
                            </button>
                          </>
                        ) : (
                          <span className="text-[9px] text-marble/40 uppercase font-black tracking-widest">
                            🔒 Gated
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
      </TableFrame>
      {pendingArchiveSlug && onConfirmArchive && onCancelArchive && (
        <div
          role="alertdialog"
          aria-labelledby="document-archive-confirmation-title"
          aria-describedby="document-archive-confirmation-description"
          className="border-t border-ares-red/45 bg-ares-red/15 px-6 py-4 text-white"
        >
          <p id="document-archive-confirmation-title" className="text-sm font-bold">
            Archive {pendingArchiveItem?.title || "this record"}?
          </p>
          <p id="document-archive-confirmation-description" className="mt-1 text-xs text-white/80">
            It will leave active lists but remain available in Archived records for restoration.
          </p>
          {archiveError && (
            <p role="alert" className="mt-2 break-words font-mono text-[10px] text-white/80">
              Archive failed: {archiveError}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              ref={archiveCancelRef}
              type="button"
              onClick={onCancelArchive}
              disabled={isArchiving}
              className="rounded border border-white/20 px-3 py-1.5 text-[10px] font-bold uppercase text-white disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              Keep Record
            </button>
            <button
              type="button"
              onClick={onConfirmArchive}
              disabled={isArchiving}
              className="rounded bg-ares-red px-3 py-1.5 text-[10px] font-bold uppercase text-white disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              {isArchiving ? "Archiving…" : "Archive Record"}
            </button>
          </div>
        </div>
      )}
      {hasMore && onLoadMore && (
        <div className="border-t border-white/10 bg-black/20 p-4 text-center">
          <button
            type="button"
            onClick={onLoadMore}
            className="rounded border border-ares-gold/35 bg-ares-gold/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-ares-gold hover:bg-ares-gold/20 focus-visible:ring-2 focus-visible:ring-ares-cyan"
          >
            Load more records
          </button>
          <p className="mt-2 text-[10px] text-marble/55">Results load in bounded groups to keep this workspace responsive.</p>
        </div>
      )}
    </div>
  );
}
