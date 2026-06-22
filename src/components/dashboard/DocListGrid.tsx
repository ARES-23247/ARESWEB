import React, { useState } from "react";
import { FileText, Pencil, Trash2, ExternalLink, Search } from "lucide-react";
import { cleanThumbnailUrl } from "@/lib/utils";

interface DocListGridProps {
  items: any[];
  loadingList: boolean;
  canEdit: boolean;
  variant?: "docs" | "documents" | "blog";
  onEdit: (item: any) => void;
  onDelete: (slug: string) => void;
  searchPlaceholder?: string;
  noItemsMessage?: string;
}

export default function DocListGrid({
  items,
  loadingList,
  canEdit,
  variant = "docs",
  onEdit,
  onDelete,
  searchPlaceholder = "Search records...",
  noItemsMessage = "No records found."
}: DocListGridProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredItems = items.filter((item) => {
    const queryStr = searchQuery.toLowerCase().trim();
    if (!queryStr) return true;
    const titleMatch = item.title?.toLowerCase().includes(queryStr);
    const descMatch = (item.description || item.snippet || "")
      .toLowerCase()
      .includes(queryStr);
    const categoryMatch = item.category?.toLowerCase().includes(queryStr);
    const slugMatch = item.slug?.toLowerCase().includes(queryStr);
    return titleMatch || descMatch || categoryMatch || slugMatch;
  });

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
        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-marble/40" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-black/40 border border-white/10 text-white placeholder-marble/40 text-xs rounded font-medium focus:outline-none focus:border-ares-cyan focus:ring-1 focus:ring-ares-cyan transition-all"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
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

                return (
                  <tr key={item.slug} className="hover:bg-white/5 transition-colors">
                    {/* Document / Post Info Column */}
                    <td className="p-4 max-w-sm">
                      <div className="flex gap-3">
                        {variant === "blog" && item.thumbnail ? (
                          <div className="w-12 h-12 ares-cut border border-white/10 overflow-hidden shrink-0 mt-0.5 shadow-md">
                            <img
                              src={cleanThumbnailUrl(item.thumbnail)}
                              alt=""
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
                            {item.description || item.snippet || "No description provided."}
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
                              isPublished
                                ? "bg-ares-success/15 border-ares-success/30 text-ares-success"
                                : "bg-ares-gold/15 border-ares-gold/30 text-ares-gold"
                            }`}
                          >
                            {item.status}
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
                            isPublished
                              ? "bg-ares-success/15 border-ares-success/30 text-ares-success"
                              : "bg-ares-gold/15 border-ares-gold/30 text-ares-gold"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                    )}

                    {/* Actions Column */}
                    <td className="p-4 text-right">
                      <div className="inline-flex gap-1.5">
                        {canEdit ? (
                          <>
                            <button
                              onClick={() => onEdit(item)}
                              className="p-2 bg-white/5 hover:bg-ares-gold/20 text-white/70 hover:text-white border border-white/10 rounded transition-all cursor-pointer focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                              title="Edit Record"
                              aria-label={`Edit ${item.title}`}
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => onDelete(item.slug)}
                              className="p-2 bg-white/5 hover:bg-ares-red/20 text-white/70 hover:text-ares-red-light border border-white/10 rounded transition-all cursor-pointer focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                              title="Delete Record"
                              aria-label={`Delete ${item.title}`}
                            >
                              <Trash2 size={12} />
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
        </table>
      </div>
    </div>
  );
}
