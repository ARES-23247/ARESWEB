
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Layers, Plus, RefreshCw,
  CheckCircle2, Circle, Clock, AlertTriangle
} from "lucide-react";
import { SortableTaskCard } from "./kanban/SortableTaskCard";
import TaskDetailsModal from "../kanban/TaskDetailsModal";
import { GenericKanbanBoard } from "../kanban/GenericKanbanBoard";

import { type Task } from "../../api";
export type TaskItem = Task;


export const KANBAN_SUBTEAMS = [
  "Software", 
  "Mechanical", 
  "Electrical", 
  "Strategy", 
  "Business", 
  "Media", 
  "Outreach"
];

interface ProjectBoardKanbanProps {
  tasks: TaskItem[];
  allTasks?: TaskItem[];
  isLoading: boolean;
  onCreateTask: (title: string) => void;
  onUpdateTask: (id: string, updates: import("../../api").UpdateTaskRequest) => Promise<void>;
  onDeleteTask: (id: string) => void;
  onReorder: (items: { id: string; status: string; sortOrder: number }[]) => void;
  onRefresh: () => void;
  isCreating: boolean;
}

export const COLUMNS = ["todo", "in_progress", "done", "blocked"] as const;

export const statusConfig: Record<string, { bg: string; text: string; border: string; icon: React.ElementType<{ size?: number; className?: string }>; label: string }> = {
  todo:        { bg: "bg-white/[0.03]",   text: "text-marble/40", border: "border-white/5", icon: Circle,        label: "BACKLOG_PENDING" },
  in_progress: { bg: "bg-ares-cyan/5",        text: "text-ares-cyan", border: "border-ares-cyan/20", icon: Clock,         label: "ACTIVE_EXECUTION" },
  done:        { bg: "bg-ares-gold/5",        text: "text-ares-gold", border: "border-ares-gold/20", icon: CheckCircle2,  label: "MISSION_COMPLETE" },
  blocked:     { bg: "bg-ares-red/5",         text: "text-ares-red",  border: "border-ares-red/20",  icon: AlertTriangle, label: "CRITICAL_HALT" },
};

export const priorityBadge: Record<string, string> = {
  urgent: "bg-ares-red text-white border-ares-red shadow-[0_0_8px_rgba(233,75,60,0.3)]",
  high: "bg-ares-gold/10 text-ares-gold border-ares-gold/30",
  normal: "bg-white/5 text-marble/40 border-white/10",
  low: "bg-white/[0.02] text-marble/20 border-white/5",
};

// ── Drag Overlay Card ────────────────────────────────────────────────
function DragOverlayCard({ task }: { task: TaskItem }) {
  return (
    <div className="p-3 bg-obsidian/90 ares-cut-sm border border-ares-cyan/40 shadow-lg shadow-ares-cyan/10 cursor-grabbing">
      <p className="text-sm font-bold text-white leading-tight">{task.title}</p>
    </div>
  );
}

// ── Main Kanban Component ────────────────────────────────────────────
export default function ProjectBoardKanban({
  tasks, allTasks, isLoading, onCreateTask, onUpdateTask, onDeleteTask, onReorder, isCreating,
}: ProjectBoardKanbanProps) {
  const [activeKanbanFilter, setActiveKanbanFilter] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);

  const handleCreate = () => {
    if (!newTaskTitle.trim()) return;
    onCreateTask(newTaskTitle.trim());
    setNewTaskTitle("");
    setShowCreateForm(false);
  };

  const headerContent = (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full p-4 bg-black/40 border-b border-white/5">
      <h3 className="font-black text-white text-[10px] uppercase tracking-[0.3em] flex items-center gap-3">
        <Layers size={14} className="text-ares-cyan" />
        SECTOR_OPERATIONS_BOARD
      </h3>
      <div className="flex items-center gap-4 mt-4 sm:mt-0 ml-auto">
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          title="Initialize new tactical task"
          aria-label="Initialize new tactical task"
          className={`flex items-center gap-2 px-4 py-2 font-black uppercase tracking-[0.2em] text-[10px] ares-cut-sm transition-all duration-300 ${showCreateForm ? 'bg-white/10 text-white' : 'bg-ares-cyan text-black hover:bg-ares-cyan/80'}`}
        >
          {showCreateForm ? <RefreshCw size={14} className="rotate-45" /> : <Plus size={14} />}
          {showCreateForm ? "ABORT_INIT" : "INIT_TASK"}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-6"
          >
            <div className="flex gap-4 p-5 bg-black/60 ares-cut-sm border border-ares-cyan/20 backdrop-blur-md shadow-2xl">
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="ENTER_TASK_OBJECTIVE..."
                className="flex-1 bg-white/5 ares-cut-sm border border-white/5 px-4 py-3 text-white text-[10px] font-black uppercase tracking-widest outline-none placeholder:text-marble/10 focus:border-ares-cyan/50 transition-all"
              />
              <button
                onClick={handleCreate}
                disabled={isCreating || !newTaskTitle.trim()}
                className="px-8 py-3 bg-ares-cyan text-black font-black text-[10px] uppercase tracking-[0.2em] ares-cut-sm transition-all disabled:opacity-30 active:scale-95 shadow-lg shadow-ares-cyan/20"
              >
                {isCreating ? <RefreshCw size={14} className="animate-spin" /> : "DEPLOY_TASK"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <GenericKanbanBoard<TaskItem>
        items={tasks}
        columns={COLUMNS}
        columnConfig={statusConfig as unknown as Record<string, import("../kanban/GenericKanbanBoard").KanbanColumnConfig>}
        getId={(task) => String(task.id)}
        getStatus={(task) => (task.status || "todo").replace("-", "_")}
        getSortOrder={(task) => task.sortOrder || 0}
        onReorder={onReorder}
        isLoading={isLoading}
        headerContent={headerContent}
        activeFilter={activeKanbanFilter}
        onFilterChange={setActiveKanbanFilter}
        emptyStateText="No tasks"
        renderItem={(task) => {
          const taskListToUse = allTasks && allTasks.length > 0 ? allTasks : tasks;
          const taskSubtasks = taskListToUse.filter((t) => t.parentId === task.id);
          const completedSubtasksCount = taskSubtasks.filter((t) => t.status === "done").length;
          return (
            <SortableTaskCard
              key={task.id}
              task={task}
              subtasksCount={taskSubtasks.length}
              completedSubtasksCount={completedSubtasksCount}
              onDelete={onDeleteTask}
              onUpdateStatus={(id, s) => onUpdateTask(id, { status: s as import("../../api").UpdateTaskRequest["status"] })}
              onEdit={(t) => setEditingTask(t)}
            />
          );
        }}
        renderDragOverlay={(task) => <DragOverlayCard task={task} />}
      />

      <AnimatePresence>
        {editingTask && (
          <TaskDetailsModal
            key={editingTask.id}
            task={editingTask}
            onClose={() => setEditingTask(null)}
            onSave={onUpdateTask}
            onDelete={onDeleteTask}
            onTaskClick={(t) => setEditingTask(t)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

