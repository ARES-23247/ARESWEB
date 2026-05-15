import React, { useState } from "react";
import {
  ChevronDown, Edit3, GripVertical, Trash2, ListTodo, Paperclip, Layers
} from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { TaskItem } from "../ProjectBoardKanban";
import { COLUMNS, statusConfig, priorityBadge } from "../ProjectBoardKanban";

interface SortableTaskCardProps {
  task: TaskItem;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onEdit: (task: TaskItem) => void;
  subtasksCount?: number;
  completedSubtasksCount?: number;
}

export function SortableTaskCard({
  task, onDelete, onUpdateStatus, onEdit, subtasksCount = 0, completedSubtasksCount = 0,
}: SortableTaskCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: String(task.id) });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const _currentAssignees = task.assignees || [];

  return (
    <div
      ref={setNodeRef}
      {...({ style } as React.HTMLAttributes<HTMLDivElement>)}
      data-testid="task-card"
      className="p-3.5 bg-black/60 hover:bg-black/80 ares-cut-sm border border-white/5 hover:border-ares-cyan/30 transition-all group relative flex gap-3 shadow-lg hover:shadow-ares-cyan/10 overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-1 h-0 bg-ares-cyan group-hover:h-full transition-all duration-300"></div>
      <button 
        {...attributes}
        {...listeners}
        type="button"
        aria-roledescription="sortable"
        aria-label={`Drag ${task.title}`}
        className="text-white/20 hover:text-white cursor-grab active:cursor-grabbing flex items-start pt-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan focus-visible:text-ares-cyan"
      >
        <GripVertical size={14} />
      </button>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(task); }}
            className="text-[11px] font-black uppercase tracking-[0.1em] text-white leading-tight flex-1 text-left hover:text-ares-cyan transition-colors flex items-start gap-2 group/title"
          >
          <span className="flex-1">{task.title}</span>
          <Edit3 size={10} className="text-marble/20 opacity-0 group-hover/title:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
        </button>
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
              {COLUMNS.filter((s: string) => s !== (task.status || "todo").replace("-", "_")).map((s: string) => (
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
                onClick={(e) => { e.stopPropagation(); onEdit(task); setShowMenu(false); }}
                className="w-full text-left px-3 py-1.5 text-xs font-bold text-marble/80 hover:bg-white/5 hover:text-white flex items-center gap-1.5"
              >
                <Edit3 size={10} /> Edit
              </button>
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
      
      {/* Labels */}
      {task.labels && task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {task.labels.map(l => (
            <span key={l.id} className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-widest border ares-cut-sm shadow-sm ${l.colorTheme || "border-white/5 bg-white/[0.02] text-marble/40"}`}>
              {l.name}
            </span>
          ))}
        </div>
      )}

      {/* Attachments, Checklists & Subtasks */}
      {(task.checklists?.length || task.attachments?.length || subtasksCount > 0) ? (
        <div className="flex items-center gap-3 mb-3 text-[9px] font-black uppercase tracking-[0.2em]">
          {subtasksCount > 0 && (
            <span className={`flex items-center gap-1.5 px-1.5 py-0.5 ares-cut-sm border ${completedSubtasksCount === subtasksCount ? 'bg-ares-cyan/10 text-ares-cyan border-ares-cyan/20' : 'bg-white/5 text-marble/20 border-white/5'}`}>
              <Layers size={10} /> 
              {completedSubtasksCount}/{subtasksCount}
            </span>
          )}
          {task.checklists && task.checklists.length > 0 && (
            <span className={`flex items-center gap-1.5 px-1.5 py-0.5 ares-cut-sm border ${task.checklists.every(c => c.isCompleted === 1) ? 'bg-ares-cyan/10 text-ares-cyan border-ares-cyan/20' : 'bg-white/5 text-marble/20 border-white/5'}`}>
              <ListTodo size={10} /> 
              {task.checklists.filter(c => c.isCompleted === 1).length}/{task.checklists.length}
            </span>
          )}
          {task.attachments && task.attachments.length > 0 && (
            <span className="flex items-center gap-1.5 px-1.5 py-0.5 ares-cut-sm border bg-white/5 text-marble/20 border-white/5">
              <Paperclip size={10} />
              {task.attachments.length}
            </span>
          )}
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 flex-wrap">
          {task.priority !== "normal" && (
            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${priorityBadge[task.priority || "normal"] || priorityBadge.normal}`}>
              {task.priority}
            </span>
          )}
          {task.assignees && task.assignees.length > 0 ? (
            <div className="flex -space-x-2 shrink-0">
              {task.assignees?.map((a) => (
                <div 
                  key={a.id} 
                  className="w-5 h-5 ares-cut-sm bg-black border border-ares-cyan/40 flex items-center justify-center text-[8px] font-black text-ares-cyan shadow-lg"
                  title={a.nickname || "Anonymous"}
                >
                  {a.nickname?.charAt(0).toUpperCase() || "?"}
                </div>
              ))}
            </div>
          ) : null}
        </div>
          {task.dueDate && (
            <span className={`text-[9px] font-mono ${task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "done" ? "text-ares-red font-black" : "text-ares-gray"}`}>
              {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              {task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "done" && " ⚠"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
