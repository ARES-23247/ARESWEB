
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Save, Trash2, Calendar, User, Flag,
  CheckCircle2, Circle, Clock, AlertTriangle,
  RefreshCw, Layers
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetTasks, useGetUsers, useUpdateTask, useDeleteTask } from "../../api";
import type { TaskItem } from "./ProjectBoardKanban";
import type { UpdateTaskRequest } from "../../api";

const STATUS_OPTIONS = [
  { value: "todo", label: "Todo", icon: Circle, color: "text-white/60", bg: "bg-ares-gray-dark/60", border: "border-ares-gray/30" },
  { value: "in_progress", label: "In Progress", icon: Clock, color: "text-ares-cyan", bg: "bg-ares-cyan/10", border: "border-ares-cyan/30" },
  { value: "done", label: "Done", icon: CheckCircle2, color: "text-ares-gold", bg: "bg-ares-gold/10", border: "border-ares-gold/30" },
  { value: "blocked", label: "Parked", icon: AlertTriangle, color: "text-ares-red", bg: "bg-ares-red/10", border: "border-ares-red/30" },
] as const;

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low", color: "bg-white/5 text-ares-gray/50 border-white/5" },
  { value: "normal", label: "Normal", color: "bg-white/5 text-ares-gray border-white/5" },
  { value: "high", label: "High", color: "bg-ares-bronze/20 text-ares-bronze border-ares-bronze/30" },
  { value: "urgent", label: "Urgent", color: "bg-ares-red/20 text-ares-red border-ares-red/30" },
] as const;

export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const _queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Fetch all tasks and find the one we need
  const { data: tasksData, isLoading } = useGetTasks();

  const tasks = tasksData?.tasks ?? [];
  const task = tasks.find((t: TaskItem) => t.id === taskId);
  // Local edit state — synced from task on first load
  const [edits, setEdits] = useState<UpdateTaskRequest>({});

  // Fetch team members for assignee picker
  const { data: usersData } = useGetUsers({ limit: 100 });
  const teamMembers = usersData?.users ?? [];

  const updateMutation = useUpdateTask();
  const deleteMutation = useDeleteTask();

  const getValue = <K extends keyof UpdateTaskRequest>(field: K) => {
    if (field in edits) return edits[field];
    return task[field as keyof TaskItem];
  };
  
  const setField = <K extends keyof UpdateTaskRequest>(field: K, value: UpdateTaskRequest[K]) => 
    setEdits(prev => ({ ...prev, [field]: value }));

  const getAssigneeId = () => {
    if ("assignees" in edits) {
      return edits.assignees?.[0] || "";
    }
    return task.assignees?.[0]?.id || "";
  };

  const setAssigneeId = (val: string) => {
    setEdits(prev => ({ ...prev, assignees: val ? [val] : [] }));
  };
  
  const handleSave = async () => {
    if (!taskId || Object.keys(edits).length === 0) return;
    setIsSaving(true);
    try {
      await updateMutation.mutateAsync({ id: taskId, updates: edits });
      setEdits({});
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!taskId) return;
    // Remove the task from cache directly to avoid loading state
    _queryClient.setQueryData(['tasks'], (oldData: { tasks: TaskItem[] } | undefined) => {
      if (!oldData) return oldData;
      return {
        tasks: oldData.tasks.filter(t => t.id !== taskId),
      };
    });
    // Use mutate with custom onSuccess to prevent invalidation
    await deleteMutation.mutateAsync(taskId, {
      onSuccess: () => {
        // Don't invalidate - we already updated the cache
      },
    });
    navigate("/dashboard/command_center");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <RefreshCw className="text-ares-cyan animate-spin" size={32} />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="text-center py-32">
        <Layers size={48} className="mx-auto text-ares-gray mb-4" />
        <p className="text-ares-gray font-bold text-lg">Task not found</p>
        <button
          onClick={() => navigate("/dashboard/command_center")}
          className="mt-4 px-4 py-2 bg-white/5 hover:bg-white/10 text-marble text-sm font-bold ares-cut-sm border border-white/10 inline-flex items-center gap-2"
        >
          <ArrowLeft size={14} /> Back to Command Center
        </button>
      </div>
    );
  }

  const currentStatus = (getValue("status") as string) || "todo";
  const currentPriority = (getValue("priority") as string) || "normal";
  const currentDue = getValue("due_date") as string | null;
  const isOverdue = currentDue && new Date(currentDue) < new Date() && currentStatus !== "done";
  const isDirty = Object.keys(edits).length > 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate("/dashboard/command_center")}
          className="flex items-center gap-2 text-ares-gray hover:text-white transition-colors text-sm font-bold"
        >
          <ArrowLeft size={16} /> Command Center
        </button>
        <div className="flex items-center gap-2">
          {isDirty && (
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-[10px] font-black text-ares-gold uppercase tracking-widest"
            >
              Unsaved changes
            </motion.span>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            className="px-4 py-2 bg-ares-cyan/20 hover:bg-ares-cyan/30 text-ares-cyan text-xs font-bold ares-cut-sm border border-ares-cyan/30 flex items-center gap-2 disabled:opacity-30 transition-all"
          >
            <Save size={14} />
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-obsidian/50 border border-white/5 ares-cut overflow-hidden">
        {/* Title Section */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-ares-cyan/10 ares-cut-sm border border-ares-cyan/20">
              <Flag size={18} className="text-ares-cyan" />
            </div>
            <div>
              <p className="text-[10px] text-ares-gray font-mono">{task.id}</p>
            </div>
          </div>
          <label htmlFor="task-title" className="sr-only">Task Title</label>
          <input
            id="task-title"
            title="Task Title"
            type="text"
            value={(getValue("title") as string) || ""}
            onChange={(e) => setField("title", e.target.value)}
            className="w-full bg-transparent text-white text-xl font-black outline-none placeholder-ares-gray border-b border-transparent focus:border-ares-cyan/30 transition-colors pb-1"
            placeholder="Task title..."
          />
        </div>

        {/* Status + Priority bar */}
        <div className="p-6 border-b border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <span className="text-[10px] font-black text-ares-gray uppercase tracking-widest mb-2 block">
              Status
            </span>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map(opt => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setField("status", opt.value)}
                    className={`flex items-center gap-2 px-3 py-2 text-xs font-bold ares-cut-sm transition-all border ${
                      currentStatus === opt.value
                        ? `${opt.bg} ${opt.border} text-white`
                        : "bg-ares-gray-dark/30 border-white/5 text-ares-gray hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <Icon size={14} className={opt.color} />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span className="text-[10px] font-black text-ares-gray uppercase tracking-widest mb-2 block">
              Priority
            </span>
            <div className="flex flex-wrap gap-2">
              {PRIORITY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setField("priority", opt.value)}
                  className={`px-3 py-2 text-xs font-bold ares-cut-sm transition-all border ${
                    currentPriority === opt.value
                      ? `${opt.color}`
                      : "bg-ares-gray-dark/30 border-white/5 text-ares-gray hover:text-white hover:bg-white/5"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="p-6 border-b border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label htmlFor="assignee-select" className="text-[10px] font-black text-ares-gray uppercase tracking-widest mb-1.5 flex items-center gap-1">
              <User size={10} />
              Assignee
            </label>
            <select
              id="assignee-select"
              title="Assignee"
              value={getAssigneeId()}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full bg-ares-gray-dark/50 border border-white/10 text-white text-sm px-3 py-2.5 ares-cut-sm outline-none focus:border-ares-cyan/50 transition-colors"
            >
              <option value="">Unassigned</option>
              {teamMembers.map((m: { id: string; name: string | null; nickname?: string | null }) => (
                <option key={m.id} value={m.id}>
                  {m.nickname || m.name || 'Unknown User'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="due-date-input" className="text-[10px] font-black text-ares-gray uppercase tracking-widest mb-1.5 flex items-center gap-1">
              <Calendar size={10} />
              Due Date
              {isOverdue && (
                <span className="ml-1.5 text-ares-red text-[9px] uppercase font-black animate-pulse">OVERDUE</span>
              )}
            </label>
            <input
              id="due-date-input"
              title="Due Date"
              placeholder="Due Date"
              type="date"
              value={(getValue("due_date") as string) || ""}
              onChange={(e) => setField("due_date", e.target.value || null)}
              className={`w-full bg-ares-gray-dark/50 border text-sm px-3 py-2.5 ares-cut-sm outline-none transition-colors ${
                isOverdue
                  ? "border-ares-red/40 text-ares-red focus:border-ares-red/60"
                  : "border-white/10 text-white focus:border-ares-cyan/50"
              }`}
            />
          </div>
        </div>

        {/* Description */}
        <div className="p-6 border-b border-white/5">
          <label htmlFor="task-description" className="text-[10px] font-black text-ares-gray uppercase tracking-widest mb-2 block">
            Task Description
          </label>
          <textarea
            id="task-description"
            title="Task Description"
            value={(getValue("description") as string) || ""}
            onChange={(e) => setField("description", e.target.value)}
            rows={8}
            className="w-full bg-ares-gray-dark/30 border border-white/5 text-white text-sm px-4 py-3 ares-cut-sm outline-none focus:border-ares-cyan/30 transition-colors resize-none scrollbar-thin scrollbar-thumb-white/5"
            placeholder="Add notes, context, or instructions for this task..."
          />
        </div>

        {/* Metadata + Actions */}
        <div className="p-6 flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-4 text-[10px] text-ares-gray font-mono">
            <span>Created {new Date(task.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
            {task.creator_name && <span>by <span className="text-marble">{task.creator_name}</span></span>}
            <span>Last updated {new Date(task.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
          </div>
          <div>
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-ares-red font-bold">Permanently delete?</span>
                <button
                  onClick={handleDelete}
                  className="px-3 py-1.5 bg-ares-red/20 hover:bg-ares-red/30 text-ares-red text-xs font-bold ares-cut-sm border border-ares-red/30"
                >
                  Delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-ares-gray text-xs font-bold ares-cut-sm border border-white/5"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-2 text-ares-gray hover:text-ares-red transition-colors"
                title="Delete task"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
