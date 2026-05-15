import React, { useState } from "react";
import { Layout } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import ProjectBoardKanban from "./command/ProjectBoardKanban";
import TaskDetailsModal from "./kanban/TaskDetailsModal";
import { TaskTableView } from "./kanban/TaskTableView";
import { KANBAN_SUBTEAMS } from "./command/ProjectBoardKanban";
import { useQueryClient } from "@tanstack/react-query";
import { useGetTasks, useUpdateTask, useDeleteTask, useReorderTasks, useCreateTask, type Task as TaskItem } from "../api";
import usePartySocket from "partysocket/react";
import { useSession } from "../utils/auth-client";
import { useStore } from "@tanstack/react-store";
import { kanbanStore, kanbanActions } from "../store/kanbanStore";
import { useTaskBoardStore } from "../store/taskBoardStore";
import { toastApiError } from "../api/honoClient";

export interface TaskNode extends TaskItem {
  subRows?: TaskNode[];
}

export default function TaskBoardPage() {
  const queryClient = useQueryClient();
  const [tableEditingTask, setTableEditingTask] = useState<TaskItem | null>(null);

  // Zustand store for all board state
  const {
    viewMode,
    isFullscreen,
    isCreating,
    subteamFilter,
    setViewMode,
    setFullscreen,
    setCreating,
    setSubteamFilter,
  } = useTaskBoardStore();

  // -- Queries --------------------------------------------------------
  const { data: tasksData, isLoading: isTasksLoading } = useGetTasks(undefined, {
    refetchInterval: 30000
  });

  const queryKey = ["tasks", undefined];
  const tasks = tasksData?.tasks || [];

  // Build tree for table view
  const buildTaskTree = (flatTasks: TaskItem[]): TaskNode[] => {
    const taskMap = new Map<string, TaskNode>();
    flatTasks.forEach(t => taskMap.set(t.id, { ...t, subRows: [] }));

    const rootTasks: TaskNode[] = [];
    flatTasks.forEach(t => {
      const node = taskMap.get(t.id)!;
      if (t.parentId && taskMap.has(t.parentId)) {
        taskMap.get(t.parentId)!.subRows!.push(node);
      } else {
        rootTasks.push(node);
      }
    });

    return rootTasks;
  };

  const rootTasks = (tasks as TaskItem[]).filter((t) => !t.parentId);
  const taskTree = buildTaskTree(tasks as TaskItem[]);

  // -- Mutations ------------------------------------------------------
  const updateMutation = useUpdateTask();
  const deleteMutation = useDeleteTask();
  const reorderMutation = useReorderTasks();
  const createMutation = useCreateTask();

  // -- Handlers -------------------------------------------------------
  const subteams = KANBAN_SUBTEAMS;

  const filteredTasks = subteamFilter
    ? rootTasks.filter((t) => t.subteam?.toLowerCase() === subteamFilter.toLowerCase())
    : rootTasks;

  // -- Real-Time Presence & Sync --------------------------------------
  const { data: session } = useSession();
  const activeUsers = useStore(kanbanStore, (s) => s.activeUsers);
  const lastCursorSend = React.useRef(0);
  const boardRef = React.useRef<HTMLDivElement>(null);

  const host = (typeof window !== 'undefined' && window.__PLAYWRIGHT_TEST__)
    ? "dummy-host-for-playwright"
    : (import.meta.env.VITE_PARTYKIT_HOST || "");
  const socket = usePartySocket({
    host: host || "dummy",
    room: "kanban-global",
    party: "kanban",
    onOpen(e) {
      if (!session?.user) return;
      const target = e.target as WebSocket;
      if (!target) return;

      target.send(JSON.stringify({
        type: "presence",
        userId: session.user.id,
        name: session.user.name || "ARES Member",
        image: session.user.image
      }));
    },
    onMessage(e) {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "task_updated") {
          queryClient.invalidateQueries({ queryKey: ["tasks", "list"] });
        } else if (msg.type === "presence") {
          kanbanActions.updateUser(msg.userId, {
            name: msg.name,
            image: msg.image
          });
          if (session?.user && msg.userId !== session.user.id) {
             socket.send(JSON.stringify({
              type: "presence_ack",
              userId: session.user.id,
              name: session.user.name || "ARES Member",
              image: session.user.image
            }));
          }
        } else if (msg.type === "presence_ack") {
          kanbanActions.updateUser(msg.userId, {
            name: msg.name,
            image: msg.image
          });
        } else if (msg.type === "cursor") {
          kanbanActions.updateUser(msg.userId, {
            x: msg.x,
            y: msg.y
          });
        } else if (msg.type === "task_reordered") {
          queryClient.setQueryData(queryKey, (old: { tasks?: TaskItem[] } | undefined) => {
            if (!old?.tasks) return old;
            const newTasks = old.tasks.map((task: TaskItem) => {
              const updatedItem = msg.items.find((i: { id: string; status: string; sortOrder: number }) => i.id === task.id);
              if (updatedItem) {
                return { ...task, status: updatedItem.status, sortOrder: updatedItem.sortOrder };
              }
              return task;
            });
            return { tasks: newTasks };
          });
        }
      } catch (_err) {
        // ignore parse errors
      }
    }
  });

  // Cleanup stale presence
  React.useEffect(() => {
    const interval = setInterval(() => {
      kanbanActions.clearStaleUsers(60000);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const broadcastTaskUpdate = () => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "task_updated" }));
    }
  };

  const handleCreateTaskWithSubteam = async (title: string) => {
    setCreating(true);
    createMutation.mutate({
      title,
      subteam: subteamFilter || null
    }, {
      onSuccess: (res) => {
        if (res.task) {
          queryClient.setQueryData(queryKey, (old: { tasks?: TaskItem[] } | undefined) => {
            const existingTasks = old?.tasks || [];
            return { tasks: [res.task, ...existingTasks] };
          });
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
          broadcastTaskUpdate();
        }
        setCreating(false);
      },
      onError: (err) => {
        setCreating(false);
        toastApiError(err);
      }
    });
  };

  const handleUpdateTask = async (id: string, updates: import("../api").UpdateTaskRequest | Record<string, unknown>) => {
    const apiUpdates: Record<string, unknown> = { ...updates };
    if (updates.assignees && Array.isArray(updates.assignees)) {
      apiUpdates.assignees = updates.assignees.map((a: unknown) => typeof a === 'string' ? a : (a as {id: string}).id);
    }

    updateMutation.mutate({ id, updates: apiUpdates as import("../api").UpdateTaskRequest }, {
      onSuccess: () => broadcastTaskUpdate(),
      onError: (err) => toastApiError(err)
    });
  };

  const handleDeleteTask = async (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => broadcastTaskUpdate(),
      onError: (err) => toastApiError(err)
    });
  };

  const handleReorder = async (items: { id: string; status: string; sortOrder: number }[]) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "task_reordered", items }));
    }
    reorderMutation.mutate({ items }, {
      onSuccess: () => broadcastTaskUpdate(),
      onError: (err) => toastApiError(err)
    });
  };

  const activeUserList = Object.values(activeUsers);

  const userColors = ["#E94B3C", "#2D87BB", "#64C0AB", "#F9A03F", "#9A5B9B"];

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!session?.user) return;
    if (!boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    const now = Date.now();
    if (now - lastCursorSend.current > 50) {
      socket.send(JSON.stringify({ type: "cursor", userId: session.user.id, x, y }));
      lastCursorSend.current = now;
    }
  };

  const boardContent = (
    <div
      ref={boardRef}
      onPointerMove={handlePointerMove}
      className={isFullscreen ? "fixed inset-0 z-50 bg-obsidian overflow-hidden flex flex-col" : "relative space-y-6 flex flex-col"}
    >
      {/* Live Cursors layer */}
      <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
        {activeUserList.map(user => {
          if (user.x === undefined || user.y === undefined) return null;
          if (!session?.user || user.userId === session.user.id) return null;

          let hash = 0;
          for (let i = 0; i < user.userId.length; i++) hash = user.userId.charCodeAt(i) + ((hash << 5) - hash);
          const color = userColors[Math.abs(hash) % userColors.length];

          return (
            <div
              key={user.userId}
              className="absolute pointer-events-none transition-all duration-75 ease-linear flex flex-col items-start"
              style={{ left: `${user.x * 100}%`, top: `${user.y * 100}%` }}
            >
              <svg width="18" height="24" viewBox="0 0 16 21" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-md" style={{ transform: 'rotate(-20deg) scale(1.2)' }}>
                <path d="M1 1.7V20l6.2-5.4h7L1 1.7z" fill={color} stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
              </svg>
              <div className="px-2 py-1 rounded-md text-[10px] font-bold text-white whitespace-nowrap shadow-md" style={{ backgroundColor: color, marginTop: '2px' }}>
                {user.name}
              </div>
            </div>
          );
        })}
      </div>

      {/* Header */}
      <div className={`flex items-center justify-between ${isFullscreen ? "p-6 pb-2 shrink-0 border-b border-white/5 bg-obsidian" : "mb-2"}`}>
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-ares-cyan/20 to-ares-gold/20 ares-cut-sm border border-white/10">
              <Layout className="text-ares-cyan" size={24} />
            </div>
            Task Board
          </h2>
          <p className="text-marble/60 text-sm mt-1">
            Native D1-powered project management kanban
          </p>
        </div>
        <div className="flex items-center gap-4">

          {/* Real-time Presence Avatars */}
          {host && (
            <div className="flex items-center">
              <div className="flex -space-x-2 mr-2">
                {activeUserList.slice(0, 5).map((user, i) => (
                  <div key={i} className="w-8 h-8 rounded-full border border-ares-cyan/40 bg-ares-gray-dark overflow-hidden flex items-center justify-center relative" title={user.name}>
                    {user.image ? (
                      <img src={user.image} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-ares-cyan">{(user.name || "?").charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                ))}
                {activeUserList.length > 5 && (
                  <div className="w-8 h-8 rounded-full border border-ares-cyan/40 bg-ares-cyan/20 text-ares-cyan font-bold text-xs flex items-center justify-center z-10">
                    +{activeUserList.length - 5}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium bg-ares-cyan/10 text-ares-cyan border border-ares-cyan/20">
                <div className="w-1.5 h-1.5 rounded-full bg-ares-cyan animate-pulse"></div> Live
              </div>
            </div>
          )}

          <div className="flex bg-black/40 ares-cut-sm border border-white/10 p-1">
            <button
              onClick={() => setViewMode("kanban")}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${viewMode === "kanban" ? "bg-ares-cyan/20 text-ares-cyan" : "text-ares-gray hover:text-white"}`}
            >
              Kanban
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${viewMode === "table" ? "bg-ares-cyan/20 text-ares-cyan" : "text-ares-gray hover:text-white"}`}
            >
              Table
            </button>
          </div>
          <button
            onClick={() => setFullscreen(!isFullscreen)}
            className="px-4 py-2 bg-ares-gray-dark/50 hover:bg-white/10 text-white font-bold text-sm ares-cut-sm border border-white/10 transition-colors"
          >
            {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          </button>
        </div>
      </div>

      {/* Sub Boards Filter */}
      <div className={`flex flex-wrap gap-2 ${isFullscreen ? "px-6 py-2 shrink-0 bg-obsidian/50" : "mb-6"}`}>
        <button
          onClick={() => setSubteamFilter(null)}
          className={`px-3 py-1.5 text-xs font-bold ares-cut-sm transition-all ${
            !subteamFilter ? "bg-ares-cyan text-black" : "bg-ares-gray-dark/50 text-ares-gray hover:text-white"
          }`}
        >
          All Boards
        </button>
        {subteams.map(st => (
          <button
            key={st}
            onClick={() => setSubteamFilter(st)}
            className={`px-3 py-1.5 text-xs font-bold ares-cut-sm transition-all ${
              subteamFilter === st ? "bg-ares-cyan/20 text-ares-cyan border border-ares-cyan/30" : "bg-ares-gray-dark/50 text-ares-gray border border-white/5 hover:text-white"
            }`}
          >
            {st}
          </button>
        ))}
      </div>
      {/* Main Board Content */}
      <div className={`flex-1 relative ${isFullscreen ? "px-6 pb-6 overflow-hidden flex flex-col" : "min-h-[600px]"}`}>
          {viewMode === "kanban" ? (
            <ProjectBoardKanban
              tasks={filteredTasks}
              allTasks={tasks as TaskItem[]}
              isLoading={isTasksLoading}
              onCreateTask={handleCreateTaskWithSubteam}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
              onReorder={handleReorder}
              isCreating={isCreating}
              onRefresh={() => queryClient.invalidateQueries({ queryKey: ["tasks", "list"] })}
            />
          ) : (
            <div className="w-full h-full pb-4">
              <TaskTableView
                tasks={taskTree}
                onRowClick={(t) => {
                  const { subRows: _subRows, ...taskData } = t;
                  setTableEditingTask(taskData as TaskItem);
                }}
              />
              <AnimatePresence>
                {tableEditingTask && (
                  <TaskDetailsModal
                    key={tableEditingTask.id}
                    task={tableEditingTask}
                    onClose={() => setTableEditingTask(null)}
                    onSave={handleUpdateTask}
                    onDelete={handleDeleteTask}
                    onTaskClick={(t) => setTableEditingTask(t)}
                  />
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
    </div>
  );

  // Bypass Liveblocks realtime connections during E2E testing
  const isE2E = typeof window !== 'undefined' && "__PLAYWRIGHT_TEST__" in window;
  if (isE2E) {
    return boardContent;
  }

  return boardContent;
}
