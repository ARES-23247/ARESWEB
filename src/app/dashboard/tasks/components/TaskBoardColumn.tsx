import React from "react";
import TaskCard, { TaskItem, MemberProfile } from "./TaskCard";

interface TaskBoardColumnProps {
  col: { id: TaskItem["status"]; title: string; emoji: string };
  colTasks: TaskItem[];
  canEdit: boolean;
  onArchiveAllCompleted: () => void;
  onDrop: (e: React.DragEvent, status: TaskItem["status"]) => void;
  draggedOverCol: string | null;
  setDraggedOverCol: (colId: TaskItem["status"] | null) => void;
  draggingTaskId: string | null;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDragEnd: () => void;
  onEditTask: (taskId: string) => void;
  onArchiveTask: (taskId: string, archive: boolean) => void;
  teamProfiles: MemberProfile[];
}

export default function TaskBoardColumn({
  col,
  colTasks,
  canEdit,
  onArchiveAllCompleted,
  onDrop,
  draggedOverCol,
  setDraggedOverCol,
  draggingTaskId,
  onDragStart,
  onDragEnd,
  onEditTask,
  onArchiveTask,
  teamProfiles,
}: TaskBoardColumnProps) {
  return (
    <div className="glass-card p-5 border border-white/10 min-h-[550px] flex flex-col ares-cut-lg bg-black/10 text-left">
      <h3 className="font-extrabold text-base text-white border-b border-white/5 pb-4 mb-4 flex items-center justify-between font-heading uppercase tracking-tight">
        <span className="flex items-center gap-2">
          <span className="text-lg">{col.emoji}</span> {col.title}
        </span>
        <div className="flex items-center gap-2">
          {col.id === "completed" && canEdit && colTasks.filter((t) => !t.archived).length > 0 && (
            <button
              type="button"
              onClick={onArchiveAllCompleted}
              title="Archive all active completed tasks"
              className="text-[9px] bg-ares-gold/20 hover:bg-ares-gold/30 border border-ares-gold/30 text-ares-gold px-2 py-0.5 rounded transition-all cursor-pointer font-bold uppercase tracking-wider"
            >
              Archive All
            </button>
          )}
          <span className="bg-ares-red/20 border border-ares-red/35 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full">
            {colTasks.length}
          </span>
        </div>
      </h3>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => onDrop(e, col.id)}
        onDragEnter={() => setDraggedOverCol(col.id)}
        onDragLeave={() => setDraggedOverCol(null)}
        className={`space-y-4 flex-1 transition-all duration-300 ${
          draggedOverCol === col.id
            ? "bg-white/5 border border-dashed border-ares-red/20 ares-cut-lg p-2"
            : ""
        }`}
      >
        {colTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            canEdit={canEdit}
            draggingTaskId={draggingTaskId}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onEditTask={onEditTask}
            onArchiveTask={onArchiveTask}
            teamProfiles={teamProfiles}
          />
        ))}
      </div>
    </div>
  );
}
