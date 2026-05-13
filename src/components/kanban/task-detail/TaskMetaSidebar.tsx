import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  User, Calendar, Clock, AlertTriangle, Plus, X,
  CheckCircle2, Tag,
} from "lucide-react";
import { useGetUsers, type UpdateTaskRequest } from "../../../api";
import { KANBAN_SUBTEAMS } from "../../command/ProjectBoardKanban";
import ZulipThread from "../../ZulipThread";
import { STATUS_OPTIONS, PRIORITY_OPTIONS, GLOBAL_LABELS, type TaskItem } from "./constants";

interface TaskMetaSidebarProps {
  task: TaskItem;
  status: string;
  setStatus: (s: string) => void;
  priority: string;
  setPriority: (p: string) => void;
  subteam: string;
  setSubteam: (s: string) => void;
  assigneeIds: string[];
  setAssigneeIds: React.Dispatch<React.SetStateAction<string[]>>;
  dueDate: string;
  setDueDate: (d: string) => void;
  timeSpentSeconds: number;
  setTimeSpentSeconds: (t: number) => void;
  labelIds: string[];
  setLabelIds: React.Dispatch<React.SetStateAction<string[]>>;
  onSave: (id: string, updates: UpdateTaskRequest) => Promise<void>;
}

export function TaskMetaSidebar({
  task,
  status, setStatus,
  priority, setPriority,
  subteam, setSubteam,
  assigneeIds, setAssigneeIds,
  dueDate, setDueDate,
  timeSpentSeconds, setTimeSpentSeconds,
  labelIds, setLabelIds,
  onSave,
}: TaskMetaSidebarProps) {
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const labelDropdownRef = useRef<HTMLDivElement>(null);

  const { data: usersData } = useGetUsers({ limit: 100 });
  const teamMembers = usersData?.users ?? [];
  const currentAssignees = teamMembers.filter((m) => assigneeIds.includes(m.id));

  const isOverdue = dueDate && new Date(dueDate) < new Date() && status !== "done";

  const toggleAssignee = (id: string) => {
    setAssigneeIds(prev =>
      prev.includes(id) ? prev.filter(uid => uid !== id) : [...prev, id]
    );
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowAssigneeDropdown(false);
      }
      if (labelDropdownRef.current && !labelDropdownRef.current.contains(event.target as Node)) {
        setShowLabelDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="w-full lg:w-96 flex flex-col shrink-0 bg-black/20 overflow-y-auto custom-scrollbar">
      <div className="p-6 space-y-6 flex flex-col">
        {/* Status */}
        <div>
          <span className="text-[10px] font-black text-ares-gray uppercase tracking-widest mb-1.5 block">Status</span>
          <div className="grid grid-cols-2 gap-1.5">
            {STATUS_OPTIONS.map(opt => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  onClick={() => setStatus(opt.value)}
                  className={`flex items-center gap-1.5 px-2.5 py-2 text-xs font-bold ares-cut-sm transition-all ${
                    status === opt.value
                      ? "bg-white/10 border border-white/20 text-white shadow-inner"
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

        {/* Priority */}
        <div>
          <span className="text-[10px] font-black text-ares-gray uppercase tracking-widest mb-1.5 block">Priority</span>
          <div className="grid grid-cols-2 gap-1.5">
            {PRIORITY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setPriority(opt.value)}
                className={`px-2.5 py-2 text-xs font-bold ares-cut-sm transition-all ${
                  priority === opt.value
                    ? `${opt.color} border border-white/20 shadow-inner`
                    : "bg-ares-gray-dark/30 border border-white/5 text-ares-gray hover:text-white hover:bg-white/5"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Labels */}
        <div className="relative" ref={labelDropdownRef}>
          <span className="text-[10px] font-black text-ares-gray uppercase tracking-widest mb-1.5 flex items-center gap-1">
            <Tag size={10} /> Labels
          </span>

          <div className="flex flex-wrap gap-1.5 p-2 bg-ares-gray-dark/50 border border-white/10 ares-cut-sm min-h-[42px] content-start">
            {labelIds.map(labelId => {
              const label = GLOBAL_LABELS.find(l => l.id === labelId) || task.labels?.find(l => l.id === labelId);
              if (!label) return null;
              return (
                <span key={label.id} className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black ares-cut-sm uppercase tracking-wider border ${label.colorTheme}`}>
                  {label.name}
                  <button onClick={() => setLabelIds(labelIds.filter(id => id !== label.id))} className="opacity-70 hover:opacity-100 transition-opacity" title="Remove Label">
                    <X size={10} />
                  </button>
                </span>
              );
            })}
            <button
              onClick={() => setShowLabelDropdown(!showLabelDropdown)}
              className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-ares-gray hover:text-white transition-all ml-auto"
              title="Add label"
            >
              <Plus size={14} />
            </button>
          </div>

          <AnimatePresence>
            {showLabelDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute z-[60] left-0 right-0 mt-1 bg-obsidian border border-white/10 ares-cut-sm shadow-2xl max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10"
              >
                {GLOBAL_LABELS.map(label => (
                  <button
                    key={label.id}
                    onClick={() => {
                      if (labelIds.includes(label.id)) {
                        setLabelIds(labelIds.filter(id => id !== label.id));
                      } else {
                        setLabelIds([...labelIds, label.id]);
                      }
                    }}
                    className={`w-full text-left px-3 py-2 text-xs font-bold transition-all flex items-center justify-between hover:bg-white/5 ${labelIds.includes(label.id) ? "bg-white/5" : ""}`}
                  >
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black ares-cut-sm uppercase tracking-wider border ${label.colorTheme}`}>
                      {label.name}
                    </span>
                    {labelIds.includes(label.id) && <CheckCircle2 size={12} className="text-white" />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Subteam */}
        <div>
          <span className="text-[10px] font-black text-ares-gray uppercase tracking-widest mb-1.5 block">Subteam</span>
          <select
            value={subteam}
            onChange={(e) => setSubteam(e.target.value)}
            className="w-full bg-ares-gray-dark/50 border border-white/10 text-white text-sm px-3 py-2.5 ares-cut-sm outline-none focus:border-ares-cyan/50 transition-colors"
          >
            <option value="">No Subteam</option>
            {KANBAN_SUBTEAMS.map(team => (
              <option key={team} value={team}>{team}</option>
            ))}
          </select>
        </div>

        {/* Assignees */}
        <div className="relative" ref={dropdownRef}>
          <label className="text-[10px] font-black text-ares-gray uppercase tracking-widest mb-1.5 flex items-center gap-1">
            <User size={10} /> Assignees ({assigneeIds.length})
          </label>

          <div className="flex flex-wrap gap-1.5 p-2 bg-ares-gray-dark/50 border border-white/10 ares-cut-sm min-h-[42px] content-start">
            {currentAssignees.map((m) => (
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
                {teamMembers.map((m) => (
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="modal-start-date" className="text-[10px] font-black text-ares-gray uppercase tracking-widest mb-1.5 block">
              <Calendar size={10} className="inline mr-1" /> Start Date
            </label>
            <input
              id="modal-start-date"
              title="Start Date"
              type="date"
              value={task.startDate || ""}
              onChange={(e) => onSave(task.id, { startDate: e.target.value })}
              className="w-full bg-ares-gray-dark/50 border border-white/10 text-white text-sm px-3 py-2.5 ares-cut-sm outline-none focus:border-ares-cyan/50 transition-colors"
            />
          </div>
          <div>
            <label htmlFor="modal-due-date" className="text-[10px] font-black text-ares-gray uppercase tracking-widest mb-1.5 block">
              <Calendar size={10} className="inline mr-1" /> Due Date
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

        {/* Time & Estimates */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <div className="text-[10px] font-black text-ares-gray uppercase tracking-widest mb-1.5 block">
              <Clock size={10} className="inline mr-1 text-ares-gold" /> Time Logged
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                placeholder="HH"
                value={Math.floor(timeSpentSeconds / 3600) || ""}
                onChange={(e) => {
                  const h = parseInt(e.target.value) || 0;
                  const m = Math.floor((timeSpentSeconds % 3600) / 60);
                  setTimeSpentSeconds(h * 3600 + m * 60);
                }}
                className="w-16 bg-ares-gray-dark/50 border border-white/10 text-white text-sm px-2 py-2 ares-cut-sm outline-none focus:border-ares-gold/50 text-center transition-colors"
              />
              <span className="text-ares-gray font-bold">:</span>
              <input
                type="number"
                min="0"
                max="59"
                placeholder="MM"
                value={Math.floor((timeSpentSeconds % 3600) / 60) || ""}
                onChange={(e) => {
                  const h = Math.floor(timeSpentSeconds / 3600);
                  const m = parseInt(e.target.value) || 0;
                  setTimeSpentSeconds(h * 3600 + m * 60);
                }}
                className="w-16 bg-ares-gray-dark/50 border border-white/10 text-white text-sm px-2 py-2 ares-cut-sm outline-none focus:border-ares-gold/50 text-center transition-colors"
              />
            </div>
          </div>
          <div>
            <div className="text-[10px] font-black text-ares-gray uppercase tracking-widest mb-1.5 block">
              <AlertTriangle size={10} className="inline mr-1 text-ares-gray" /> Estimate (Min)
            </div>
            <input
              type="number"
              min="0"
              placeholder="Total Minutes"
              value={task.estimatedMinutes || ""}
              onChange={(e) => onSave(task.id, { estimatedMinutes: parseInt(e.target.value) || undefined })}
              className="w-full bg-ares-gray-dark/50 border border-white/10 text-white text-sm px-3 py-2 ares-cut-sm outline-none focus:border-white/30 transition-colors"
            />
          </div>
        </div>

        {/* Zulip Thread */}
        <div className="flex-1 min-h-[400px] border-t border-white/5 bg-obsidian flex flex-col">
          <div className="flex-1 overflow-hidden">
            <ZulipThread
              stream={task.zulipStream || "kanban"}
              topic={task.zulipTopic || `Task: ${task.title}`}
              className="m-0 border-none bg-transparent shadow-none max-h-none h-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
