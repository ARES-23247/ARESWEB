import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { SubTask, TaskItem } from "@/types/task";
import type { TaskOperationError } from "../taskErrors";

interface TaskSubtasksSectionProps {
  task: TaskItem;
  canEdit: boolean;
  onToggleSubtask: (taskId: string, subtaskId: string) => Promise<TaskOperationError | null>;
  onDeleteSubtask: (taskId: string, subtaskId: string) => Promise<TaskOperationError | null>;
  onAddSubtask: (taskId: string, title: string) => Promise<TaskOperationError | null>;
  onOperationError: (error: TaskOperationError | null) => void;
}

export default function TaskSubtasksSection({
  task,
  canEdit,
  onToggleSubtask,
  onDeleteSubtask,
  onAddSubtask,
  onOperationError,
}: TaskSubtasksSectionProps) {
  const [newSubTitle, setNewSubTitle] = useState("");

  const handleAddSub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubTitle.trim() || !canEdit) return;
    const error = await onAddSubtask(task.id, newSubTitle.trim());
    if (error) {
      onOperationError(error);
      return;
    }
    onOperationError(null);
    setNewSubTitle("");
  };

  return (
    <div className="bg-black/20 p-4 rounded-xl border border-white/5 space-y-4">
      <h4 className="text-xs font-black text-ares-gold uppercase tracking-wider">
        Subtasks Checklist
      </h4>

      {task.subtasks?.length > 0 ? (
        <div className="space-y-2">
          {task.subtasks.map((sub: SubTask) => (
            <div key={sub.id} className="flex justify-between items-center group/sub">
              <label className="flex items-center gap-2.5 text-xs text-marble/80 cursor-pointer select-none hover:text-white">
                <input
                  type="checkbox"
                  checked={sub.done}
                  disabled={!canEdit}
                  onChange={async () => {
                    const error = await onToggleSubtask(task.id, sub.id);
                    onOperationError(error);
                  }}
                  className="rounded bg-black border-white/25 text-ares-red focus:ring-0 focus:ring-offset-0 disabled:opacity-50"
                />
                <span className={sub.done ? "line-through text-marble/40" : ""}>
                  {sub.title}
                </span>
              </label>
              {canEdit && (
                <button
                  type="button"
                  onClick={async () => {
                    const error = await onDeleteSubtask(task.id, sub.id);
                    onOperationError(error);
                  }}
                  aria-label={`Delete subtask: ${sub.title}`}
                  className="opacity-0 group-hover/sub:opacity-100 focus-visible:opacity-100 text-marble/40 hover:text-white transition-all cursor-pointer p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                  title="Delete subtask"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-marble/40 italic">No subtasks defined yet.</p>
      )}

      {canEdit && (
        <form onSubmit={handleAddSub} className="flex gap-1.5 pt-2">
          <label htmlFor={`new-subtask-${task.id}`} className="sr-only">
            Add a subtask to {task.title}
          </label>
          <input
            id={`new-subtask-${task.id}`}
            type="text"
            value={newSubTitle}
            onChange={(e) => setNewSubTitle(e.target.value)}
            placeholder="New subtask..."
            className="flex-grow bg-black/65 border border-white/10 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-ares-red placeholder:text-marble/30"
          />
          <button
            type="submit"
            disabled={!newSubTitle.trim()}
            className="bg-ares-gold/20 hover:bg-ares-gold/30 border border-ares-gold/30 text-ares-gold text-xs font-bold px-3 py-1.5 rounded transition-all cursor-pointer disabled:opacity-50 shrink-0"
          >
            Add
          </button>
        </form>
      )}
    </div>
  );
}
