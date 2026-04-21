import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Radio, GitBranch, MessageCircle, Plus, RefreshCw, 
  CheckCircle2, Circle, Clock, AlertTriangle, 
  Zap, ExternalLink, ArrowRight, Activity
} from "lucide-react";
import TeamAvailability from "./TeamAvailability";

// ── Types ────────────────────────────────────────────────────────────
interface ProjectItem {
  id: string;
  title: string;
  body?: string;
  status?: string;
  assignees: string[];
  createdAt: string;
  type: string;
}

interface ProjectBoard {
  title: string;
  shortDescription: string;
  items: ProjectItem[];
  totalCount: number;
}

interface IntegrationHealth {
  name: string;
  key: string;
  configured: boolean;
  icon: string;
}

// ── Status Color Map ─────────────────────────────────────────────────
const statusConfig: Record<string, { bg: string; text: string; border: string; icon: React.ElementType }> = {
  "Todo":        { bg: "bg-zinc-800/60",          text: "text-zinc-400",   border: "border-zinc-700",    icon: Circle },
  "In Progress": { bg: "bg-ares-cyan/10",         text: "text-ares-cyan",  border: "border-ares-cyan/30", icon: Clock },
  "Done":        { bg: "bg-emerald-500/10",       text: "text-emerald-400", border: "border-emerald-500/30", icon: CheckCircle2 },
  "Blocked":     { bg: "bg-red-500/10",           text: "text-red-400",    border: "border-red-500/30",  icon: AlertTriangle },
};

const defaultStatus = { bg: "bg-zinc-800/60", text: "text-zinc-400", border: "border-zinc-700", icon: Circle };

function getStatusConfig(status?: string) {
  if (!status) return defaultStatus;
  return statusConfig[status] || defaultStatus;
}

// ── Command Center Component ─────────────────────────────────────────
export default function CommandCenter() {
  const [board, setBoard] = useState<ProjectBoard | null>(null);
  const [health, setHealth] = useState<IntegrationHealth[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [activeKanbanFilter, setActiveKanbanFilter] = useState<string | null>(null);

  // ── Data Fetching ──────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [boardRes, settingsRes, statsRes] = await Promise.allSettled([
        fetch("/dashboard/api/github/projects", { credentials: "include" }),
        fetch("/dashboard/api/admin/settings", { credentials: "include" }),
        Promise.all([
          fetch("/dashboard/api/admin/posts?limit=1", { credentials: "include" }).then(r => r.json() as Promise<{ posts: unknown[] }>),
          fetch("/dashboard/api/admin/events?limit=1", { credentials: "include" }).then(r => r.json() as Promise<{ events: unknown[] }>),
          fetch("/dashboard/api/admin/docs?limit=1", { credentials: "include" }).then(r => r.json() as Promise<{ docs: unknown[] }>),
        ]),
      ]);

      // GitHub Projects Board
      if (boardRes.status === "fulfilled" && boardRes.value.ok) {
        const data = await boardRes.value.json() as { success: boolean; board: ProjectBoard };
        if (data.success) setBoard(data.board);
      }

      // Integration Health
      if (settingsRes.status === "fulfilled" && settingsRes.value.ok) {
        const data = await settingsRes.value.json() as { success: boolean; settings: Record<string, string> };
        if (data.success && data.settings) {
          const cfg = data.settings;
          setHealth([
            { name: "Zulip Chat", key: "zulip", icon: "💬", configured: !!(cfg.ZULIP_BOT_EMAIL && cfg.ZULIP_API_KEY) },
            { name: "GitHub Projects", key: "github", icon: "📋", configured: !!(cfg.GITHUB_PAT && cfg.GITHUB_PROJECT_ID) },
            { name: "Discord", key: "discord", icon: "🎮", configured: !!cfg.DISCORD_WEBHOOK_URL },
            { name: "Bluesky", key: "bluesky", icon: "🦋", configured: !!(cfg.BLUESKY_HANDLE && cfg.BLUESKY_APP_PASSWORD) },
            { name: "Slack", key: "slack", icon: "💼", configured: !!cfg.SLACK_WEBHOOK_URL },
            { name: "Google Calendar", key: "gcal", icon: "📅", configured: !!(cfg.GCAL_SERVICE_ACCOUNT_EMAIL && cfg.GCAL_PRIVATE_KEY) },
          ]);
        }
      }

      // Quick Stats
      if (statsRes.status === "fulfilled") {
        const [posts, events, docs] = statsRes.value;
        setStats({
          posts: Array.isArray(posts.posts) ? posts.posts.length : 0,
          events: Array.isArray(events.events) ? events.events.length : 0,
          docs: Array.isArray(docs.docs) ? docs.docs.length : 0,
        });
      }

      setLastRefresh(new Date());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchAll();
    const interval = setInterval(fetchAll, 60000); // Refresh every 60s
    return () => clearInterval(interval);
  }, [fetchAll]);

  // ── Create Task ────────────────────────────────────────────────────
  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) return;
    setIsCreating(true);
    try {
      const res = await fetch("/dashboard/api/github/projects/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: newTaskTitle.trim() }),
      });
      const data = await res.json() as { success: boolean };
      if (data.success) {
        setNewTaskTitle("");
        setShowCreateForm(false);
        fetchAll();
      }
    } catch (err) {
      console.error("Create task failed:", err);
    } finally {
      setIsCreating(false);
    }
  };

  // ── Kanban Grouping ────────────────────────────────────────────────
  const kanbanColumns = ["Todo", "In Progress", "Done", "Blocked"];
  const groupedItems = kanbanColumns.reduce((acc, col) => {
    acc[col] = board?.items.filter(i => {
      if (!i.status && col === "Todo") return true;
      return i.status === col;
    }) || [];
    return acc;
  }, {} as Record<string, ProjectItem[]>);

  // Filter for the kanban view
  const filteredColumns = activeKanbanFilter 
    ? { [activeKanbanFilter]: groupedItems[activeKanbanFilter] || [] }
    : groupedItems;

  const configuredCount = health.filter(h => h.configured).length;
  const totalIntegrations = health.length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-ares-cyan/20 to-ares-red/20 ares-cut-sm border border-white/10">
              <Radio className="text-ares-cyan" size={24} />
            </div>
            Command Center
          </h2>
          <p className="text-zinc-500 text-sm mt-1">
            Unified view of ARESWEB, Zulip, and GitHub integrations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-zinc-600 uppercase">
            Last sync: {lastRefresh.toLocaleTimeString()}
          </span>
          <button
            onClick={fetchAll}
            disabled={isLoading}
            className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 ares-cut-sm text-zinc-400 hover:text-white transition-all disabled:opacity-30"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 ares-cut-sm bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertTriangle size={16} className="inline mr-2" />
          {error}
        </div>
      )}

      {/* Integration Health Monitor */}
      <div className="bg-zinc-900/50 border border-white/5 ares-cut p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black text-white text-sm uppercase tracking-widest flex items-center gap-2">
            <Activity size={16} className="text-ares-gold" />
            Integration Health
          </h3>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${
            configuredCount === totalIntegrations 
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" 
              : "bg-ares-gold/10 text-ares-gold border border-ares-gold/30"
          }`}>
            {configuredCount}/{totalIntegrations} Active
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {health.map((h) => (
            <motion.div
              key={h.key}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`p-3 ares-cut-sm border text-center transition-all ${
                h.configured
                  ? "bg-zinc-800/40 border-emerald-500/20 hover:border-emerald-500/40"
                  : "bg-zinc-900/40 border-zinc-800 hover:border-zinc-700"
              }`}
            >
              <div className="text-2xl mb-1">{h.icon}</div>
              <p className="text-[11px] font-bold text-white truncate">{h.name}</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <div className={`w-1.5 h-1.5 rounded-full ${h.configured ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`} />
                <span className={`text-[9px] font-bold uppercase tracking-wider ${h.configured ? "text-emerald-400" : "text-zinc-600"}`}>
                  {h.configured ? "Online" : "Offline"}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* GitHub Project Board — Kanban View */}
      <div className="bg-zinc-900/50 border border-white/5 ares-cut p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-black text-white text-sm uppercase tracking-widest flex items-center gap-2">
            <GitBranch size={16} className="text-ares-cyan" />
            {board?.title || "Project Board"}
          </h3>
          <div className="flex items-center gap-2">
            {/* Kanban filters */}
            <div className="hidden sm:flex bg-zinc-800/50 ares-cut-sm p-0.5 border border-white/5">
              <button
                onClick={() => setActiveKanbanFilter(null)}
                className={`px-2.5 py-1 text-[10px] font-bold ares-cut-sm transition-all ${
                  !activeKanbanFilter ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                All
              </button>
              {kanbanColumns.map(col => (
                <button
                  key={col}
                  onClick={() => setActiveKanbanFilter(activeKanbanFilter === col ? null : col)}
                  className={`px-2.5 py-1 text-[10px] font-bold ares-cut-sm transition-all ${
                    activeKanbanFilter === col ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {col}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="p-2 bg-ares-cyan/10 hover:bg-ares-cyan/20 border border-ares-cyan/30 text-ares-cyan ares-cut-sm transition-all"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Quick Create Form */}
        <AnimatePresence>
          {showCreateForm && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-4"
            >
              <div className="flex gap-2 p-3 bg-zinc-800/50 ares-cut-sm border border-white/5">
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateTask()}
                  placeholder="New task title..."
                  className="flex-1 bg-transparent text-white text-sm outline-none placeholder-zinc-600 font-medium"
                />
                <button
                  onClick={handleCreateTask}
                  disabled={isCreating || !newTaskTitle.trim()}
                  className="px-4 py-2 bg-ares-cyan/20 hover:bg-ares-cyan/30 text-ares-cyan font-bold text-xs ares-cut-sm border border-ares-cyan/30 transition-all disabled:opacity-30"
                >
                  {isCreating ? <RefreshCw size={14} className="animate-spin" /> : "Create"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!board ? (
          <div className="text-center py-12">
            {isLoading ? (
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="text-zinc-600 animate-spin" size={24} />
                <p className="text-zinc-600 text-sm font-bold">Loading project board...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <GitBranch className="text-zinc-700" size={32} />
                <p className="text-zinc-500 text-sm font-bold">GitHub Projects not configured</p>
                <p className="text-zinc-600 text-xs max-w-sm mx-auto">
                  Set your <code className="text-ares-cyan">GITHUB_PAT</code> and <code className="text-ares-cyan">GITHUB_PROJECT_ID</code> in System Integrations to enable the project board.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(filteredColumns).map(([status, items]) => {
              const config = getStatusConfig(status);
              const StatusIcon = config.icon;

              return (
                <div key={status} className={`ares-cut-sm border ${config.border} ${config.bg} overflow-hidden`}>
                  <div className="p-3 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusIcon size={14} className={config.text} />
                      <span className={`text-xs font-black uppercase tracking-wider ${config.text}`}>
                        {status}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-zinc-600 bg-zinc-800/80 px-2 py-0.5 rounded-full">
                      {items.length}
                    </span>
                  </div>
                  <div className="p-2 space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/5">
                    {items.length === 0 ? (
                      <p className="text-zinc-700 text-xs text-center py-6 italic">No items</p>
                    ) : (
                      items.map((item) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-3 bg-zinc-900/60 hover:bg-zinc-800/60 ares-cut-sm border border-white/5 hover:border-white/10 transition-all cursor-default group"
                        >
                          <p className="text-sm font-bold text-white leading-tight mb-1.5">{item.title}</p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              {item.assignees.slice(0, 2).map(a => (
                                <span key={a} className="text-[9px] font-bold text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
                                  @{a}
                                </span>
                              ))}
                            </div>
                            <span className="text-[9px] text-zinc-700 font-mono">
                              {item.type === "DRAFT_ISSUE" ? "Draft" : item.type === "ISSUE" ? "Issue" : "PR"}
                            </span>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Platform Quick Stats + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Stats */}
        <div className="bg-zinc-900/50 border border-white/5 ares-cut p-6">
          <h3 className="font-black text-white text-sm uppercase tracking-widest flex items-center gap-2 mb-4">
            <Zap size={16} className="text-ares-gold" />
            Platform Stats
          </h3>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Blog Posts", value: stats.posts || 0, color: "text-ares-red" },
              { label: "Events", value: stats.events || 0, color: "text-ares-gold" },
              { label: "Docs", value: stats.docs || 0, color: "text-ares-cyan" },
            ].map(stat => (
              <div key={stat.label} className="text-center p-4 bg-zinc-800/30 ares-cut-sm border border-white/5">
                <p className={`text-3xl font-black ${stat.color}`}>{stat.value}</p>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-zinc-900/50 border border-white/5 ares-cut p-6">
          <h3 className="font-black text-white text-sm uppercase tracking-widest flex items-center gap-2 mb-4">
            <ArrowRight size={16} className="text-ares-cyan" />
            Quick Actions
          </h3>
          <div className="space-y-2">
            {[
              { label: "Open Zulip Chat", icon: MessageCircle, href: "https://ares.zulipchat.com", color: "bg-blue-500/10 text-blue-400 border-blue-500/20 hover:border-blue-500/40" },
              { label: "Open GitHub Org", icon: GitBranch, href: "https://github.com/ARES-23247", color: "bg-zinc-800/60 text-white border-white/10 hover:border-white/20" },
              { label: "View Activity Heatmap", icon: Activity, href: "/about", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:border-emerald-500/40" },
            ].map(action => (
              <a
                key={action.label}
                href={action.href}
                target={action.href.startsWith("http") ? "_blank" : "_self"}
                rel="noopener noreferrer"
                className={`flex items-center justify-between p-3 ares-cut-sm border transition-all ${action.color}`}
              >
                <div className="flex items-center gap-3">
                  <action.icon size={16} />
                  <span className="text-sm font-bold">{action.label}</span>
                </div>
                <ExternalLink size={14} className="opacity-50" />
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Zulip Bot Status */}
      <div className="bg-zinc-900/50 border border-white/5 ares-cut p-6">
        <h3 className="font-black text-white text-sm uppercase tracking-widest flex items-center gap-2 mb-4">
          <MessageCircle size={16} className="text-blue-400" />
          Zulip Bot Commands
        </h3>
        <p className="text-zinc-500 text-xs mb-4">
          @-mention the ARES Bot in any Zulip stream to use these commands:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { cmd: "!tasks", desc: "List open project items" },
            { cmd: "!task <title>", desc: "Create a draft task" },
            { cmd: "!task # done", desc: "Mark task as done" },
            { cmd: "!stats", desc: "Website quick stats" },
            { cmd: "!inquiries", desc: "Pending inquiry count" },
            { cmd: "!events", desc: "Upcoming events" },
            { cmd: "!broadcast", desc: "Broadcast msg to stream" },
            { cmd: "!help", desc: "Show all commands" },
          ].map(item => (
            <div key={item.cmd} className="p-3 bg-zinc-800/40 ares-cut-sm border border-white/5">
              <code className="text-ares-cyan text-xs font-bold">{item.cmd}</code>
              <p className="text-zinc-500 text-[10px] mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Team Availability Widget */}
      <div className="grid grid-cols-1 gap-6">
        <TeamAvailability />
      </div>
    </div>
  );
}
