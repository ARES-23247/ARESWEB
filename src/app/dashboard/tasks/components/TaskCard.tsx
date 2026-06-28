import React from "react";
import { Archive, CheckSquare, MessageSquare } from "lucide-react";

import { SubTask, TaskComment, TaskItem, MemberProfile } from "@/types/task";
export type { SubTask, TaskComment, TaskItem, MemberProfile };

interface TaskCardProps {
  task: TaskItem;
  canEdit: boolean;
  draggingTaskId: string | null;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDragEnd: () => void;
  onEditTask: (taskId: string) => void;
  onArchiveTask: (taskId: string, archive: boolean) => void;
  teamProfiles: MemberProfile[];
}

export default function TaskCard({
  task,
  canEdit,
  draggingTaskId,
  onDragStart,
  onDragEnd,
  onEditTask,
  onArchiveTask,
  teamProfiles,
}: TaskCardProps) {
  const totalSub = task.subtasks?.length || 0;
  const doneSub = task.subtasks?.filter((s) => s.done).length || 0;
  const progressPercent = totalSub > 0 ? (doneSub / totalSub) * 100 : 0;
  const commentsCount = task.commentsCount ?? (task.comments?.length || 0);

  return (
    <div
      draggable={canEdit}
      onDragStart={(e) => onDragStart(e, task.id)}
      onDragEnd={onDragEnd}
      tabIndex={0}
      role="button"
      aria-label={`Task: ${task.title}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEditTask(task.id);
        }
      }}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (
          target.closest("button") ||
          target.closest("select") ||
          target.closest("input") ||
          target.closest("a") ||
          target.closest("form")
        ) {
          return;
        }
        onEditTask(task.id);
      }}
      className={`bg-black/35 border border-white/5 ares-cut p-4.5 transition-all duration-200 hover:border-ares-red hover:-translate-y-0.5 shadow-sm flex flex-col justify-between gap-4 cursor-grab active:cursor-grabbing text-left ${
        draggingTaskId === task.id ? "opacity-30 border-dashed border-white/20" : ""
      }`}
    >
      <div className={draggingTaskId ? "pointer-events-none" : ""}>
        {/* Card tags */}
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[9px] bg-white/5 border border-white/10 px-2 py-0.5 rounded font-black uppercase tracking-wider text-marble/80">
              {task.subteam}
            </span>
            {task.archived && (
              <span className="text-[9px] bg-ares-gold/20 border border-ares-gold/30 px-2 py-0.5 rounded font-black uppercase tracking-wider text-ares-gold animate-pulse">
                Archived
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {task.status === "completed" && canEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onArchiveTask(task.id, !task.archived);
                }}
                title={task.archived ? "Restore Task" : "Archive Task"}
                className="text-marble/55 hover:text-ares-gold transition-colors p-1 cursor-pointer bg-white/5 hover:bg-white/10 rounded border border-white/10 hover:border-ares-gold/30 flex items-center justify-center shrink-0"
              >
                <Archive size={10} />
              </button>
            )}
            <span
              className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${
                task.priority === "high"
                  ? "bg-ares-gold/20 text-ares-gold border-ares-gold/30"
                  : task.priority === "medium"
                  ? "bg-ares-cyan/10 text-ares-cyan border-ares-cyan/20"
                  : "bg-ares-success/10 text-ares-success border-ares-success/20"
              }`}
            >
              {task.priority}
            </span>
          </div>
        </div>

        <h4 className="font-bold text-white leading-snug mb-2 font-heading text-sm hover:text-ares-gold transition-colors">
          {task.title}
        </h4>
        <p className="text-marble/60 text-[11px] leading-relaxed mb-4 line-clamp-3">
          {task.description || "No description provided."}
        </p>

        {/* Subtasks Progress stats */}
        {totalSub > 0 && (
          <div className="mb-2 bg-black/45 p-3 rounded-lg border border-white/5 space-y-2">
            <div className="flex justify-between items-center text-[9px] font-bold text-marble/55 uppercase tracking-wider">
              <span className="flex items-center gap-1">
                <CheckSquare size={10} className="text-ares-gold" /> Subtasks
              </span>
              <span>
                {doneSub}/{totalSub}
              </span>
            </div>
            <div className="w-full bg-black/60 h-1.5 rounded-full overflow-hidden border border-white/5">
              <div
                className="bg-ares-red h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Card Footer Details */}
      <div className="border-t border-white/5 pt-3 flex justify-between items-center gap-2 mt-auto text-[10px]">
        {/* Assignees visual stack */}
        <div className="flex -space-x-1.5 overflow-hidden">
          {task.assignees?.slice(0, 4).map((uid) => {
            const profile = teamProfiles.find((p) => p.uid === uid);
            const avatar = profile?.avatar || `https://api.dicebear.com/9.x/bottts/svg?seed=${uid}`;
            const name = profile?.nickname || "Team Member";
            return (
              <img
                key={uid}
                className="inline-block h-5 w-5 rounded-full ring-1 ring-black bg-black object-contain shrink-0"
                src={avatar}
                alt={name}
                title={name}
              />
            );
          })}
          {task.assignees && task.assignees.length > 4 && (
            <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-white/5 border border-white/10 text-white font-bold text-[8px] z-10">
              +{task.assignees.length - 4}
            </span>
          )}
        </div>

        {/* Comments count indicator */}
        {commentsCount > 0 && (
          <span className="flex items-center gap-1.5 text-[10px] font-black text-marble/45 uppercase tracking-wider">
            <MessageSquare size={11} className="text-ares-gold" /> {commentsCount}
          </span>
        )}
      </div>
    </div>
  );
}
