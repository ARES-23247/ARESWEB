import { useState } from "react";
import { useLocation } from "react-router-dom";
import BroadcastModal from "./BroadcastModal";
import { useContentMutation } from "../hooks/useContentMutation";
import { ViewType } from "./ContentManager/shared";
import EventManagerTab from "./ContentManager/EventManagerTab";
import PostManagerTab from "./ContentManager/PostManagerTab";
import DocManagerTab from "./ContentManager/DocManagerTab";
import SeasonManagerTab from "./ContentManager/SeasonManagerTab";

export default function ContentManager({ 
  onEditPost, 
  onEditEvent,
  onEditDoc,
  onEditSeason,
  mode = "all",
  pendingCount
}: { 
  onEditPost?: (slug: string) => void; 
  onEditEvent?: (id: string) => void;
  onEditDoc?: (slug: string) => void;
  onEditSeason?: (id: string) => void;
  mode?: "all" | "blog" | "event" | "docs" | "seasons";
  pendingCount?: number;
}) {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialView = (queryParams.get("view") as ViewType) || (mode === "event" ? "all" : "active");

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [view, setView] = useState<ViewType>(initialView);
  const [broadcastData, setBroadcastData] = useState<{ isOpen: boolean, type: "blog" | "event", id: string, title: string }>({
    isOpen: false,
    type: "blog",
    id: "",
    title: ""
  });

  // ── Shared Mutations ──────────────────────────────────────────────
  const restoreMutation = useContentMutation<{ type: "event" | "post" | "doc" | "season", id: string }>({
    endpoint: ({ type, id }) => {
      const base = type === "event" ? "events" : type === "post" ? "posts" : type === "doc" ? "docs" : "seasons";
      return `/api/admin/${base}/${id}/undelete`;
    },
    method: "PATCH",
    invalidateKeys: ["events", "admin_events", "admin_events_notifications", "posts", "docs", "admin-seasons"],
    clearConfirm: false,
  });

  const purgeMutation = useContentMutation<{ type: "event" | "post" | "doc" | "season", id: string }>({
    endpoint: ({ type, id }) => {
      const base = type === "event" ? "events" : type === "post" ? "posts" : type === "doc" ? "docs" : "seasons";
      return `/api/admin/${base}/${id}/purge`;
    },
    invalidateKeys: ["events", "admin_events", "admin_events_notifications", "posts", "docs", "admin-seasons"],
    setConfirmId,
  });

  const approveMutation = useContentMutation<{ type: "event" | "post" | "doc", id: string }>({
    endpoint: ({ type, id }) => {
      const base = type === "event" ? "events" : type === "post" ? "posts" : "docs";
      return `/api/admin/${base}/${id}/approve`;
    },
    method: "PATCH",
    invalidateKeys: ["events", "admin_events", "admin_events_notifications", "posts", "docs"],
    clearConfirm: false,
  });

  const rejectMutation = useContentMutation<{ type: "event" | "post" | "doc", id: string }>({
    endpoint: ({ type, id }) => {
      const base = type === "event" ? "events" : type === "post" ? "posts" : "docs";
      return `/api/admin/${base}/${id}/reject`;
    },
    method: "PATCH",
    invalidateKeys: ["events", "admin_events", "admin_events_notifications", "posts", "docs"],
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
    <div className="flex-1 w-full flex flex-col min-h-0">
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tighter">
            {mode === "blog" ? "Manage Blogs & News" : mode === "event" ? "Manage Events" : mode === "docs" ? "Manage Documentation" : mode === "seasons" ? "Manage Seasonal Legacy" : "Manage Content"}
          </h2>
          <p className="text-marble/40 text-sm mt-1">Review and manage the lifecycle of Database entries.</p>
        </div>
        
        <div className="flex bg-obsidian/50 p-1 ares-cut-sm border border-white/10 self-start md:self-auto w-full md:w-auto overflow-x-auto custom-scrollbar shadow-inner gap-1">
          {mode === "event" ? (
            <>
              <button 
                onClick={() => setView("all")}
                className={`px-3 py-1.5 ares-cut-sm text-xs font-bold transition-all whitespace-nowrap ${view === "all" || view === "active" ? 'bg-white/10 text-white border border-white/20 shadow-sm' : 'text-marble/50 hover:text-marble'}`}
              >
                ALL
              </button>
              <button 
                onClick={() => setView("internal")}
                className={`px-3 py-1.5 ares-cut-sm text-xs sm:text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${view === "internal" ? 'bg-white/10 text-white border border-white/20 shadow-sm' : 'text-marble/50 hover:text-marble'}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-ares-red"></span>
                PRACTICES
              </button>
              <button 
                onClick={() => setView("outreach")}
                className={`px-3 py-1.5 ares-cut-sm text-xs sm:text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${view === "outreach" ? 'bg-white/10 text-white border border-white/20 shadow-sm' : 'text-marble/50 hover:text-marble'}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-ares-gold"></span>
                OUTREACH
              </button>
              <button 
                onClick={() => setView("external")}
                className={`px-3 py-1.5 ares-cut-sm text-xs sm:text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${view === "external" ? 'bg-white/10 text-white border border-white/20 shadow-sm' : 'text-marble/50 hover:text-marble'}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-ares-cyan"></span>
                COMMUNITY
              </button>
              <button 
                onClick={() => setView("pending")}
                className={`relative px-3 py-1.5 ares-cut-sm text-xs sm:text-xs font-bold transition-all whitespace-nowrap ${view === "pending" ? 'bg-ares-gold/10 text-ares-gold border border-ares-gold/20 shadow-sm' : 'text-marble/50 hover:text-ares-gold/60'} ${((pendingCount ?? 0) > 0 && view !== "pending") ? 'animate-pulse text-ares-danger shadow-[0_0_10px_rgba(239,68,68,0.2)]' : ''}`}
              >
                PENDING
                {(pendingCount ?? 0) > 0 && view !== "pending" ? (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-ares-danger rounded-full shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                ) : null}
              </button>
              <button 
                onClick={() => setView("trash")}
                className={`px-3 py-1.5 ares-cut-sm text-xs sm:text-xs font-bold transition-all whitespace-nowrap ${view === "trash" ? 'bg-ares-red/10 text-ares-red border border-ares-red/20 shadow-sm' : 'text-marble/50 hover:text-ares-red/60'}`}
              >
                TRASH
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={() => setView("active")}
                className={`px-4 py-1.5 ares-cut-sm text-xs font-bold transition-all whitespace-nowrap ${view === "active" ? 'bg-white/10 text-ares-cyan border border-white/20 shadow-sm' : 'text-marble/50 hover:text-marble'}`}
              >
                ACTIVE
              </button>
              <button 
                onClick={() => setView("pending")}
                className={`relative px-4 py-1.5 ares-cut-sm text-xs font-bold transition-all whitespace-nowrap ${view === "pending" ? 'bg-ares-gold/10 text-ares-gold border border-ares-gold/20 shadow-sm' : 'text-marble/50 hover:text-ares-gold/60'} ${((pendingCount ?? 0) > 0 && view !== "pending") ? 'animate-pulse text-ares-danger shadow-[0_0_10px_rgba(239,68,68,0.2)]' : ''}`}
              >
                PENDING
                {(pendingCount ?? 0) > 0 && view !== "pending" ? (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-ares-danger rounded-full shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                ) : null}
              </button>
              <button 
                onClick={() => setView("trash")}
                className={`px-4 py-1.5 ares-cut-sm text-xs font-bold transition-all whitespace-nowrap ${view === "trash" ? 'bg-ares-red/10 text-ares-red border border-ares-red/20 shadow-sm' : 'text-marble/50 hover:text-ares-red/60'}`}
              >
                TRASH
              </button>
            </>
          )}
        </div>
      </div>

      <div className={`grid gap-6 flex-1 min-h-0 ${mode === "all" ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1"}`}>
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
        {(mode === "all" || mode === "seasons") && (
          <SeasonManagerTab 
            {...sharedProps} 
            onEdit={onEditSeason}
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
