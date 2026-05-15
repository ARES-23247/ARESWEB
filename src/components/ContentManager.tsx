import { useState } from "react";
import { useLocation, Link } from "@tanstack/react-router";
import { PenTool, Calendar, Book, History } from "lucide-react";
import BroadcastModal from "./BroadcastModal";
import { ViewType } from "./ContentManager/shared";
import EventManagerTab from "./ContentManager/EventManagerTab";
import PostManagerTab from "./ContentManager/PostManagerTab";
import DocManagerTab from "./ContentManager/DocManagerTab";
import SeasonManagerTab from "./ContentManager/SeasonManagerTab";
import BadgeManager from "./BadgeManager";

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
  mode?: "all" | "blog" | "event" | "docs" | "seasons" | "badges";
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

  const sharedProps = {
    view,
    confirmId,
    setConfirmId,
  };

  return (
    <div className="flex-1 w-full flex flex-col min-h-0 bg-obsidian">
      <div className="mb-10 flex flex-col xl:flex-row xl:items-end justify-between gap-8 bg-black/40 border border-white/5 p-10 ares-cut-lg backdrop-blur-sm relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-1 h-0 bg-ares-red group-hover:h-full transition-all duration-700"></div>
        <div className="flex flex-col md:flex-row md:items-center gap-8 relative z-10">
          <div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">
              {mode === "blog" ? "EDITORIAL_DEPLOYS" : mode === "event" ? "EVENT_LOGISTICS" : mode === "docs" ? "KNOWLEDGE_BASE" : mode === "seasons" ? "LEGACY_ARCHIVE" : mode === "badges" ? "MERIT_REGISTRY" : "CONTENT_OPERATIONS"}
            </h2>
            <p className="text-marble/20 text-[10px] font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2">
              <span className="w-6 h-px bg-white/10"></span>
              Review and manage the lifecycle of Platform resources.
            </p>
          </div>
          {mode === "blog" && (
            <Link to="/dashboard/blog" className="flex items-center gap-3 bg-ares-red/10 hover:bg-ares-red text-white px-6 py-3 ares-cut-sm border border-ares-red/30 transition-all text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-ares-red/10 self-start sm:self-auto">
              <PenTool size={16} /> INITIALIZE_POST
            </Link>
          )}
          {mode === "event" && (
            <Link to="/dashboard/event" className="flex items-center gap-3 bg-ares-red/10 hover:bg-ares-red text-white px-6 py-3 ares-cut-sm border border-ares-red/30 transition-all text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-ares-red/10 self-start sm:self-auto">
              <Calendar size={16} /> SCHEDULE_MISSION
            </Link>
          )}
          {mode === "docs" && (
            <Link to="/dashboard/docs" className="flex items-center gap-3 bg-ares-red/10 hover:bg-ares-red text-white px-6 py-3 ares-cut-sm border border-ares-red/30 transition-all text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-ares-red/10 self-start sm:self-auto">
              <Book size={16} /> COMMIT_KNOWLEDGE
            </Link>
          )}
          {mode === "seasons" && (
            <Link to="/dashboard/seasons" className="flex items-center gap-3 bg-ares-red/10 hover:bg-ares-red text-white px-6 py-3 ares-cut-sm border border-ares-red/30 transition-all text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-ares-red/10 self-start sm:self-auto">
              <History size={16} /> FORGE_LEGACY
            </Link>
          )}
        </div>
        
        <div className="flex bg-white/5 p-1.5 ares-cut-sm border border-white/10 self-start xl:self-auto w-full xl:w-auto overflow-x-auto custom-scrollbar shadow-inner gap-1 relative z-10">
          {mode === "event" ? (
            <>
              {[
                { id: "all", label: "ALL_NODES" },
                { id: "internal", label: "PRACTICE", color: "bg-ares-red" },
                { id: "outreach", label: "OUTREACH", color: "bg-ares-gold" },
                { id: "external", label: "COMMUNITY", color: "bg-ares-cyan" }
              ].map(t => (
                <button 
                  key={t.id}
                  onClick={() => setView(t.id as ViewType)}
                  className={`px-4 py-2 ares-cut-sm text-[9px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap flex items-center gap-2 ${view === t.id || (t.id === "all" && view === "active") ? 'bg-white/10 text-white border border-white/20 shadow-lg' : 'text-marble/40 hover:text-marble'}`}
                >
                  {t.color && <span className={`w-1.5 h-1.5 rounded-full ${t.color}`}></span>}
                  {t.label}
                </button>
              ))}
              <button 
                onClick={() => setView("pending")}
                className={`relative px-4 py-2 ares-cut-sm text-[9px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap ${view === "pending" ? 'bg-ares-gold/20 text-ares-gold border border-ares-gold/20 shadow-lg shadow-ares-gold/10' : 'text-marble/40 hover:text-ares-gold/60'} ${((pendingCount ?? 0) > 0 && view !== "pending") ? 'animate-pulse text-ares-danger' : ''}`}
              >
                PENDING_REVIEWS
                {(pendingCount ?? 0) > 0 && view !== "pending" ? (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-ares-danger rounded-full shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                ) : null}
              </button>
              <button 
                onClick={() => setView("trash")}
                className={`px-4 py-2 ares-cut-sm text-[9px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap ${view === "trash" ? 'bg-ares-red/20 text-ares-red border border-ares-red/20 shadow-lg shadow-ares-red/10' : 'text-marble/40 hover:text-ares-red/60'}`}
              >
                TRASH_BIN
              </button>
            </>
          ) : (
            <>
              {[
                { id: "active", label: "ACTIVE_DEPLOYS" },
                { id: "pending", label: "PENDING_REVIEWS", special: "gold" },
                { id: "trash", label: "TRASH_BIN", special: "red" }
              ].map(t => (
                <button 
                  key={t.id}
                  onClick={() => setView(t.id as ViewType)}
                  className={`relative px-5 py-2 ares-cut-sm text-[9px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap 
                    ${view === t.id 
                      ? (t.special === "gold" ? 'bg-ares-gold/20 text-ares-gold border border-ares-gold/20' : t.special === "red" ? 'bg-ares-red/20 text-ares-red border border-ares-red/20' : 'bg-white/10 text-ares-cyan border border-white/20 shadow-lg') 
                      : 'text-marble/40 hover:text-marble'
                    } 
                    ${t.id === "pending" && (pendingCount ?? 0) > 0 && view !== "pending" ? 'animate-pulse text-ares-danger' : ''}`}
                >
                  {t.label}
                  {t.id === "pending" && (pendingCount ?? 0) > 0 && view !== "pending" ? (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-ares-danger rounded-full shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                  ) : null}
                </button>
              ))}
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
        {(mode === "all" || mode === "badges") && (
          <div className={mode === "all" ? "lg:col-span-3" : ""}>
            <BadgeManager />
          </div>
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

