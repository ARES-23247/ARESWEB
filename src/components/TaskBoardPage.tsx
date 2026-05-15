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
          <h2 className="text-4xl font-black text-white flex items-center gap-6 uppercase tracking-tighter leading-none">
            <div className="p-3 bg-white/5 ares-cut-sm border border-white/10 group-hover:border-white/20 transition-all shadow-inner">
              <Layout className="text-ares-cyan" size={32} />
            </div>
            TASK_COMMAND_BOARD
          </h2>
          <p className="text-marble/40 text-[10px] mt-4 uppercase tracking-[0.4em] font-black flex items-center gap-2">
            <span className="w-8 h-px bg-white/10"></span>
            NATIVE_D1_POWERED_PROJECT_MANAGEMENT_TELEMETRY
          </p>
        </div>
        <div className="flex items-center gap-4">

          {/* Real-time Presence Avatars */}
          {host && (
            <div className="flex items-center bg-black/40 px-4 py-2 ares-cut-sm border border-white/5 shadow-inner backdrop-blur-md">
              <div className="flex -space-x-3 mr-4">
                {activeUserList.slice(0, 5).map((user, i) => (
                  <div key={i} className="w-9 h-9 ares-cut-sm border border-ares-cyan/40 bg-ares-gray-dark overflow-hidden flex items-center justify-center relative shadow-lg" title={user.name}>
                    {user.image ? (
                      <img src={user.image} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-black text-ares-cyan uppercase">{user.name.charAt(0)}</span>
                    )}
                  </div>
                ))}
                {activeUserList.length > 5 && (
                  <div className="w-9 h-9 ares-cut-sm border border-ares-cyan/40 bg-ares-cyan/10 text-ares-cyan font-black text-[10px] flex items-center justify-center z-10 shadow-lg">
                    +{activeUserList.length - 5}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 ares-cut-sm text-[10px] font-black bg-ares-cyan/5 text-ares-cyan border border-ares-cyan/20 uppercase tracking-[0.2em]">
                <div className="w-2 h-2 rounded-full bg-ares-cyan animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.5)]"></div> 
                SYSTEM_LIVE
              </div>
            </div>
          )}

          <div className="flex bg-black/40 ares-cut-sm border border-white/5 p-1.5 shadow-inner backdrop-blur-md">
            <button
              onClick={() => setViewMode("kanban")}
              className={`px-5 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all ares-cut-sm ${viewMode === "kanban" ? "bg-ares-cyan/10 text-ares-cyan shadow-lg shadow-ares-cyan/10" : "text-marble/30 hover:text-white hover:bg-white/5"}`}
            >
              KANBAN_VIEW
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`px-5 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all ares-cut-sm ${viewMode === "table" ? "bg-ares-cyan/10 text-ares-cyan shadow-lg shadow-ares-cyan/10" : "text-marble/30 hover:text-white hover:bg-white/5"}`}
            >
              TABLE_VIEW
            </button>
          </div>
          <button
            onClick={() => setFullscreen(!isFullscreen)}
            className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-black text-[10px] uppercase tracking-[0.2em] ares-cut-sm border border-white/10 transition-all shadow-xl active:scale-95"
          >
            {isFullscreen ? "ABORT_FULLSCREEN" : "ENGAGE_FULLSCREEN"}
          </button>
        </div>
      </div>

      {/* Sub Boards Filter */}
      <div className={`flex flex-wrap items-center gap-3 ${isFullscreen ? "px-6 py-4 shrink-0 bg-obsidian/80 border-b border-white/5" : "mb-8 bg-black/20 p-4 ares-cut-lg border border-white/5"}`}>
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-marble/20 mr-2">SUBTEAM_FILTER:</span>
        <button
          onClick={() => setSubteamFilter(null)}
          className={`px-5 py-2 text-[10px] font-black uppercase tracking-[0.2em] ares-cut-sm transition-all border ${
            !subteamFilter 
              ? "bg-ares-cyan text-black border-ares-cyan shadow-lg shadow-ares-cyan/20" 
              : "bg-white/5 text-marble/40 border-white/5 hover:text-white hover:bg-white/10"
          }`}
        >
          ALL_SECTORS
        </button>
        {subteams.map(st => (
          <button
            key={st}
            onClick={() => setSubteamFilter(st)}
            className={`px-5 py-2 text-[10px] font-black uppercase tracking-[0.2em] ares-cut-sm transition-all border ${
              subteamFilter === st 
                ? "bg-ares-cyan/10 text-ares-cyan border-ares-cyan/40 shadow-lg shadow-ares-cyan/10" 
                : "bg-white/[0.03] text-marble/30 border-white/5 hover:text-white hover:bg-white/5"
            }`}
          >
            {st.toUpperCase()}
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
