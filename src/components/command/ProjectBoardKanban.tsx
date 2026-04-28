import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Layers, Plus, RefreshCw,
  CheckCircle2, Circle, Clock, AlertTriangle
} from "lucide-react";
import { SortableTaskCard } from "./kanban/SortableTaskCard";
import TaskEditModal from "./TaskEditModal";
import { GenericKanbanBoard } from "../kanban/GenericKanbanBoard";

// ── Types ────────────────────────────────────────────────────────────
export interface TaskItem {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  sort_order: number;
  assignees: { id: string; nickname?: string | null }[];
  created_by: string;
  creator_name?: string | null;
  due_date?: string | null;
  created_at: string;
  updated_at: string;
  assigned_to?: string | null;
  assignee_name?: string | null;
}

interface ProjectBoardKanbanProps {
  tasks: TaskItem[];
  isLoading: boolean;
  onCreateTask: (title: string) => void;
  onUpdateTask: (id: string, updates: Partial<TaskItem>) => Promise<void>;
  onDeleteTask: (id: string) => void;
  onReorder: (items: { id: string; status: string; sort_order: number }[]) => void;
  onRefresh: () => void;
  isCreating: boolean;
}

export const COLUMNS = ["todo", "in_progress", "done", "blocked"] as const;

export const statusConfig: Record<string, { bg: string; text: string; border: string; icon: React.ElementType; label: string }> = {
  todo:        { bg: "bg-ares-gray-dark/60",   text: "text-white/60", border: "border-ares-gray/30", icon: Circle,        label: "Todo" },
  in_progress: { bg: "bg-ares-cyan/10",        text: "text-ares-cyan", border: "border-ares-cyan/30", icon: Clock,         label: "In Progress" },
  done:        { bg: "bg-ares-gold/10",        text: "text-ares-gold", border: "border-ares-gold/30", icon: CheckCircle2,  label: "Done" },
  blocked:     { bg: "bg-ares-red/10",         text: "text-ares-red",  border: "border-ares-red/30",  icon: AlertTriangle, label: "Blocked" },
};

export const priorityBadge: Record<string, string> = {
  urgent: "bg-ares-red text-white",
  high: "bg-ares-bronze/30 text-ares-bronze",
  normal: "bg-white/5 text-ares-gray",
  low: "bg-white/5 text-ares-gray/50",
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
  tasks, isLoading, onCreateTask, onUpdateTask, onDeleteTask, onReorder, isCreating,
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
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full">
      <h3 className="font-black text-white text-sm uppercase tracking-widest flex items-center gap-2">
        <Layers size={16} className="text-ares-cyan" />
        Task Board
      </h3>
      <div className="flex items-center gap-2 mt-4 sm:mt-0 ml-auto">
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          title="Create new task"
          aria-label="Create new task"
          className="p-2 bg-ares-cyan/10 hover:bg-ares-cyan/20 border border-ares-cyan/30 text-ares-cyan ares-cut-sm transition-all"
        >
          <Plus size={16} />
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
            className="overflow-hidden mb-4"
          >
            <div className="flex gap-2 p-3 bg-ares-gray-dark/50 ares-cut-sm border border-white/5">
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="New task title..."
                className="flex-1 bg-transparent text-white text-sm outline-none placeholder-ares-gray font-medium"
              />
              <button
                onClick={handleCreate}
                disabled={isCreating || !newTaskTitle.trim()}
                className="px-4 py-2 bg-ares-cyan/20 hover:bg-ares-cyan/30 text-ares-cyan font-bold text-xs ares-cut-sm border border-ares-cyan/30 transition-all disabled:opacity-30"
              >
                {isCreating ? <RefreshCw size={14} className="animate-spin" /> : "Create"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <GenericKanbanBoard<TaskItem>
        items={tasks}
        columns={COLUMNS}
        columnConfig={statusConfig}
        getId={(task) => String(task.id)}
        getStatus={(task) => task.status}
        getSortOrder={(task) => task.sort_order}
        onReorder={onReorder}
        isLoading={isLoading}
        headerContent={headerContent}
        activeFilter={activeKanbanFilter}
        onFilterChange={setActiveKanbanFilter}
        emptyStateText="No tasks"
        renderItem={(task) => (
          <SortableTaskCard
            key={task.id}
            task={task}
            onDelete={onDeleteTask}
            onUpdateStatus={(id, s) => onUpdateTask(id, { status: s })}
            onEdit={(t) => setEditingTask(t)}
          />
        )}
        renderDragOverlay={(task) => <DragOverlayCard task={task} />}
      />

      <AnimatePresence>
        {editingTask && (
          <TaskEditModal
            task={editingTask}
            onClose={() => setEditingTask(null)}
            onSave={async (id, updates) => {
              await onUpdateTask(id, updates);
              setEditingTask(null);
            }}
            onDelete={(id) => {
              onDeleteTask(id);
              setEditingTask(null);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

