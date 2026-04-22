import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Radio, AlertTriangle } from "lucide-react";
import TeamAvailability from "./TeamAvailability";
import { ProjectBoard, IntegrationHealth } from "./command/types";
import IntegrationHealthMonitor from "./command/IntegrationHealthMonitor";
import ProjectBoardKanban from "./command/ProjectBoardKanban";
import PlatformQuickStats from "./command/PlatformQuickStats";
import CommandQuickActions from "./command/CommandQuickActions";
import ZulipBotCommands from "./command/ZulipBotCommands";
import { adminApi } from "../api/adminApi";

// -- Command Center Component -----------------------------------------
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

  // -- Data Fetching --------------------------------------------------
  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [boardRes, settingsRes, statsRes] = await Promise.allSettled([
        adminApi.get<{ success: boolean; board: ProjectBoard }>("/api/github/projects"),
        adminApi.get<{ success: boolean; settings: Record<string, string> }>("/api/admin/settings"),
        Promise.all([
          adminApi.get<{ posts: unknown[] }>("/api/admin/posts?limit=1"),
          adminApi.get<{ events: unknown[] }>("/api/admin/events?limit=1"),
          adminApi.get<{ docs: unknown[] }>("/api/admin/docs?limit=1"),
        ]),
      ]);

      // GitHub Projects Board
      if (boardRes.status === "fulfilled") {
        const data = boardRes.value;
        if (data.success) setBoard(data.board);
      }

      // Integration Health
      if (settingsRes.status === "fulfilled") {
        const data = settingsRes.value;
        if (data.success && data.settings) {
          const cfg = data.settings;
          setHealth([
            { name: "Zulip Chat", key: "zulip", icon: "??", configured: !!(cfg.ZULIP_BOT_EMAIL && cfg.ZULIP_API_KEY) },
            { name: "GitHub Projects", key: "github", icon: "??", configured: !!(cfg.GITHUB_PAT && cfg.GITHUB_PROJECT_ID) },
            { name: "Discord", key: "discord", icon: "??", configured: !!cfg.DISCORD_WEBHOOK_URL },
            { name: "Bluesky", key: "bluesky", icon: "??", configured: !!(cfg.BLUESKY_HANDLE && cfg.BLUESKY_APP_PASSWORD) },
            { name: "Slack", key: "slack", icon: "??", configured: !!cfg.SLACK_WEBHOOK_URL },
            { name: "Google Calendar", key: "gcal", icon: "??", configured: !!(cfg.GCAL_SERVICE_ACCOUNT_EMAIL && cfg.GCAL_PRIVATE_KEY) },
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

  // -- Create Task ----------------------------------------------------
  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) return;
    setIsCreating(true);
    try {
      const data = await adminApi.request<{ success: boolean }>("/api/github/projects/items", { method: "POST", body: JSON.stringify({ title: newTaskTitle.trim() }) });
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
          <p className="text-marble/40 text-sm mt-1">
            Unified view of ARESWEB, Zulip, and GitHub integrations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1.5 bg-white/5 border border-white/10 ares-cut-sm text-xs font-bold text-marble/80 flex items-center gap-2 shadow-inner">
            <div className="w-2 h-2 rounded-full bg-ares-gold animate-pulse" />
            D1 Connected
          </span>
          <span className="text-[10px] font-mono text-marble/20 uppercase">
            Last sync: {lastRefresh.toLocaleTimeString()}
          </span>
          <button
            onClick={fetchAll}
            disabled={isLoading}
            className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 ares-cut-sm text-marble/40 hover:text-white transition-all disabled:opacity-30"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 ares-cut-sm bg-ares-red text-white text-sm font-bold shadow-lg shadow-ares-red/20">
          <AlertTriangle size={16} className="inline mr-2" />
          {error}
        </div>
      )}

      {/* Integration Health Monitor */}
      <IntegrationHealthMonitor health={health} />

      {/* GitHub Project Board – Kanban View */}
      <ProjectBoardKanban 
        board={board}
        isLoading={isLoading}
        isCreating={isCreating}
        newTaskTitle={newTaskTitle}
        setNewTaskTitle={setNewTaskTitle}
        showCreateForm={showCreateForm}
        setShowCreateForm={setShowCreateForm}
        onCreateTask={handleCreateTask}
        onRefresh={fetchAll}
      />

      {/* Platform Quick Stats + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PlatformQuickStats stats={stats} />
        <CommandQuickActions />
      </div>

      {/* Zulip Bot Status */}
      <ZulipBotCommands />

      {/* Team Availability Widget */}
      <div className="grid grid-cols-1 gap-6">
        <TeamAvailability />
      </div>
    </div>
  );
}
