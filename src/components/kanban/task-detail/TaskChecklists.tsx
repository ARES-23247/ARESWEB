import { useState } from "react";
import { ListTodo, Plus, X, CheckCircle2 } from "lucide-react";
import { useCreateTaskChecklist, useUpdateTaskChecklist, useDeleteTaskChecklist } from "../../../api";
import { toastApiError } from "../../../api/honoClient";
import type { TaskItem } from "./constants";

interface TaskChecklistsProps {
  task: TaskItem;
}

export function TaskChecklists({ task }: TaskChecklistsProps) {
  const [newChecklist, setNewChecklist] = useState("");

  const createChecklistMutation = useCreateTaskChecklist({ onError: (err: unknown) => toastApiError(err) });
  const updateChecklistMutation = useUpdateTaskChecklist({ onError: (err: unknown) => toastApiError(err) });
  const deleteChecklistMutation = useDeleteTaskChecklist({ onError: (err: unknown) => toastApiError(err) });

  return (
    <div className="flex flex-col gap-3 mt-6 border-t border-white/5 pt-6">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold text-ares-gray uppercase tracking-widest flex items-center gap-2">
          <ListTodo size={14} className="text-ares-cyan" /> Checklists
        </div>
        {task.checklists && task.checklists.length > 0 && (
          <div className="text-xs text-ares-gray font-bold">
            {Math.round((task.checklists.filter(c => c.isCompleted === 1).length / task.checklists.length) * 100)}%
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {task.checklists?.sort((a, b) => a.sortOrder - b.sortOrder).map(c => (
          <div key={c.id} className="flex items-center gap-3 group">
            <button
              onClick={() => updateChecklistMutation.mutate({ id: task.id, checklistId: c.id, updates: { isCompleted: c.isCompleted === 1 ? 0 : 1 } })}
              className={`flex-shrink-0 w-4 h-4 rounded-sm border flex items-center justify-center transition-colors ${c.isCompleted === 1 ? "bg-ares-cyan border-ares-cyan text-black" : "border-white/20 hover:border-ares-cyan"}`}
            >
              {c.isCompleted === 1 ? <CheckCircle2 size={12} /> : null}
            </button>
            <span className={`flex-1 text-sm ${c.isCompleted === 1 ? "text-ares-gray line-through" : "text-white"}`}>
              {c.content}
            </span>
            <button
              onClick={() => deleteChecklistMutation.mutate({ id: task.id, checklistId: c.id })}
              className="opacity-0 group-hover:opacity-100 p-1 text-ares-gray hover:text-ares-red transition-all"
            >
              <X size={14} />
            </button>
          </div>
        ))}

        <form
          className="mt-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (newChecklist.trim()) {
              await createChecklistMutation.mutateAsync({ id: task.id, content: newChecklist.trim() });
              setNewChecklist("");
            }
          }}
        >
          <div className="flex items-center gap-2 mt-1">
            <input
              type="text"
              value={newChecklist}
              onChange={(e) => setNewChecklist(e.target.value)}
              placeholder="Add an item..."
              className="flex-1 bg-black/40 border border-white/10 text-white text-sm px-3 py-2.5 ares-cut-sm outline-none focus:border-ares-cyan/50 transition-colors"
            />
            <button
              type="submit"
              className="bg-ares-cyan hover:bg-ares-cyan/80 text-black p-2.5 ares-cut-sm font-bold flex items-center justify-center transition-colors disabled:opacity-50"
              disabled={!newChecklist.trim() || createChecklistMutation.isPending}
              title="Add Checklist Item"
            >
              <Plus size={18} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
