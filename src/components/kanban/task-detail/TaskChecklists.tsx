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
    <div className="flex flex-col gap-4 mt-8 border-t border-white/5 pt-8">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-black text-marble/20 uppercase tracking-[0.3em] flex items-center gap-3">
          <div className="w-6 h-px bg-marble/10"></div>
          <ListTodo size={12} className="text-ares-cyan" /> OPERATIONAL_CHECKLIST
        </div>
        {task.checklists && task.checklists.length > 0 && (
          <div className="text-[10px] text-ares-cyan font-black tracking-widest px-2 py-1 bg-ares-cyan/5 border border-ares-cyan/20 ares-cut-sm shadow-sm">
            {Math.round((task.checklists.filter(c => c.isCompleted === 1).length / task.checklists.length) * 100)}%_COMPLETE
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {task.checklists?.sort((a, b) => a.sortOrder - b.sortOrder).map(c => (
          <div key={c.id} className="flex items-center gap-4 group/item py-1">
            <button
              onClick={() => updateChecklistMutation.mutate({ id: task.id, checklistId: c.id, updates: { isCompleted: c.isCompleted === 1 ? 0 : 1 } })}
              className={`flex-shrink-0 w-5 h-5 ares-cut-sm border flex items-center justify-center transition-all ${c.isCompleted === 1 ? "bg-ares-cyan border-ares-cyan text-black shadow-lg shadow-ares-cyan/20" : "bg-white/5 border-white/10 hover:border-ares-cyan/50 shadow-inner"}`}
            >
              {c.isCompleted === 1 ? <CheckCircle2 size={14} /> : null}
            </button>
            <span className={`flex-1 text-[11px] font-black uppercase tracking-widest transition-all ${c.isCompleted === 1 ? "text-marble/20 line-through" : "text-white"}`}>
              {c.content}
            </span>
            <button
              onClick={() => deleteChecklistMutation.mutate({ id: task.id, checklistId: c.id })}
              className="opacity-0 group-hover/item:opacity-100 p-2 text-marble/20 hover:text-ares-red transition-all ares-cut-sm hover:bg-ares-red/5"
            >
              <X size={14} />
            </button>
          </div>
        ))}

        <form
          className="mt-6"
          onSubmit={async (e) => {
            e.preventDefault();
            if (newChecklist.trim()) {
              await createChecklistMutation.mutateAsync({ id: task.id, content: newChecklist.trim() });
              setNewChecklist("");
            }
          }}
        >
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={newChecklist}
              onChange={(e) => setNewChecklist(e.target.value)}
              placeholder="EXECUTE_NEW_CHECK_ITEM..."
              className="flex-1 bg-black/60 border border-white/5 text-white text-[11px] font-black uppercase tracking-widest px-4 py-3.5 ares-cut-sm outline-none focus:border-ares-cyan/30 transition-all shadow-inner"
            />
            <button
              type="submit"
              className="bg-ares-cyan hover:bg-ares-cyan/90 text-black px-6 py-3.5 ares-cut-sm font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center transition-all disabled:opacity-30 shadow-lg shadow-ares-cyan/10 active:scale-95"
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
