import { useEffect, useState } from "react";

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

export default function ContentManager({ 
  onEditPost, 
  onEditEvent 
}: { 
  onEditPost?: (slug: string) => void;
  onEditEvent?: (id: string) => void;
}) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Deletion logic statuses
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    
    const loadContent = async () => {
      try {
        const [eventsRes, postsRes] = await Promise.all([
          fetch("/api/events"),
          fetch("/api/posts"),
        ]);

        if (ignore) return;
        
        const eventsData = await eventsRes.json();
        const postsData = await postsRes.json();

        if (eventsData.events) setEvents(eventsData.events);
        if (postsData.posts) setPosts(postsData.posts);
      } catch (err) {
        console.error("Failed to fetch content", err);
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    loadContent();
    return () => { ignore = true; };
  }, []);

  const handleDeleteEvent = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
      if (res.ok) {
        setEvents((prev) => prev.filter((e) => e.id !== id));
        setConfirmId(null);
      } else {
        alert("Failed to delete event. Unauthorized.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeletePost = async (slug: string) => {
    setDeletingId(slug);
    try {
      const res = await fetch(`/api/posts/${slug}`, { method: "DELETE" });
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.slug !== slug));
        setConfirmId(null);
      } else {
        alert("Failed to delete post. Unauthorized.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };

  const ClickToDeleteButton = ({ id, onDelete }: { id: string; onDelete: () => void }) => {
    const isConfirming = confirmId === id;
    const isDeleting = deletingId === id;

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

  return (
    <div className="w-full h-full flex flex-col">
      <div className="mb-6">
        <h2 className="text-2xl font-black text-white tracking-tighter">Manage Content</h2>
        <p className="text-zinc-300 text-sm mt-1">Review and delete explicitly verified Database entries.</p>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center min-h-[300px]">
          <div className="w-8 h-8 md:w-12 md:h-12 border-4 border-zinc-800 border-t-ares-red rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1">
          
          {/* Active Events Column */}
          <div className="flex flex-col">
            <h3 className="text-ares-gold font-bold uppercase tracking-widest text-xs mb-4 border-b border-zinc-800 pb-2">Active Events</h3>
            <div className="flex flex-col gap-3 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
              {events.length === 0 ? (
                <div className="text-zinc-400 text-sm italic py-4">No events found.</div>
              ) : (
                events.map((event) => (
                  <div key={event.id} className="bg-black/40 border border-zinc-800/60 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-zinc-700 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-zinc-200 truncate">{event.title}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-zinc-300 bg-zinc-900 px-2 py-0.5 rounded-md">{new Date(event.date_start).toLocaleDateString()}</span>
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
                      <ClickToDeleteButton id={event.id} onDelete={() => handleDeleteEvent(event.id)} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Published Blog Posts Column */}
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
                        <span className="text-xs text-zinc-300 bg-zinc-900 px-2 py-0.5 rounded-md">{new Date(post.date).toLocaleDateString()}</span>
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
                      <ClickToDeleteButton id={post.slug} onDelete={() => handleDeletePost(post.slug)} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
