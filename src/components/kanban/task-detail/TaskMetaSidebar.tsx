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
          <span className="text-[10px] font-bold text-marble/20 tracking-[0.3em] mb-3 flex items-center gap-2">
            <div className="w-4 h-px bg-marble/10"></div>
            Status
          </span>
          <div className="grid grid-cols-2 gap-2">
            {STATUS_OPTIONS.map(opt => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  onClick={() => setStatus(opt.value)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 text-[9px] font-bold uppercase tracking-[0.1em] ares-cut-sm transition-all border ${
                    status === opt.value
                      ? "bg-white/10 border-white/20 text-white shadow-lg shadow-white/5"
                      : "bg-white/[0.02] border-white/5 text-marble/40 hover:text-white hover:bg-white/5"
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
          <span className="text-[10px] font-bold text-marble/20 tracking-[0.3em] mb-3 flex items-center gap-2">
            <div className="w-4 h-px bg-marble/10"></div>
            Priority
          </span>
          <div className="grid grid-cols-2 gap-2">
            {PRIORITY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setPriority(opt.value)}
                className={`px-3 py-2.5 text-[9px] font-bold uppercase tracking-[0.1em] ares-cut-sm transition-all border ${
                  priority === opt.value
                    ? `${opt.color} border-white/20 shadow-lg`
                    : "bg-white/[0.02] border-white/5 text-marble/40 hover:text-white hover:bg-white/5"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Labels */}
        <div className="relative" ref={labelDropdownRef}>
          <span className="text-[10px] font-bold text-marble/20 tracking-[0.3em] mb-3 flex items-center gap-2">
            <div className="w-4 h-px bg-marble/10"></div>
            <Tag size={10} /> Labels
          </span>

          <div className="flex flex-wrap gap-2 p-3 bg-black/40 border border-white/5 ares-cut-sm min-h-[48px] content-start shadow-inner">
            {labelIds.map(labelId => {
              const label = GLOBAL_LABELS.find(l => l.id === labelId) || task.labels?.find(l => l.id === labelId);
              if (!label) return null;
              return (
                <span key={label.id} className={`inline-flex items-center gap-2 px-2.5 py-1 text-[9px] font-bold ares-cut-sm uppercase tracking-widest border shadow-sm ${label.colorTheme}`}>
                  {label.name}
                  <button onClick={() => setLabelIds(labelIds.filter(id => id !== label.id))} className="opacity-40 hover:opacity-100 transition-opacity" title="Declassify">
                    <X size={10} />
                  </button>
                </span>
              );
            })}
            <button
              onClick={() => setShowLabelDropdown(!showLabelDropdown)}
              className="inline-flex items-center justify-center w-7 h-7 ares-cut-sm bg-white/5 border border-white/10 hover:bg-ares-cyan/10 hover:text-ares-cyan hover:border-ares-cyan/30 text-marble/20 transition-all ml-auto shadow-xl"
              title="Add classification"
            >
              <Plus size={16} />
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
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold ares-cut-sm uppercase tracking-wider border ${label.colorTheme}`}>
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
          <span className="text-[10px] font-bold text-marble/20 tracking-[0.3em] mb-3 flex items-center gap-2">
            <div className="w-4 h-px bg-marble/10"></div>
            Subteam
          </span>
          <select
            value={subteam}
            onChange={(e) => setSubteam(e.target.value)}
            className="w-full bg-black/40 border border-white/5 text-white text-[11px] font-bold uppercase tracking-widest px-4 py-3 ares-cut-sm outline-none focus:border-ares-cyan/30 transition-all shadow-inner appearance-none cursor-pointer"
          >
            <option value="">Uncategorized</option>
            {KANBAN_SUBTEAMS.map(team => (
              <option key={team} value={team}>{team.toUpperCase()}</option>
            ))}
          </select>
        </div>

        {/* Assignees */}
        <div className="relative" ref={dropdownRef}>
          <label className="text-[10px] font-bold text-marble/20 tracking-[0.3em] mb-3 flex items-center gap-2">
            <div className="w-4 h-px bg-marble/10"></div>
            <User size={10} /> Assignees ({assigneeIds.length})
          </label>

          <div className="flex flex-wrap gap-2 p-3 bg-black/40 border border-white/5 ares-cut-sm min-h-[48px] content-start shadow-inner">
            {currentAssignees.map((m) => (
              <span key={m.id} className="inline-flex items-center gap-2 px-2.5 py-1 bg-ares-cyan/5 border border-ares-cyan/20 text-ares-cyan text-[9px] font-bold ares-cut-sm uppercase tracking-widest shadow-sm">
                {m.nickname || m.name}
                <button onClick={() => toggleAssignee(m.id)} className="opacity-40 hover:opacity-100 transition-opacity" title="Remove Asset">
                  <X size={10} />
                </button>
              </span>
            ))}
            <button
              onClick={() => setShowAssigneeDropdown(!showAssigneeDropdown)}
              className="inline-flex items-center justify-center w-7 h-7 ares-cut-sm bg-white/5 border border-white/10 hover:bg-ares-cyan/10 hover:text-ares-cyan hover:border-ares-cyan/30 text-marble/20 transition-all ml-auto shadow-xl"
              title="Add asset"
            >
              <Plus size={16} />
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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="modal-start-date" className="text-[10px] font-bold text-marble/20 tracking-[0.3em] mb-3 flex items-center gap-2">
              <div className="w-4 h-px bg-marble/10"></div>
              <Calendar size={10} /> Start Date
            </label>
            <input
              id="modal-start-date"
              title="Start Date"
              type="date"
              value={task.startDate || ""}
              onChange={(e) => onSave(task.id, { startDate: e.target.value })}
              className="w-full bg-black/40 border border-white/5 text-white text-[11px] font-bold uppercase tracking-widest px-4 py-3 ares-cut-sm outline-none focus:border-ares-cyan/30 transition-all shadow-inner"
            />
          </div>
          <div>
            <label htmlFor="modal-due-date" className="text-[10px] font-bold text-marble/20 tracking-[0.3em] mb-3 flex items-center gap-2">
              <div className="w-4 h-px bg-marble/10"></div>
              <Calendar size={10} /> Due Date
              {isOverdue && (
                <span className="ml-2 text-ares-red text-[8px] uppercase font-bold animate-pulse">! OVERDUE</span>
              )}
            </label>
            <input
              id="modal-due-date"
              title="Due Date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={`w-full bg-black/40 border text-[11px] font-bold uppercase tracking-widest px-4 py-3 ares-cut-sm outline-none transition-all shadow-inner ${
                isOverdue
                  ? "border-ares-red/30 text-ares-red focus:border-ares-red/50"
                  : "border-white/5 text-white focus:border-ares-cyan/30"
              }`}
            />
          </div>
        </div>

        {/* Time & Estimates */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="group/chrono">
            <div className="text-[10px] font-bold text-marble/20 tracking-[0.3em] mb-3 flex items-center gap-2 group-hover/chrono:text-ares-gold transition-colors">
              <div className="w-4 h-px bg-marble/10 group-hover/chrono:w-6 transition-all"></div>
              <Clock size={10} className="text-ares-gold" /> Time Logged
            </div>
            <div className="flex items-center gap-2 p-3 bg-black/40 border border-white/5 ares-cut-sm shadow-inner group-hover/chrono:border-ares-gold/20 transition-all">
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
                className="w-full bg-white/5 border border-white/5 text-white text-xs font-mono font-bold uppercase px-2 py-2 ares-cut-sm outline-none focus:border-ares-gold/30 text-center transition-all placeholder:text-marble/10"
              />
              <span className="text-marble/20 font-bold animate-pulse">:</span>
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
                className="w-full bg-white/5 border border-white/5 text-white text-xs font-mono font-bold uppercase px-2 py-2 ares-cut-sm outline-none focus:border-ares-gold/30 text-center transition-all placeholder:text-marble/10"
              />
            </div>
          </div>
          <div className="group/estimate">
            <div className="text-[10px] font-bold text-marble/20 tracking-[0.3em] mb-3 flex items-center gap-2 group-hover/estimate:text-ares-cyan transition-colors">
              <div className="w-4 h-px bg-marble/10 group-hover/estimate:w-6 transition-all"></div>
              <AlertTriangle size={10} className="text-marble/20 group-hover:text-ares-cyan" /> Estimated Time
            </div>
            <div className="relative">
              <input
                type="number"
                min="0"
                placeholder="000"
                value={task.estimatedMinutes || ""}
                onChange={(e) => onSave(task.id, { estimatedMinutes: parseInt(e.target.value) || undefined })}
                className="w-full bg-black/40 border border-white/5 text-white text-xs font-mono font-bold uppercase tracking-widest px-4 py-[14px] ares-cut-sm outline-none focus:border-ares-cyan/30 transition-all shadow-inner placeholder:text-marble/10 group-hover/estimate:bg-ares-cyan/5"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-bold text-marble/20 uppercase tracking-widest pointer-events-none">MIN</div>
            </div>
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
