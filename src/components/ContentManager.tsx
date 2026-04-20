import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ChevronUp, ChevronDown, Radio, Download } from "lucide-react";
import BroadcastModal from "./BroadcastModal";
import { useContentMutation } from "../hooks/useContentMutation";

interface EventItem {
  id: string;
  title: string;
  date_start: string;
  cf_email?: string;
  is_deleted?: number;
  status?: string;
  revision_of?: string;
}

interface PostItem {
  slug: string;
  title: string;
  date: string;
  cf_email?: string;
  is_deleted?: number;
  status?: string;
  revision_of?: string;
}

interface DocItem {
  slug: string;
  title: string;
  category: string;
  sort_order: number;
  is_deleted?: number;
  is_portfolio?: number;
  is_executive_summary?: number;
  status?: string;
  revision_of?: string;
}

export default function ContentManager({ 
  onEditPost, 
  onEditEvent,
  onEditDoc,
  mode = "all"
}: { 
  onEditPost?: (slug: string) => void;
  onEditEvent?: (id: string) => void;
  onEditDoc?: (slug: string) => void;
  mode?: "all" | "blog" | "event" | "docs";
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [view, setView] = useState<"active" | "trash" | "pending">("active");
  const [broadcastData, setBroadcastData] = useState<{ isOpen: boolean, type: "blog" | "event", id: string, title: string }>({
    isOpen: false,
    type: "blog",
    id: "",
    title: ""
  });

  // ── Data Fetching ──────────────────────────────────────────────────
  const { data: events = [], isLoading: loadingEvents } = useQuery<EventItem[]>({
    queryKey: ["events"],
    queryFn: async () => {
      const res = await fetch("/dashboard/api/admin/events", { credentials: "include" });
      const data = await res.json() as { events?: EventItem[] };
      return data.events ?? [];
    },
  });

  const { data: posts = [], isLoading: loadingPosts } = useQuery<PostItem[]>({
    queryKey: ["posts"],
    queryFn: async () => {
      const res = await fetch("/dashboard/api/admin/posts", { credentials: "include" });
      const data = await res.json() as { posts?: PostItem[] };
      return data.posts ?? [];
    },
  });

  const { data: docs = [], isLoading: loadingDocs } = useQuery<DocItem[]>({
    queryKey: ["docs"],
    queryFn: async () => {
      const res = await fetch("/dashboard/api/admin/docs", { credentials: "include" });
      const data = await res.json() as { docs?: DocItem[] };
      return data.docs ?? [];
    },
  });

  // ── Mutations (via reusable hook) ──────────────────────────────────
  const deleteEventMutation = useContentMutation<string>({
    endpoint: (id) => `/dashboard/api/admin/events/${id}`,
    invalidateKeys: ["events"],
    setConfirmId,
  });

  const deletePostMutation = useContentMutation<string>({
    endpoint: (slug) => `/dashboard/api/admin/posts/${slug}`,
    invalidateKeys: ["posts"],
    setConfirmId,
  });

  const deleteDocMutation = useContentMutation<string>({
    endpoint: (slug) => `/dashboard/api/admin/docs/${slug}`,
    invalidateKeys: ["docs"],
    setConfirmId,
  });

  const syncGcalMutation = useContentMutation<void>({
    endpoint: () => `/dashboard/api/admin/events/sync`,
    method: "POST",
    invalidateKeys: ["events"],
    clearConfirm: false,
    onSuccess: (data) => {
      const d = data as { synced?: number; newEvents?: number; updatedEvents?: number };
      alert(`Sync Complete! Fetched ${d.synced} events. (${d.newEvents} new, ${d.updatedEvents} updated)`);
    },
  });

  const restoreMutation = useContentMutation<{ type: "event" | "post" | "doc", id: string }>({
    endpoint: ({ type, id }) => {
      const base = type === "event" ? "events" : type === "post" ? "posts" : "docs";
      return `/dashboard/api/admin/${base}/${id}/undelete`;
    },
    method: "PATCH",
    invalidateKeys: ["events", "posts", "docs"],
    clearConfirm: false,
  });

  const purgeMutation = useContentMutation<{ type: "event" | "post" | "doc", id: string }>({
    endpoint: ({ type, id }) => {
      const base = type === "event" ? "events" : type === "post" ? "posts" : "docs";
      return `/dashboard/api/admin/${base}/${id}/purge`;
    },
    invalidateKeys: ["events", "posts", "docs"],
    setConfirmId,
  });

  const sortDocMutation = useContentMutation<{ slug: string, sortOrder: number }>({
    endpoint: ({ slug }) => `/dashboard/api/admin/docs/${slug}/sort`,
    method: "PATCH",
    invalidateKeys: ["docs"],
    body: ({ sortOrder }) => ({ sortOrder }),
    clearConfirm: false,
  });

  const approveMutation = useContentMutation<{ type: "event" | "post" | "doc", id: string }>({
    endpoint: ({ type, id }) => {
      const base = type === "event" ? "events" : type === "post" ? "posts" : "docs";
      return `/dashboard/api/admin/${base}/${id}/approve`;
    },
    method: "PATCH",
    invalidateKeys: ["events", "posts", "docs"],
    clearConfirm: false,
  });

  // ── Export Helpers ─────────────────────────────────────────────────
  const exportSingleDoc = async (slug: string) => {
    try {
      const res = await fetch(`/api/docs/${slug}`);
      const data = await res.json();
      // @ts-expect-error -- D1 untyped response
      const doc = data.doc;
      if (!doc) { alert("Doc not found."); return; }
      const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to export document.");
    }
  };

  const exportAllDocs = async () => {
    try {
      const res = await fetch("/dashboard/api/admin/docs/export-all", { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aresweb-docs-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to export all documents.");
    }
  };

  // ── Shared UI Components ───────────────────────────────────────────
  const ClickToDeleteButton = ({ 
    id, 
    onDelete, 
    isDeleting 
  }: { 
    id: string; 
    onDelete: () => void; 
    isDeleting: boolean; 
  }) => {
    const isConfirming = confirmId === id;

    if (isDeleting) {
      return (
        <button disabled className="text-xs font-bold text-zinc-300 bg-zinc-800 px-3 py-1 rounded-md opacity-50 cursor-not-allowed">
          DELETING...
        </button>
      );
    }

    if (isConfirming) {
      return (
        <button
          onClick={onDelete}
          className="text-xs font-bold text-white bg-ares-red/80 hover:bg-ares-red px-3 py-1 rounded-md shadow-[0_0_10px_rgba(204,0,0,0.5)] transition-all animate-pulse focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          CONFIRM DELETE
        </button>
      );
    }

    return (
      <button
        onClick={() => setConfirmId(id)}
        className="text-xs font-bold text-zinc-400 hover:text-ares-red bg-zinc-800/50 hover:bg-zinc-800 px-3 py-1 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-red"
      >
        DELETE
      </button>
    );
  };

  const isLoading = loadingEvents || loadingPosts || loadingDocs;

  const contentFilter = (item: { is_deleted?: number, status?: string }) => {
    if (view === 'trash') return item.is_deleted === 1;
    if (view === 'pending') return item.is_deleted !== 1 && item.status === 'pending';
    return item.is_deleted !== 1 && (item.status === 'published' || !item.status);
  };

  return (
    <div className="w-full h-full flex flex-col">
      {mode === "all" && (
        <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tighter">Manage Content</h2>
            <p className="text-zinc-400 text-sm mt-1">Review and manage the lifecycle of Database entries.</p>
          </div>
          
          <div className="flex bg-zinc-900/50 p-1 rounded-lg border border-zinc-800">
            <button 
              onClick={() => setView("active")}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${view === "active" ? 'bg-zinc-800 text-ares-cyan border border-zinc-700 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              ACTIVE
            </button>
            <button 
              onClick={() => setView("pending")}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${view === "pending" ? 'bg-ares-gold/10 text-ares-gold border border-ares-gold/20 shadow-sm' : 'text-zinc-500 hover:text-ares-gold/60'}`}
            >
              PENDING
            </button>
            <button 
              onClick={() => setView("trash")}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${view === "trash" ? 'bg-ares-red/10 text-ares-red border border-ares-red/20 shadow-sm' : 'text-zinc-500 hover:text-ares-red/60'}`}
            >
              TRASH
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center min-h-[300px]">
          <div className="w-8 h-8 md:w-12 md:h-12 border-4 border-zinc-800 border-t-ares-red rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className={`grid gap-6 flex-1 ${mode === "all" ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1"}`}>
          
          {/* Active Events Column */}
          {(mode === "all" || mode === "event") && (
          <div className="flex flex-col">
            <div className="flex justify-between items-center mb-4 border-b border-zinc-800 pb-2">
              <h3 className={`font-bold uppercase tracking-widest text-xs ${view === 'trash' ? 'text-ares-red' : view === 'pending' ? 'text-ares-gold' : 'text-ares-gold'}`}>
                {view === 'active' ? 'Active Events' : view === 'pending' ? 'Pending Events' : 'Trashed Events'}
              </h3>
              {view === 'active' && (
                <button 
                  onClick={() => syncGcalMutation.mutate(undefined as unknown as void)}
                  disabled={syncGcalMutation.isPending}
                  className="text-xs font-bold text-ares-cyan bg-ares-cyan/10 hover:bg-ares-cyan/20 px-3 py-1 rounded-md transition-colors flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                >
                  {syncGcalMutation.isPending ? "SYNCING..." : "SYNC GCAL"}
                </button>
              )}
            </div>
            <div className="flex flex-col gap-3 overflow-y-auto max-h-[450px] pr-2 custom-scrollbar">
              {events.filter(contentFilter).length === 0 ? (
                <div className="text-zinc-500 text-xs italic py-4 text-center border border-dashed border-zinc-800/50 rounded-xl">No {view} events found.</div>
              ) : (
                events.filter(contentFilter).map((event) => (
                  <div key={event.id} className={`bg-black/40 border ${event.is_deleted === 1 ? 'border-ares-red/30 bg-ares-red/[0.02]' : 'border-zinc-800/60'} rounded-xl p-4 flex flex-col justify-between gap-4 hover:border-zinc-700 transition-colors`}>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-zinc-200 truncate flex items-center gap-2">
                        {event.title}
                        {event.is_deleted === 1 && <span className="text-[9px] font-bold text-ares-red bg-ares-red/10 border border-ares-red/20 px-1.5 py-0.5 rounded uppercase tracking-wider">Deleted</span>}
                        {event.revision_of && <span className="text-[9px] font-bold text-ares-gold bg-ares-gold/10 border border-ares-gold/20 px-1.5 py-0.5 rounded uppercase tracking-wider">Revision</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-md">{format(new Date(event.date_start), 'MMM do, yyyy')}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-800/50">
                      {view === 'active' || view === 'pending' ? (
                        <>
                          <button
                            onClick={() => onEditEvent && onEditEvent(event.id)}
                            className="text-xs font-bold text-zinc-400 hover:text-ares-cyan bg-zinc-800/50 hover:bg-zinc-800 px-3 py-1 rounded-md transition-colors"
                          >
                            EDIT
                          </button>
                          {view === 'pending' ? (
                            <button
                              onClick={() => approveMutation.mutate({ type: 'event', id: event.id })}
                              disabled={approveMutation.isPending}
                              className="text-xs font-bold text-ares-cyan hover:text-white bg-ares-cyan/10 hover:bg-ares-cyan/40 border border-ares-cyan/20 px-3 py-1 rounded-md transition-colors disabled:opacity-50"
                            >
                              APPROVE
                            </button>
                          ) : (
                            <button
                              onClick={() => setBroadcastData({ isOpen: true, type: "event", id: event.id, title: event.title })}
                              className="text-xs font-bold text-ares-gold/80 hover:text-ares-gold border border-ares-gold/20 hover:bg-ares-gold/10 px-3 py-1 rounded-md transition-all flex items-center gap-1.5"
                            >
                              <Radio size={12} className={broadcastData.isOpen && broadcastData.id === event.id ? "animate-pulse" : ""} />
                              SEND
                            </button>
                          )}
                          <ClickToDeleteButton 
                            id={event.id} 
                            onDelete={() => deleteEventMutation.mutate(event.id)} 
                            isDeleting={deleteEventMutation.isPending && deleteEventMutation.variables === event.id} 
                          />
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => restoreMutation.mutate({ type: 'event', id: event.id })}
                            disabled={restoreMutation.isPending}
                            className="text-xs font-bold text-ares-cyan bg-ares-cyan/10 hover:bg-ares-cyan/20 px-3 py-1 rounded-md transition-colors"
                          >
                            {restoreMutation.isPending && restoreMutation.variables?.id === event.id ? "RESTORING..." : "RESTORE"}
                          </button>
                          <ClickToDeleteButton 
                            id={`purge-${event.id}`} 
                            onDelete={() => purgeMutation.mutate({ type: 'event', id: event.id })} 
                            isDeleting={purgeMutation.isPending && purgeMutation.variables?.id === event.id} 
                          />
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          )}

          {/* Published Blog Posts Column */}
          {(mode === "all" || mode === "blog") && (
          <div className="flex flex-col">
            <h3 className={`font-bold uppercase tracking-widest text-xs mb-4 border-b border-zinc-800 pb-2 ${view === 'trash' ? 'text-ares-red' : view === 'pending' ? 'text-ares-gold' : 'text-zinc-100'}`}>
               {view === 'active' ? 'Published Blog Posts' : view === 'pending' ? 'Pending Posts' : 'Trashed Posts'}
            </h3>
            <div className="flex flex-col gap-3 overflow-y-auto max-h-[450px] pr-2 custom-scrollbar">
              {posts.filter(contentFilter).length === 0 ? (
                <div className="text-zinc-500 text-xs italic py-4 text-center border border-dashed border-zinc-800/50 rounded-xl">No {view} posts found.</div>
              ) : (
                posts.filter(contentFilter).map((post) => (
                  <div key={post.slug} className={`bg-black/40 border ${post.is_deleted === 1 ? 'border-ares-red/30 bg-ares-red/[0.02]' : 'border-zinc-800/60'} rounded-xl p-4 flex flex-col justify-between gap-4 hover:border-zinc-700 transition-colors`}>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-zinc-200 truncate flex items-center gap-2">
                        {post.title}
                        {post.is_deleted === 1 && <span className="text-[9px] font-bold text-ares-red bg-ares-red/10 border border-ares-red/20 px-1.5 py-0.5 rounded uppercase tracking-wider">Deleted</span>}
                        {post.revision_of && <span className="text-[9px] font-bold text-ares-gold bg-ares-gold/10 border border-ares-gold/20 px-1.5 py-0.5 rounded uppercase tracking-wider">Revision</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-md">{format(new Date(post.date), 'MMM do, yyyy')}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-800/50">
                      {view === 'active' || view === 'pending' ? (
                        <>
                          <button
                            onClick={() => onEditPost && onEditPost(post.slug)}
                            className="text-xs font-bold text-zinc-400 hover:text-ares-cyan bg-zinc-800/50 hover:bg-zinc-800 px-3 py-1 rounded-md transition-colors"
                          >
                            EDIT
                          </button>
                          {view === 'pending' ? (
                            <button
                              onClick={() => approveMutation.mutate({ type: 'post', id: post.slug })}
                              disabled={approveMutation.isPending}
                              className="text-xs font-bold text-ares-cyan hover:text-white bg-ares-cyan/10 hover:bg-ares-cyan/40 border border-ares-cyan/20 px-3 py-1 rounded-md transition-colors disabled:opacity-50"
                            >
                              APPROVE
                            </button>
                          ) : (
                            <button
                              onClick={() => setBroadcastData({ isOpen: true, type: "blog", id: post.slug, title: post.title })}
                              className="text-xs font-bold text-ares-gold/80 hover:text-ares-gold border border-ares-gold/20 hover:bg-ares-gold/10 px-3 py-1 rounded-md transition-all flex items-center gap-1.5"
                            >
                              <Radio size={12} className={broadcastData.isOpen && broadcastData.id === post.slug ? "animate-pulse" : ""} />
                              SEND
                            </button>
                          )}
                          <ClickToDeleteButton 
                            id={post.slug} 
                            onDelete={() => deletePostMutation.mutate(post.slug)} 
                            isDeleting={deletePostMutation.isPending && deletePostMutation.variables === post.slug} 
                          />
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => restoreMutation.mutate({ type: 'post', id: post.slug })}
                            disabled={restoreMutation.isPending}
                            className="text-xs font-bold text-ares-cyan bg-ares-cyan/10 hover:bg-ares-cyan/20 px-3 py-1 rounded-md transition-colors"
                          >
                           {restoreMutation.isPending && restoreMutation.variables?.id === post.slug ? "RESTORING..." : "RESTORE"}
                          </button>
                          <ClickToDeleteButton 
                            id={`purge-${post.slug}`} 
                            onDelete={() => purgeMutation.mutate({ type: 'post', id: post.slug })} 
                            isDeleting={purgeMutation.isPending && purgeMutation.variables?.id === post.slug} 
                          />
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          )}

          {/* Documentation Column */}
          {(mode === "all" || mode === "docs") && (
          <div className="flex flex-col">
            <h3 className={`font-bold uppercase tracking-widest text-xs mb-4 border-b border-zinc-800 pb-2 ${view === 'trash' ? 'text-ares-red' : view === 'pending' ? 'text-ares-gold' : 'text-zinc-500'}`}>
              <span className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  {view === 'active' ? (
                    <><span className="text-ares-red normal-case tracking-normal">ARES</span><span className="text-white normal-case tracking-normal">Lib</span>&nbsp;Documentation</>
                  ) : view === 'pending' ? 'Pending Docs' : 'Trashed Docs'}
                </span>
                <div className="flex items-center gap-2">
                  {view === 'active' && (
                    <>
                      <button
                        onClick={() => {
                          const code = prompt("Enter a name or purpose for this code (e.g. 'Championship Judge'):");
                          if (code !== null) {
                            fetch("/dashboard/api/admin/judges/codes", { method: "POST", credentials: "include" })
                              .then(res => res.json())
                              .then((data: { code: string; expiresAt: string }) => alert(`JUDGE ACCESS CODE: ${data.code}\nExpires: ${new Date(data.expiresAt).toLocaleDateString()}`));
                          }
                        }}
                        className="text-[10px] font-bold text-ares-gold bg-ares-gold/10 hover:bg-ares-gold/20 px-2 py-1 rounded-md transition-colors border border-ares-gold/20"
                      >
                        GENERATE JUDGE CODE
                      </button>
                      <button
                        onClick={exportAllDocs}
                        className="text-xs font-bold text-ares-cyan bg-ares-cyan/10 hover:bg-ares-cyan/20 px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan normal-case tracking-normal"
                      >
                        <Download size={12} />
                        BACKUP ALL
                      </button>
                    </>
                  )}
                </div>
              </span>
            </h3>
            <div className="flex flex-col gap-3 overflow-y-auto max-h-[450px] pr-2 custom-scrollbar">
              {docs.filter(contentFilter).length === 0 ? (
                <div className="text-zinc-500 text-xs italic py-4 text-center border border-dashed border-zinc-800/50 rounded-xl">No {view} docs found.</div>
              ) : (
                docs.filter(contentFilter).map((doc) => (
                  <div key={doc.slug} className={`bg-black/40 border ${doc.is_deleted === 1 ? 'border-ares-red/30 bg-ares-red/[0.02]' : 'border-zinc-800/60'} rounded-xl p-4 flex flex-col justify-between gap-4 hover:border-zinc-700 transition-colors`}>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-zinc-200 truncate flex items-center gap-2">
                        {doc.title}
                        {doc.is_deleted === 1 && <span className="text-[9px] font-bold text-ares-red bg-ares-red/10 border border-ares-red/20 px-1.5 py-0.5 rounded uppercase tracking-wider">Deleted</span>}
                        {doc.revision_of && <span className="text-[9px] font-bold text-ares-gold bg-ares-gold/10 border border-ares-gold/20 px-1.5 py-0.5 rounded uppercase tracking-wider">Revision</span>}
                        {doc.is_executive_summary === 1 && <span className="text-[9px] font-bold text-ares-gold bg-ares-gold/10 border border-ares-gold/20 px-1.5 py-0.5 rounded uppercase tracking-wider">Exec Summary</span>}
                        {doc.is_portfolio === 1 && <span className="text-[9px] font-bold text-ares-cyan bg-ares-cyan/10 border border-ares-cyan/20 px-1.5 py-0.5 rounded uppercase tracking-wider">Portfolio</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-ares-cyan/70 bg-ares-cyan/10 border border-ares-cyan/20 px-2 py-0.5 rounded-md truncate max-w-[120px]">
                          {doc.category}
                        </span>
                        {view === 'active' && (
                          <span className="flex items-center text-[10px] text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden">
                            <button 
                              onClick={() => sortDocMutation.mutate({ slug: doc.slug, sortOrder: doc.sort_order - 1 })}
                              disabled={sortDocMutation.isPending}
                              className="px-1 py-0.5 hover:bg-zinc-800 hover:text-ares-cyan transition-colors disabled:opacity-50"
                              aria-label="Move Up"
                            >
                              <ChevronUp size={12} />
                            </button>
                            <span className="px-2 border-x border-zinc-800">Order: {doc.sort_order}</span>
                            <button 
                              onClick={() => sortDocMutation.mutate({ slug: doc.slug, sortOrder: doc.sort_order + 1 })}
                              disabled={sortDocMutation.isPending}
                              className="px-1 py-0.5 hover:bg-zinc-800 hover:text-ares-red transition-colors disabled:opacity-50"
                              aria-label="Move Down"
                            >
                              <ChevronDown size={12} />
                            </button>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-800/50">
                      {view === 'active' || view === 'pending' ? (
                        <>
                          <button
                            onClick={() => onEditDoc && onEditDoc(doc.slug)}
                            className="text-xs font-bold text-zinc-400 hover:text-ares-cyan bg-zinc-800/50 hover:bg-zinc-800 px-3 py-1 rounded-md transition-colors"
                          >
                            EDIT
                          </button>
                          {view === 'pending' ? (
                            <button
                              onClick={() => approveMutation.mutate({ type: 'doc', id: doc.slug })}
                              disabled={approveMutation.isPending}
                              className="text-xs font-bold text-ares-cyan hover:text-white bg-ares-cyan/10 hover:bg-ares-cyan/40 border border-ares-cyan/20 px-3 py-1 rounded-md transition-colors disabled:opacity-50"
                            >
                              APPROVE
                            </button>
                          ) : (
                            <button
                              onClick={() => exportSingleDoc(doc.slug)}
                              className="text-xs font-bold text-zinc-400 hover:text-ares-gold bg-zinc-800/50 hover:bg-zinc-800 px-3 py-1 rounded-md transition-colors flex items-center gap-1"
                            >
                              <Download size={10} />
                              EXPORT
                            </button>
                          )}
                          <ClickToDeleteButton 
                            id={doc.slug} 
                            onDelete={() => deleteDocMutation.mutate(doc.slug)} 
                            isDeleting={deleteDocMutation.isPending && deleteDocMutation.variables === doc.slug} 
                          />
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => restoreMutation.mutate({ type: 'doc', id: doc.slug })}
                            disabled={restoreMutation.isPending}
                            className="text-xs font-bold text-ares-cyan bg-ares-cyan/10 hover:bg-ares-cyan/20 px-3 py-1 rounded-md transition-colors"
                          >
                            {restoreMutation.isPending && restoreMutation.variables?.id === doc.slug ? "RESTORING..." : "RESTORE"}
                          </button>
                          <ClickToDeleteButton 
                            id={`purge-${doc.slug}`} 
                            onDelete={() => purgeMutation.mutate({ type: 'doc', id: doc.slug })} 
                            isDeleting={purgeMutation.isPending && purgeMutation.variables?.id === doc.slug} 
                          />
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          )}

        </div>
      )}

      <BroadcastModal 
        isOpen={broadcastData.isOpen}
        onClose={() => setBroadcastData(prev => ({ ...prev, isOpen: false }))}
        type={broadcastData.type}
        id={broadcastData.id}
        title={broadcastData.title}
      />
    </div>
  );
}
