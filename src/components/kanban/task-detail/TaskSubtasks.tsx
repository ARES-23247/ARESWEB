import { Layers, Plus, CheckCircle2, Circle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateTask, useGetTasks, useUpdateTask } from "../../../api";
import { toastApiError } from "../../../api/honoClient";
import type { TaskItem } from "./constants";

interface TaskSubtasksProps {
  task: TaskItem;
  onTaskClick?: (task: TaskItem) => void;
}

export function TaskSubtasks({ task, onTaskClick }: TaskSubtasksProps) {
  const queryClient = useQueryClient();

  const createSubtaskMutation = useCreateTask({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", "subtasks", task.id] });
    },
    onError: (err: unknown) => toastApiError(err),
  });

  const updateTaskMutation = useUpdateTask({
    onError: (err: unknown) => toastApiError(err),
  });

  const { data: subtasksData } = useGetTasks({ parentId: task.id }, { staleTime: 10000 });
  const subtasks = subtasksData?.tasks ?? [];

  const toggleStatus = (e: React.MouseEvent, st: TaskItem) => {
    e.stopPropagation();
    const newStatus = st.status === "done" ? "todo" : "done";
    updateTaskMutation.mutateAsync({ id: st.id, updates: { status: newStatus } }).catch(console.error);
  };

  return (
    <div className="flex flex-col gap-3 mt-6 border-t border-white/5 pt-6">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold text-ares-gray uppercase tracking-widest flex items-center gap-2">
          <Layers size={14} className="text-ares-cyan" /> Subtasks
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {subtasks.length === 0 ? (
          <div className="text-center p-4 border border-dashed border-white/10 ares-cut-sm bg-white/5">
            <p className="text-sm text-ares-gray">No subtasks found.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {subtasks.map((st: TaskItem) => (
              <div
                key={st.id}
                className="flex items-center justify-between p-3 border border-white/5 bg-black/40 hover:bg-white/5 ares-cut-sm transition-colors group w-full text-left"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <button 
                    onClick={(e) => toggleStatus(e, st)}
                    className="flex-shrink-0 text-ares-gray hover:text-ares-cyan transition-colors"
                    title={st.status === "done" ? "Mark as todo" : "Mark as done"}
                  >
                    {st.status === "done" ? <CheckCircle2 size={16} className="text-ares-gold" /> : <Circle size={16} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => onTaskClick?.(st)}
                    className={`text-sm text-left flex-1 font-bold group-hover:text-ares-cyan transition-colors truncate cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ares-cyan ${st.status === "done" ? "text-ares-gray line-through" : "text-white"}`}
                  >
                    {st.title}
                  </button>
                </div>
                <span className="text-xs text-ares-gray uppercase tracking-wider ml-2 flex-shrink-0">{st.status}</span>
              </div>
            ))}
          </div>
        )}
        <form
          className="flex items-center gap-2 mt-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const input = form.elements.namedItem("subtaskTitle") as HTMLInputElement;
            const title = input.value.trim();
            if (!title) return;
            input.value = "";
            input.disabled = true;
            try {
              await createSubtaskMutation.mutateAsync({ title, parentId: task.id });
            } catch (err) {
              console.error("Failed to create subtask:", err);
            } finally {
              if (input) {
                input.disabled = false;
                input.focus();
              }
            }
          }}
        >
          <input
            type="text"
            name="subtaskTitle"
            id="new-subtask-input"
            placeholder="Add a new subtask..."
            className="flex-1 bg-black/40 border border-white/10 text-white text-sm px-3 py-2.5 ares-cut-sm outline-none focus:border-ares-cyan/50 transition-colors"
          />
          <button
            type="submit"
            className="bg-ares-cyan hover:bg-ares-cyan/80 text-black p-2.5 ares-cut-sm font-bold flex items-center justify-center transition-colors disabled:opacity-50"
            disabled={createSubtaskMutation.isPending}
            title="Add Subtask"
          >
            <Plus size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
