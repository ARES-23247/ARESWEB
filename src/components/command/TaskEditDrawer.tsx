import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Save, Trash2, Calendar, User, AlertTriangle, Flag,
  CheckCircle2, Circle, Clock, ArrowUpRight, Plus
} from "lucide-react";
import { api } from "../../api/client";
import type { TaskItem } from "./ProjectBoardKanban";
import { KANBAN_SUBTEAMS } from "./ProjectBoardKanban";
import ZulipThreadViewer from "../events/ZulipThreadViewer";

interface TaskEditDrawerProps {
  task: TaskItem;
  onClose: () => void;
  onSave: (id: string, updates: Partial<TaskItem>) => Promise<void>;
  onDelete: (id: string) => void;
}

const STATUS_OPTIONS = [
  { value: "todo", label: "Todo", icon: Circle, color: "text-white/60" },
  { value: "in_progress", label: "In Progress", icon: Clock, color: "text-ares-cyan" },
  { value: "done", label: "Done", icon: CheckCircle2, color: "text-ares-gold" },
  { value: "blocked", label: "Blocked", icon: AlertTriangle, color: "text-ares-red" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low", color: "bg-white/5 text-ares-gray/50" },
  { value: "normal", label: "Normal", color: "bg-white/5 text-ares-gray" },
  { value: "high", label: "High", color: "bg-ares-bronze/30 text-ares-bronze" },
  { value: "urgent", label: "Urgent", color: "bg-ares-red/20 text-ares-red" },
];

const SUBTEAMS = KANBAN_SUBTEAMS;

export default function TaskEditDrawer({ task, onClose, onSave, onDelete }: TaskEditDrawerProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [status, setStatus] = useState(task.status);
  const [priority, setPriority] = useState(task.priority);
  const [subteam, setSubteam] = useState(task.subteam || "");
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task.assignees?.map(a => a.id) || []);
  const [dueDate, setDueDate] = useState(task.due_date || "");
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch team members for assignee picker
  const { data: usersRes } = api.users.getUsers.useQuery(
    ["team-members-for-tasks"],
    {},
    { staleTime: 60000 }
  );
  const teamMembers = usersRes?.status === 200 ? usersRes.body.users : [];

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowAssigneeDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates: Partial<TaskItem> = {};
      if (title !== task.title) updates.title = title;
      if (description !== (task.description || "")) updates.description = description || null;
      if (status !== task.status) updates.status = status;
      if (priority !== task.priority) updates.priority = priority;
      if (subteam !== (task.subteam || "")) updates.subteam = subteam || null;
      if (dueDate !== (task.due_date || "")) updates.due_date = dueDate || null;
      
      // Compare arrays for equality
      const currentIds = task.assignees?.map(a => a.id) || [];
      const hasAssigneeChange = assigneeIds.length !== currentIds.length || 
        !assigneeIds.every(id => currentIds.includes(id));
      
      if (hasAssigneeChange) {
        updates.assignees = assigneeIds as unknown as { id: string }[];
      }

      if (Object.keys(updates).length > 0) {
        await onSave(task.id, updates);
      }
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const toggleAssignee = (id: string) => {
    setAssigneeIds(prev => 
      prev.includes(id) ? prev.filter(uid => uid !== id) : [...prev, id]
    );
  };

  const isOverdue = dueDate && new Date(dueDate) < new Date() && status !== "done";

  const currentAssignees = teamMembers.filter((m: { id: string }) => assigneeIds.includes(m.id));

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="relative w-full max-w-md h-full bg-obsidian border-l border-white/10 shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-ares-cyan/10 ares-cut-sm border border-ares-cyan/20">
              <Flag size={16} className="text-ares-cyan" />
            </div>
            <div>
              <h3 id="modal-title" className="font-black text-white text-sm uppercase tracking-wider">Edit Task</h3>
              <p className="text-[10px] text-ares-gray font-mono mt-0.5">{task.id.slice(0, 8)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/dashboard/tasks/${task.id}`}
              className="p-2 text-ares-gray hover:text-ares-cyan transition-colors"
              title="Open detail page"
            >
              <ArrowUpRight size={16} />
            </a>
            <button onClick={onClose} className="p-2 text-ares-gray hover:text-white transition-colors" title="Close modal">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin scrollbar-thumb-white/10">
          {/* Title */}
          <div>
            <label htmlFor="modal-title-input" className="text-[10px] font-black text-ares-gray uppercase tracking-widest mb-1.5 block">
              Title
            </label>
            <input
              id="modal-title-input"
              title="Task Title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-ares-gray-dark/50 border border-white/10 text-white text-sm font-bold px-3 py-2.5 ares-cut-sm outline-none focus:border-ares-cyan/50 transition-colors"
              placeholder="Task title..."
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="modal-desc-input" className="text-[10px] font-black text-ares-gray uppercase tracking-widest mb-1.5 block">
              Description
            </label>
            <textarea
              id="modal-desc-input"
              title="Task Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full bg-ares-gray-dark/50 border border-white/10 text-white text-sm px-3 py-2.5 ares-cut-sm outline-none focus:border-ares-cyan/50 transition-colors resize-none scrollbar-thin scrollbar-thumb-white/5"
              placeholder="Add a description..."
            />
          </div>

          {/* Status + Priority row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] font-black text-ares-gray uppercase tracking-widest mb-1.5 block">
                Status
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {STATUS_OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setStatus(opt.value)}
                      className={`flex items-center gap-1.5 px-2.5 py-2 text-xs font-bold ares-cut-sm transition-all ${
                        status === opt.value
                          ? "bg-white/10 border border-white/20 text-white"
                          : "bg-ares-gray-dark/30 border border-white/5 text-ares-gray hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <Icon size={12} className={opt.color} />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-black text-ares-gray uppercase tracking-widest mb-1.5 block">
                Priority
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {PRIORITY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setPriority(opt.value)}
                    className={`px-2.5 py-2 text-xs font-bold ares-cut-sm transition-all ${
                      priority === opt.value
                        ? `${opt.color} border border-white/20`
                        : "bg-ares-gray-dark/30 border border-white/5 text-ares-gray hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Subteam Selection */}
          <div>
            <span className="text-[10px] font-black text-ares-gray uppercase tracking-widest mb-1.5 block">
              Subteam
            </span>
            <select
              value={subteam}
              onChange={(e) => setSubteam(e.target.value)}
              className="w-full bg-ares-gray-dark/50 border border-white/10 text-white text-sm px-3 py-2.5 ares-cut-sm outline-none focus:border-ares-cyan/50 transition-colors"
            >
              <option value="">No Subteam</option>
              {SUBTEAMS.map(team => (
                <option key={team} value={team}>{team}</option>
              ))}
            </select>
          </div>

          {/* Assignees + Due Date row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="relative" ref={dropdownRef}>
              <label className="text-[10px] font-black text-ares-gray uppercase tracking-widest mb-1.5 flex items-center gap-1">
                <User size={10} />
                Assignees ({assigneeIds.length})
              </label>
              
              <div className="flex flex-wrap gap-1.5 p-2 bg-ares-gray-dark/50 border border-white/10 ares-cut-sm min-h-[42px] content-start">
                {currentAssignees.map((m: { id: string; nickname?: string | null; name?: string | null }) => (
                  <span key={m.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-ares-cyan/10 border border-ares-cyan/30 text-ares-cyan text-[10px] font-black ares-cut-sm uppercase tracking-wider">
                    {m.nickname || m.name}
                    <button onClick={() => toggleAssignee(m.id)} className="hover:text-white transition-colors" title="Remove Assignee">
                      <X size={10} />
                    </button>
                  </span>
                ))}
                <button 
                  onClick={() => setShowAssigneeDropdown(!showAssigneeDropdown)}
                  className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-ares-gray hover:text-white transition-all ml-auto"
                  title="Add assignee"
                >
                  <Plus size={14} />
                </button>
              </div>

              <AnimatePresence>
                {showAssigneeDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute z-[60] left-0 right-0 mt-1 bg-obsidian border border-white/10 ares-cut-sm shadow-2xl max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10"
                  >
                    {teamMembers.map((m: { id: string; nickname?: string | null; name?: string | null }) => (
                      <button
                        key={m.id}
                        onClick={() => toggleAssignee(m.id)}
                        className={`w-full text-left px-3 py-2 text-xs font-bold transition-all flex items-center justify-between ${
                          assigneeIds.includes(m.id) 
                            ? "bg-ares-cyan/10 text-ares-cyan" 
                            : "text-marble hover:bg-white/5"
                        }`}
                      >
                        {m.nickname || m.name}
                        {assigneeIds.includes(m.id) && <CheckCircle2 size={12} />}
                      </button>
                    ))}
                    {teamMembers.length === 0 && (
                      <div className="p-3 text-xs text-ares-gray italic text-center">No team members found</div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div>
              <label htmlFor="modal-due-date" className="text-[10px] font-black text-ares-gray uppercase tracking-widest mb-1.5 block">
                <Calendar size={10} className="inline mr-1" />
                Due Date
                {isOverdue && (
                  <span className="ml-1.5 text-ares-red text-[9px] uppercase font-black">Overdue</span>
                )}
              </label>
              <input
                id="modal-due-date"
                title="Due Date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={`w-full bg-ares-gray-dark/50 border text-sm px-3 py-2.5 ares-cut-sm outline-none transition-colors ${
                  isOverdue
                    ? "border-ares-red/40 text-ares-red focus:border-ares-red/60"
                    : "border-white/10 text-white focus:border-ares-cyan/50"
                }`}
              />
            </div>
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-4 text-[10px] text-ares-gray font-mono border-t border-white/5 pt-4">
            <span>Created {new Date(task.created_at).toLocaleDateString()}</span>
            {task.creator_name && <span>by {task.creator_name}</span>}
            <span>Updated {new Date(task.updated_at).toLocaleDateString()}</span>
          </div>

          {/* Task Discussion Thread */}
          <div className="border-t border-white/5 pt-4">
            <ZulipThreadViewer stream="kanban" topic={task.title} label="Task Discussion" />
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-between p-5 border-t border-white/5 bg-obsidian">
          <div>
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-ares-red font-bold">Confirm?</span>
                <button
                  onClick={() => { onDelete(task.id); onClose(); }}
                  className="px-3 py-1.5 bg-ares-red/20 hover:bg-ares-red/30 text-ares-red text-xs font-bold ares-cut-sm border border-ares-red/30"
                >
                  Yes, Delete
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
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-marble text-xs font-bold ares-cut-sm border border-white/5"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !title.trim()}
              className="px-4 py-2 bg-ares-cyan/20 hover:bg-ares-cyan/30 text-ares-cyan text-xs font-bold ares-cut-sm border border-ares-cyan/30 flex items-center gap-2 disabled:opacity-30 transition-all"
            >
              <Save size={14} />
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
