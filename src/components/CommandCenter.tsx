import { useState } from "react";
import { RefreshCw, Radio, MessageSquare, Database } from "lucide-react";
import TeamAvailability from "./TeamAvailability";
import IntegrationHealthMonitor from "./command/IntegrationHealthMonitor";
import ProjectBoardKanban from "./command/ProjectBoardKanban";
import PlatformQuickStats from "./command/PlatformQuickStats";
import CommandQuickActions from "./command/CommandQuickActions";
import ZulipBotCommands from "./command/ZulipBotCommands";
import BroadcastWidget from "./command/BroadcastWidget";
import { api } from "../api/client";
import { useQueryClient } from "@tanstack/react-query";

// -- Command Center Component -----------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function CommandCenter({ stats: prefetchedStats }: { stats?: any }) {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);

  // -- Queries --------------------------------------------------------
  const { data: tasksRes, isLoading: isTasksLoading } = api.tasks.list.useQuery(
    ["command-tasks"],
    {},
    { refetchInterval: 30000 }
  );

  const tasksBody = tasksRes?.status === 200 ? tasksRes.body : null;
  const tasks = tasksBody?.tasks || [];

  // Using prefetched stats from parent to avoid waterfall
  const stats = prefetchedStats || { posts: 0, events: 0, docs: 0, integrations: {} };
  
  const health = stats.integrations ? [
    { name: "Task Board", key: "tasks", icon: <Database className="w-8 h-8 mx-auto text-ares-cyan" />, configured: true },
    { name: "Zulip Chat", key: "zulip", icon: <img src="/icons/zulip.svg" alt="Zulip" className="w-8 h-8 mx-auto" />, configured: stats.integrations.zulip },
    { name: "GitHub", key: "github", icon: <img src="/icons/github.svg" alt="GitHub" className="w-8 h-8 mx-auto" />, configured: stats.integrations.github },
    { name: "Discord", key: "discord", icon: <img src="/icons/discord.svg" alt="Discord" className="w-8 h-8 mx-auto" />, configured: stats.integrations.discord },
    { name: "Bluesky", key: "bluesky", icon: <img src="/icons/bluesky.svg" alt="Bluesky" className="w-8 h-8 mx-auto" />, configured: stats.integrations.bluesky },
    { name: "BAND", key: "band", icon: <MessageSquare className="w-8 h-8 mx-auto text-brand-facebook" />, configured: stats.integrations.band },
    { name: "Slack", key: "slack", icon: <img src="/icons/slack.svg" alt="Slack" className="w-8 h-8 mx-auto grayscale invert" />, configured: stats.integrations.slack },
    { name: "Google Calendar", key: "gcal", icon: <img src="/icons/gcal.svg" alt="Google Calendar" className="w-8 h-8 mx-auto" />, configured: stats.integrations.gcal },
  ] : [];

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["command-tasks"] });
    queryClient.invalidateQueries({ queryKey: ["command-health"] });
    queryClient.invalidateQueries({ queryKey: ["command-stats"] });
  };

  // -- Create Task ----------------------------------------------------
  const handleCreateTask = async (title: string) => {
    setIsCreating(true);
    try {
      const res = await api.tasks.create.mutation({
        body: { title }
      });
      if (res.status === 200 && res.body.success) {
        queryClient.invalidateQueries({ queryKey: ["command-tasks"] });
      }
    } catch (err) {
      console.error("Create task failed:", err);
    } finally {
      setIsCreating(false);
    }
  };

  // -- Update Task ----------------------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleUpdateTask = async (id: string, updates: any) => {
    try {
      await api.tasks.update.mutation({
        params: { id },
        body: updates,
      });
      queryClient.invalidateQueries({ queryKey: ["command-tasks"] });
    } catch (err) {
      console.error("Update task failed:", err);
    }
  };

  // -- Delete Task ----------------------------------------------------
  const handleDeleteTask = async (id: string) => {
    try {
      await api.tasks.delete.mutation({
        params: { id },
        body: null,
      });
      queryClient.invalidateQueries({ queryKey: ["command-tasks"] });
    } catch (err) {
      console.error("Delete task failed:", err);
    }
  };

  // -- Reorder Tasks --------------------------------------------------
  const handleReorder = async (items: { id: string; status: string; sort_order: number }[]) => {
    try {
      await api.tasks.reorder.mutation({
        body: { items },
      });
      queryClient.invalidateQueries({ queryKey: ["command-tasks"] });
    } catch (err) {
      console.error("Reorder tasks failed:", err);
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
            Unified view of ARESWEB, Zulip, and team task management
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1.5 bg-white/5 border border-white/10 ares-cut-sm text-xs font-bold text-marble flex items-center gap-2 shadow-inner">
            <div className="w-2 h-2 rounded-full bg-ares-gold animate-pulse" />
            D1 Connected
          </span>
          <button
            onClick={handleRefresh}
            disabled={isTasksLoading}
            title="Refresh dashboard data"
            className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 ares-cut-sm text-marble/40 hover:text-white transition-all disabled:opacity-30"
          >
            <RefreshCw size={16} className={isTasksLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Integration Health Monitor */}
      <IntegrationHealthMonitor health={health} />

      {/* Native Task Board – Kanban View */}
      <ProjectBoardKanban
        tasks={tasks}
        isLoading={isTasksLoading}
        isCreating={isCreating}
        onCreateTask={handleCreateTask}
        onUpdateTask={handleUpdateTask}
        onDeleteTask={handleDeleteTask}
        onReorder={handleReorder}
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ["command-tasks"] })}
      />

      {/* Platform Quick Stats + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PlatformQuickStats stats={stats} />
        <CommandQuickActions />
      </div>

      {/* Zulip Bot Status */}
      <ZulipBotCommands />

      {/* Team Availability Widget and Broadcast */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TeamAvailability />
        <BroadcastWidget />
      </div>
    </div>
  );
}
