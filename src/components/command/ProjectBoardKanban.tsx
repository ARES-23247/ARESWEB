import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Layers, Plus, RefreshCw, Trash2,
  CheckCircle2, Circle, Clock, AlertTriangle,
  ChevronDown, User
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ── Types ────────────────────────────────────────────────────────────
export interface TaskItem {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  sort_order: number;
  assigned_to?: string | null;
  assignee_name?: string | null;
  created_by: string;
  creator_name?: string | null;
  due_date?: string | null;
  created_at: string;
  updated_at: string;
}

interface ProjectBoardKanbanProps {
  tasks: TaskItem[];
  isLoading: boolean;
  onCreateTask: (title: string) => void;
  onUpdateTask: (id: string, updates: Partial<TaskItem>) => void;
  onDeleteTask: (id: string) => void;
  onReorder: (items: { id: string; status: string; sort_order: number }[]) => void;
  onRefresh: () => void;
  isCreating: boolean;
}

// ── Status config ────────────────────────────────────────────────────
const COLUMNS = ["todo", "in_progress", "done", "blocked"] as const;

const statusConfig: Record<string, { bg: string; text: string; border: string; icon: React.ElementType; label: string }> = {
  todo:        { bg: "bg-ares-gray-dark/60",   text: "text-white/60", border: "border-ares-gray/30", icon: Circle,        label: "Todo" },
  in_progress: { bg: "bg-ares-cyan/10",        text: "text-ares-cyan", border: "border-ares-cyan/30", icon: Clock,         label: "In Progress" },
  done:        { bg: "bg-ares-gold/10",        text: "text-ares-gold", border: "border-ares-gold/30", icon: CheckCircle2,  label: "Done" },
  blocked:     { bg: "bg-ares-red/10",         text: "text-ares-red",  border: "border-ares-red/30",  icon: AlertTriangle, label: "Blocked" },
};

const priorityBadge: Record<string, string> = {
  urgent: "bg-ares-red text-white",
  high: "bg-ares-bronze/30 text-ares-bronze",
  normal: "bg-white/5 text-ares-gray",
  low: "bg-white/5 text-ares-gray/50",
};

// ── Sortable Task Card ───────────────────────────────────────────────
function SortableTaskCard({
  task, onDelete, onUpdateStatus,
}: {
  task: TaskItem;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="p-3 bg-obsidian/60 hover:bg-ares-gray-dark/60 ares-cut-sm border border-white/5 hover:border-white/10 transition-all cursor-grab active:cursor-grabbing group relative"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-sm font-bold text-white leading-tight flex-1">{task.title}</p>
        <div className="relative flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="p-1 text-ares-gray hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Task actions"
          >
            <ChevronDown size={12} />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-6 z-50 bg-obsidian border border-white/10 ares-cut-sm py-1 min-w-[120px] shadow-xl">
              {COLUMNS.filter(s => s !== task.status).map(s => (
                <button
                  key={s}
                  onClick={(e) => { e.stopPropagation(); onUpdateStatus(task.id, s); setShowMenu(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs font-bold text-marble/80 hover:bg-white/5 hover:text-white"
                >
                  → {statusConfig[s].label}
                </button>
              ))}
              <div className="border-t border-white/5 my-1" />
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(task.id); setShowMenu(false); }}
                className="w-full text-left px-3 py-1.5 text-xs font-bold text-ares-red hover:bg-ares-red/10 flex items-center gap-1.5"
              >
                <Trash2 size={10} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {task.priority !== "normal" && (
            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${priorityBadge[task.priority] || priorityBadge.normal}`}>
              {task.priority}
            </span>
          )}
          {task.assignee_name && (
            <span className="text-[9px] font-bold text-ares-gray bg-ares-gray-dark px-1.5 py-0.5 rounded flex items-center gap-0.5">
              <User size={8} /> {task.assignee_name}
            </span>
          )}
        </div>
        {task.due_date && (
          <span className="text-[9px] text-ares-gray font-mono">
            {new Date(task.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        )}
      </div>
    </div>
  );
}

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
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // Group tasks by status column
  const grouped = useMemo(() => {
    const g: Record<string, TaskItem[]> = {};
    for (const col of COLUMNS) g[col] = [];
    for (const t of tasks) {
      const col = COLUMNS.includes(t.status as typeof COLUMNS[number]) ? t.status : "todo";
      g[col].push(t);
    }
    // Sort within each column
    for (const col of COLUMNS) {
      g[col].sort((a, b) => a.sort_order - b.sort_order);
    }
    return g;
  }, [tasks]);

  const filteredColumns = activeKanbanFilter
    ? { [activeKanbanFilter]: grouped[activeKanbanFilter] || [] }
    : grouped;

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;

  // ── DnD Handlers ────────────────────────────────────────────────
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const findColumn = (id: string): string | null => {
    // Check if the id is a column droppable
    if (COLUMNS.includes(id as typeof COLUMNS[number])) return id;
    // Otherwise find which column the task is in
    for (const col of COLUMNS) {
      if (grouped[col].some(t => t.id === id)) return col;
    }
    return null;
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeCol = findColumn(String(active.id));
    const overCol = findColumn(String(over.id));

    if (!activeCol || !overCol || activeCol === overCol) return;

    // Moving to a different column — optimistically handled in DragEnd
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeTaskId = String(active.id);
    const overTarget = String(over.id);

    // Determine target column
    let targetCol: string;
    if (COLUMNS.includes(overTarget as typeof COLUMNS[number])) {
      targetCol = overTarget;
    } else {
      targetCol = findColumn(overTarget) || "todo";
    }

    const task = tasks.find(t => t.id === activeTaskId);
    if (!task) return;

    // If status changed, update it and reorder
    const currentCol = task.status;
    if (currentCol !== targetCol) {
      // Build new order for target column
      const targetItems = [...(grouped[targetCol] || [])];
      const overIndex = targetItems.findIndex(t => t.id === overTarget);
      const insertAt = overIndex >= 0 ? overIndex : targetItems.length;
      targetItems.splice(insertAt, 0, { ...task, status: targetCol });

      const reorderItems = targetItems.map((t, i) => ({
        id: t.id,
        status: targetCol,
        sort_order: i,
      }));
      onReorder(reorderItems);
    } else {
      // Same column reorder
      const colItems = [...(grouped[currentCol] || [])];
      const oldIndex = colItems.findIndex(t => t.id === activeTaskId);
      const newIndex = colItems.findIndex(t => t.id === overTarget);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;

      const [moved] = colItems.splice(oldIndex, 1);
      colItems.splice(newIndex, 0, moved);

      const reorderItems = colItems.map((t, i) => ({
        id: t.id,
        status: currentCol,
        sort_order: i,
      }));
      onReorder(reorderItems);
    }
  };

  const handleCreate = () => {
    if (!newTaskTitle.trim()) return;
    onCreateTask(newTaskTitle.trim());
    setNewTaskTitle("");
    setShowCreateForm(false);
  };

  return (
    <div className="bg-obsidian/50 border border-white/5 ares-cut p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-black text-white text-sm uppercase tracking-widest flex items-center gap-2">
          <Layers size={16} className="text-ares-cyan" />
          Task Board
        </h3>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex bg-ares-gray-dark/50 ares-cut-sm p-0.5 border border-white/5">
            <button
              onClick={() => setActiveKanbanFilter(null)}
              className={`px-2.5 py-1 text-xs font-bold ares-cut-sm transition-all ${
                !activeKanbanFilter ? "bg-white/10 text-white" : "text-ares-gray hover:text-white"
              }`}
            >
              All
            </button>
            {COLUMNS.map(col => (
              <button
                key={col}
                onClick={() => setActiveKanbanFilter(activeKanbanFilter === col ? null : col)}
                className={`px-2.5 py-1 text-xs font-bold ares-cut-sm transition-all ${
                  activeKanbanFilter === col ? "bg-white/10 text-white" : "text-ares-gray hover:text-white"
                }`}
              >
                {statusConfig[col].label}
              </button>
            ))}
          </div>
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

      {isLoading && tasks.length === 0 ? (
        <div className="text-center py-12">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="text-ares-gray animate-spin" size={24} />
            <p className="text-ares-gray text-sm font-bold">Loading task board...</p>
          </div>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(filteredColumns).map(([status, items]) => {
              const config = statusConfig[status] || statusConfig.todo;
              const StatusIcon = config.icon;

              return (
                <div key={status} className={`ares-cut-sm border ${config.border} ${config.bg} overflow-hidden`}>
                  <div className="p-3 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {React.createElement(StatusIcon, { size: 14, className: config.text })}
                      <span className={`text-xs font-black uppercase tracking-wider ${config.text}`}>
                        {config.label}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-ares-gray bg-ares-gray-dark/80 px-2 py-0.5 ares-cut-sm">
                      {items.length}
                    </span>
                  </div>
                  <SortableContext
                    items={items.map(i => i.id)}
                    strategy={verticalListSortingStrategy}
                    id={status}
                  >
                    <div className="p-2 space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/5 min-h-[60px]">
                      {items.length === 0 ? (
                        <p className="text-ares-gray text-xs text-center py-6 italic">No items</p>
                      ) : (
                        items.map((task) => (
                          <SortableTaskCard
                            key={task.id}
                            task={task}
                            onDelete={onDeleteTask}
                            onUpdateStatus={(id, s) => onUpdateTask(id, { status: s })}
                          />
                        ))
                      )}
                    </div>
                  </SortableContext>
                </div>
              );
            })}
          </div>

          <DragOverlay>
            {activeTask ? <DragOverlayCard task={activeTask} /> : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
