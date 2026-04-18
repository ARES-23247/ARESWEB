import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

interface EventItem {
  id: string;
  title: string;
  date_start: string;
  cf_email?: string;
}

interface PostItem {
  slug: string;
  title: string;
  date: string;
  cf_email?: string;
}

interface DocItem {
  slug: string;
  title: string;
  category: string;
  sort_order: number;
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
  const queryClient = useQueryClient();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const { data: events = [], isLoading: loadingEvents } = useQuery<EventItem[]>({
    queryKey: ["events"],
    queryFn: async () => {
      const res = await fetch("/api/events");
      const data = await res.json();
      return data.events ?? [];
    },
  });

  const { data: posts = [], isLoading: loadingPosts } = useQuery<PostItem[]>({
    queryKey: ["posts"],
    queryFn: async () => {
      const res = await fetch("/api/posts");
      const data = await res.json();
      return data.posts ?? [];
    },
  });

  const { data: docs = [], isLoading: loadingDocs } = useQuery<DocItem[]>({
    queryKey: ["docs"],
    queryFn: async () => {
      const res = await fetch("/api/docs");
      const data = await res.json();
      return data.docs ?? [];
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/dashboard/api/admin/events/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to delete event. Status: ${res.status}`);
      }
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setConfirmId(null);
    },
    onError: (err) => {
      alert(err.message);
    }
  });

  const syncGcalMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/dashboard/api/admin/events/sync`, { method: "POST" });
      if (!res.ok) throw new Error("Sync failed. Check permissions.");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      alert(`Sync Complete! Fetched ${data.synced} events. (${data.newEvents} new, ${data.updatedEvents} updated)`);
    },
    onError: (err) => {
      alert(err.message);
    }
  });

  const deletePostMutation = useMutation({
    mutationFn: async (slug: string) => {
      const res = await fetch(`/dashboard/api/admin/posts/${slug}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to delete post. Status: ${res.status}`);
      }
      return slug;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      setConfirmId(null);
    },
    onError: (err) => {
      alert(err.message);
    }
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (slug: string) => {
      const res = await fetch(`/dashboard/api/admin/docs/${slug}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to delete doc. Status: ${res.status}`);
      }
      return slug;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["docs"] });
      setConfirmId(null);
    },
    onError: (err) => {
      alert(err.message);
    }
  });

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

  return (
    <div className="w-full h-full flex flex-col">
      {mode === "all" && (
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white tracking-tighter">Manage Content</h2>
          <p className="text-zinc-300 text-sm mt-1">Review and delete explicitly verified Database entries.</p>
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
              <h3 className="text-ares-gold font-bold uppercase tracking-widest text-xs">Active Events</h3>
              <button 
                onClick={() => syncGcalMutation.mutate()}
                disabled={syncGcalMutation.isPending}
                className="text-xs font-bold text-ares-cyan bg-ares-cyan/10 hover:bg-ares-cyan/20 px-3 py-1 rounded-md transition-colors flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                {syncGcalMutation.isPending ? "SYNCING..." : "SYNC GCAL"}
              </button>
            </div>
            <div className="flex flex-col gap-3 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
              {events.length === 0 ? (
                <div className="text-zinc-400 text-sm italic py-4">No events found.</div>
              ) : (
                events.map((event) => (
                  <div key={event.id} className="bg-black/40 border border-zinc-800/60 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-zinc-700 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-zinc-200 truncate">{event.title}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-zinc-300 bg-zinc-900 px-2 py-0.5 rounded-md">{format(new Date(event.date_start), 'MMM do, yyyy')}</span>
                        {event.cf_email && (
                          <span className="text-[10px] text-ares-gold/70 bg-ares-gold/10 px-2 py-0.5 rounded-md truncate max-w-[150px]">
                            {event.cf_email}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-2">
                      <button
                        onClick={() => onEditEvent && onEditEvent(event.id)}
                        className="text-xs font-bold text-zinc-400 hover:text-ares-cyan bg-zinc-800/50 hover:bg-zinc-800 px-3 py-1 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                      >
                        EDIT
                      </button>
                      <ClickToDeleteButton 
                        id={event.id} 
                        onDelete={() => deleteEventMutation.mutate(event.id)} 
                        isDeleting={deleteEventMutation.isPending && deleteEventMutation.variables === event.id} 
                      />
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
            <h3 className="text-ares-red font-bold uppercase tracking-widest text-xs mb-4 border-b border-zinc-800 pb-2">Published Blog Posts</h3>
            <div className="flex flex-col gap-3 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
              {posts.length === 0 ? (
                <div className="text-zinc-400 text-sm italic py-4">No posts found.</div>
              ) : (
                posts.map((post) => (
                  <div key={post.slug} className="bg-black/40 border border-zinc-800/60 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-zinc-700 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-zinc-200 truncate">{post.title}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-zinc-300 bg-zinc-900 px-2 py-0.5 rounded-md">{format(new Date(post.date), 'MMM do, yyyy')}</span>
                        {post.cf_email && (
                          <span className="text-[10px] text-ares-gold/70 bg-ares-gold/10 px-2 py-0.5 rounded-md truncate max-w-[150px]">
                            {post.cf_email}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-2">
                      <button
                        onClick={() => onEditPost && onEditPost(post.slug)}
                        className="text-xs font-bold text-zinc-400 hover:text-ares-cyan bg-zinc-800/50 hover:bg-zinc-800 px-3 py-1 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                      >
                        EDIT
                      </button>
                      <ClickToDeleteButton 
                        id={post.slug} 
                        onDelete={() => deletePostMutation.mutate(post.slug)} 
                        isDeleting={deletePostMutation.isPending && deletePostMutation.variables === post.slug} 
                      />
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
            <h3 className="text-zinc-500 font-bold uppercase tracking-widest text-xs mb-4 border-b border-zinc-800 pb-2">
              <span className="flex items-center"><span className="text-ares-red normal-case tracking-normal">ARES</span><span className="text-white normal-case tracking-normal">Lib</span></span> Documentation
            </h3>
            <div className="flex flex-col gap-3 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
              {docs.length === 0 ? (
                <div className="text-zinc-400 text-sm italic py-4">No documentation found.</div>
              ) : (
                docs.map((doc) => (
                  <div key={doc.slug} className="bg-black/40 border border-zinc-800/60 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-zinc-700 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-zinc-200 truncate">{doc.title}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-ares-cyan/70 bg-ares-cyan/10 px-2 py-0.5 rounded-md truncate max-w-[120px]">
                          {doc.category}
                        </span>
                        <span className="text-[10px] text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-md">
                          Order: {doc.sort_order}
                        </span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-2">
                      <button
                        onClick={() => onEditDoc && onEditDoc(doc.slug)}
                        className="text-xs font-bold text-zinc-400 hover:text-ares-cyan bg-zinc-800/50 hover:bg-zinc-800 px-3 py-1 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                      >
                        EDIT
                      </button>
                      <ClickToDeleteButton 
                        id={doc.slug} 
                        onDelete={() => deleteDocMutation.mutate(doc.slug)} 
                        isDeleting={deleteDocMutation.isPending && deleteDocMutation.variables === doc.slug} 
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          )}

        </div>
      )}
    </div>
  );
}
