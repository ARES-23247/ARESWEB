import React, { useState } from "react";
import {
  ChevronDown, User, Edit3, GripVertical, Trash2
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
}

export function SortableTaskCard({
  task, onDelete, onUpdateStatus, onEdit,
}: SortableTaskCardProps) {
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
      {...({ style } as React.HTMLAttributes<HTMLDivElement>)}
      className="p-2.5 bg-obsidian/60 hover:bg-ares-gray-dark/60 ares-cut-sm border border-white/5 hover:border-white/10 transition-all group relative flex gap-2"
    >
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
            className="text-sm font-bold text-white leading-tight flex-1 text-left hover:text-ares-cyan transition-colors flex items-center gap-1.5 group/title"
          >
          {task.title}
          <Edit3 size={10} className="text-ares-gray opacity-0 group-hover/title:opacity-100 transition-opacity flex-shrink-0" />
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
            <span className={`text-[9px] font-mono ${task.due_date && new Date(task.due_date) < new Date() && task.status !== "done" ? "text-ares-red font-black" : "text-ares-gray"}`}>
              {new Date(task.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              {task.due_date && new Date(task.due_date) < new Date() && task.status !== "done" && " ⚠"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
