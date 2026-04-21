import { useState } from "react";
import BroadcastModal from "./BroadcastModal";
import { useContentMutation } from "../hooks/useContentMutation";
import { ViewType } from "./ContentManager/shared";
import EventManagerTab from "./ContentManager/EventManagerTab";
import PostManagerTab from "./ContentManager/PostManagerTab";
import DocManagerTab from "./ContentManager/DocManagerTab";

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
  const [view, setView] = useState<ViewType>("active");
  const [broadcastData, setBroadcastData] = useState<{ isOpen: boolean, type: "blog" | "event", id: string, title: string }>({
    isOpen: false,
    type: "blog",
    id: "",
    title: ""
  });

  // ── Shared Mutations ──────────────────────────────────────────────
  const restoreMutation = useContentMutation<{ type: "event" | "post" | "doc", id: string }>({
    endpoint: ({ type, id }) => {
      const base = type === "event" ? "events" : type === "post" ? "posts" : "docs";
      return `/dashboard/api/admin/${base}/${id}/undelete`;
    },
    method: "PATCH",
    invalidateKeys: ["events", "admin_events", "posts", "docs"],
    clearConfirm: false,
  });

  const purgeMutation = useContentMutation<{ type: "event" | "post" | "doc", id: string }>({
    endpoint: ({ type, id }) => {
      const base = type === "event" ? "events" : type === "post" ? "posts" : "docs";
      return `/dashboard/api/admin/${base}/${id}/purge`;
    },
    invalidateKeys: ["events", "admin_events", "posts", "docs"],
    setConfirmId,
  });

  const approveMutation = useContentMutation<{ type: "event" | "post" | "doc", id: string }>({
    endpoint: ({ type, id }) => {
      const base = type === "event" ? "events" : type === "post" ? "posts" : "docs";
      return `/dashboard/api/admin/${base}/${id}/approve`;
    },
    method: "PATCH",
    invalidateKeys: ["events", "admin_events", "posts", "docs"],
    clearConfirm: false,
  });

  const rejectMutation = useContentMutation<{ type: "event" | "post" | "doc", id: string }>({
    endpoint: ({ type, id }) => {
      const base = type === "event" ? "events" : type === "post" ? "posts" : "docs";
      return `/dashboard/api/admin/${base}/${id}/reject`;
    },
    method: "PATCH",
    invalidateKeys: ["events", "admin_events", "posts", "docs"],
    clearConfirm: false,
  });

  const sharedProps = {
    view,
    confirmId,
    setConfirmId,
    approveMutation,
    rejectMutation,
    restoreMutation,
    purgeMutation
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tighter">
            {mode === "blog" ? "Manage Blogs & News" : mode === "event" ? "Manage Events" : mode === "docs" ? "Manage Documentation" : "Manage Content"}
          </h2>
          <p className="text-zinc-400 text-sm mt-1">Review and manage the lifecycle of Database entries.</p>
        </div>
        
        <div className="flex bg-zinc-900/50 p-1 ares-cut-sm border border-zinc-800 self-start md:self-auto w-full md:w-auto overflow-x-auto custom-scrollbar shadow-inner">
          <button 
            onClick={() => setView("active")}
            className={`px-4 py-1.5 ares-cut-sm text-xs font-bold transition-all whitespace-nowrap ${view === "active" ? 'bg-zinc-800 text-ares-cyan border border-zinc-700 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            ACTIVE
          </button>
          <button 
            onClick={() => setView("pending")}
            className={`px-4 py-1.5 ares-cut-sm text-xs font-bold transition-all whitespace-nowrap ${view === "pending" ? 'bg-ares-gold/10 text-ares-gold border border-ares-gold/20 shadow-sm' : 'text-zinc-500 hover:text-ares-gold/60'}`}
          >
            PENDING
          </button>
          <button 
            onClick={() => setView("trash")}
            className={`px-4 py-1.5 ares-cut-sm text-xs font-bold transition-all whitespace-nowrap ${view === "trash" ? 'bg-ares-red/10 text-ares-red border border-ares-red/20 shadow-sm' : 'text-zinc-500 hover:text-ares-red/60'}`}
          >
            TRASH
          </button>
        </div>
      </div>

      <div className={`grid gap-6 flex-1 ${mode === "all" ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1"}`}>
        {(mode === "all" || mode === "event") && (
          <EventManagerTab 
            {...sharedProps} 
            onEditEvent={onEditEvent}
            broadcastData={broadcastData}
            setBroadcastData={setBroadcastData}
          />
        )}
        {(mode === "all" || mode === "blog") && (
          <PostManagerTab 
            {...sharedProps} 
            onEditPost={onEditPost}
            broadcastData={broadcastData}
            setBroadcastData={setBroadcastData}
          />
        )}
        {(mode === "all" || mode === "docs") && (
          <DocManagerTab 
            {...sharedProps} 
            onEditDoc={onEditDoc}
          />
        )}
      </div>

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
