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
    <div className="flex flex-col gap-4 mt-8 border-t border-white/5 pt-8">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-black text-marble/20 uppercase tracking-[0.3em] flex items-center gap-3">
          <div className="w-6 h-px bg-marble/10"></div>
          <Layers size={12} className="text-ares-cyan" /> Subtasks
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
                className="flex items-center justify-between p-4 border border-white/5 bg-black/40 hover:bg-white/[0.05] ares-cut-sm transition-all group w-full text-left shadow-lg shadow-black/20"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <button 
                    onClick={(e) => toggleStatus(e, st)}
                    className="flex-shrink-0 text-marble/20 hover:text-ares-cyan transition-all"
                    title={st.status === "done" ? "Mark as Todo" : "Mark as Done"}
                  >
                    {st.status === "done" ? <CheckCircle2 size={18} className="text-ares-gold" /> : <Circle size={18} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => onTaskClick?.(st)}
                    className={`text-[11px] text-left flex-1 font-bold uppercase tracking-widest group-hover:text-ares-cyan transition-all truncate cursor-pointer outline-none ${st.status === "done" ? "text-marble/20 line-through" : "text-white"}`}
                  >
                    {st.title}
                  </button>
                </div>
                <span className="text-[9px] font-bold text-marble/20 uppercase tracking-[0.2em] ml-4 flex-shrink-0 border-l border-white/5 pl-4">{st.status}</span>
              </div>
            ))}
          </div>
        )}
        <form
          className="flex items-center gap-3 mt-4"
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
            placeholder="Add a subtask..."
            className="flex-1 bg-black/60 border border-white/5 text-white text-[11px] font-bold uppercase tracking-widest px-4 py-3.5 ares-cut-sm outline-none focus:border-ares-cyan/30 transition-all shadow-inner"
          />
          <button
            type="submit"
            className="bg-ares-cyan hover:bg-ares-cyan/90 text-black px-6 py-3.5 ares-cut-sm font-bold uppercase tracking-[0.2em] text-[10px] flex items-center justify-center transition-all disabled:opacity-30 shadow-lg shadow-ares-cyan/10 active:scale-95"
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
