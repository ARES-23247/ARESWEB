import { useState } from "react";
import { RefreshCw, Radio } from "lucide-react";
import TeamAvailability from "./TeamAvailability";
import IntegrationHealthMonitor from "./command/IntegrationHealthMonitor";
import ProjectBoardKanban from "./command/ProjectBoardKanban";
import PlatformQuickStats from "./command/PlatformQuickStats";
import CommandQuickActions from "./command/CommandQuickActions";
import ZulipBotCommands from "./command/ZulipBotCommands";
import { api } from "../api/client";
import { useQueryClient } from "@tanstack/react-query";

// -- Command Center Component -----------------------------------------
export default function CommandCenter() {
  const queryClient = useQueryClient();
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // -- Queries --------------------------------------------------------
  const { data: boardRes, isLoading: isBoardLoading, isError: isBoardError } = api.github.getBoard.useQuery({}, {
    queryKey: ["command-board"],
    refetchInterval: 60000,
  });
  const board = boardRes?.status === 200 ? boardRes.body.board : null;

  const { data: analyticsData, isLoading: isStatsLoading, isError: isStatsError } = api.analytics.getStats.useQuery({}, {
    queryKey: ["command-stats"],
    refetchInterval: 300000,
  });

  const stats = analyticsData?.status === 200 ? analyticsData.body : { posts: 0, events: 0, docs: 0 };
  const health = analyticsData?.status === 200 ? [
    { name: "Zulip Chat", key: "zulip", icon: <img src="/icons/zulip.svg" alt="Zulip" className="w-8 h-8 mx-auto" />, configured: analyticsData.body.integrations.zulip },
    { name: "GitHub Projects", key: "github", icon: <img src="/icons/github.svg" alt="GitHub" className="w-8 h-8 mx-auto" />, configured: analyticsData.body.integrations.github },
    { name: "Discord", key: "discord", icon: <img src="/icons/discord.svg" alt="Discord" className="w-8 h-8 mx-auto" />, configured: analyticsData.body.integrations.discord },
    { name: "Bluesky", key: "bluesky", icon: <img src="/icons/bluesky.svg" alt="Bluesky" className="w-8 h-8 mx-auto" />, configured: analyticsData.body.integrations.bluesky },
    { name: "Slack", key: "slack", icon: <img src="/icons/slack.svg" alt="Slack" className="w-8 h-8 mx-auto grayscale invert" />, configured: analyticsData.body.integrations.slack },
    { name: "Google Calendar", key: "gcal", icon: <img src="/icons/gcal.svg" alt="Google Calendar" className="w-8 h-8 mx-auto" />, configured: analyticsData.body.integrations.gcal },
  ] : [];

  const isLoading = isBoardLoading || isStatsLoading;
  const isError = isBoardError || isStatsError;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["command-board"] });
    queryClient.invalidateQueries({ queryKey: ["command-health"] });
    queryClient.invalidateQueries({ queryKey: ["command-stats"] });
  };

  // -- Create Task ----------------------------------------------------
  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) return;
    setIsCreating(true);
    try {
      const res = await api.github.createItem.mutation({
        body: { title: newTaskTitle.trim() }
      });
      if (res.status === 200 && res.body.success) {
        setNewTaskTitle("");
        setShowCreateForm(false);
        queryClient.invalidateQueries({ queryKey: ["command-board"] });
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
          <span className="px-3 py-1.5 bg-white/5 border border-white/10 ares-cut-sm text-xs font-bold text-marble flex items-center gap-2 shadow-inner">
            <div className="w-2 h-2 rounded-full bg-ares-gold animate-pulse" />
            D1 Connected
          </span>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            title="Refresh dashboard data"
            className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 ares-cut-sm text-marble/40 hover:text-white transition-all disabled:opacity-30"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {isError && (
        <div className="bg-ares-red/10 border border-ares-red/30 p-4 ares-cut-sm text-ares-red text-xs font-bold mb-6 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-ares-red animate-pulse" />
          TELEMETRY FAULT: Command Center synchronization partially degraded.
        </div>
      )}

      {/* Integration Health Monitor */}
      <IntegrationHealthMonitor health={health} />

      {/* GitHub Project Board – Kanban View */}
      <ProjectBoardKanban 
        board={board || null}
        isLoading={isBoardLoading}
        isCreating={isCreating}
        newTaskTitle={newTaskTitle}
        setNewTaskTitle={setNewTaskTitle}
        showCreateForm={showCreateForm}
        setShowCreateForm={setShowCreateForm}
        onCreateTask={handleCreateTask}
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ["command-board"] })}
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

