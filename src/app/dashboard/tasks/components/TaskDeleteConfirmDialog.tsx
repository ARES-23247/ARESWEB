import { useEffect, useId, useRef } from "react";
import type { TaskItem } from "@/types/task";

interface TaskDeleteConfirmDialogProps {
  task: TaskItem;
  deleteSubmitting: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}

export default function TaskDeleteConfirmDialog({
  task,
  deleteSubmitting,
  onConfirmDelete,
  onCancelDelete,
}: TaskDeleteConfirmDialogProps) {
  const deleteTitleId = useId();
  const deleteDescriptionId = useId();
  const deleteCancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    deleteCancelRef.current?.focus();
  }, []);

  return (
    <section
      role="alertdialog"
      aria-labelledby={deleteTitleId}
      aria-describedby={deleteDescriptionId}
      className="mx-6 mb-3 border border-ares-red bg-ares-red/10 p-4 text-sm text-white"
    >
      <h4 id={deleteTitleId} className="font-bold">
        Delete this task card?
      </h4>
      <p id={deleteDescriptionId} className="mt-1 text-marble/80">
        This removes <span className="font-semibold text-white">{task.title}</span> from the
        active board. A coach or administrator can recover archived task data.
      </p>
      <p className="mt-2 font-mono text-xs text-marble/80">Task ID: {task.id}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onConfirmDelete}
          disabled={deleteSubmitting}
          className="rounded bg-ares-red px-3 py-2 text-xs font-bold text-white hover:bg-ares-bronze disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
        >
          {deleteSubmitting ? "Deleting…" : "Confirm delete"}
        </button>
        <button
          ref={deleteCancelRef}
          type="button"
          onClick={onCancelDelete}
          disabled={deleteSubmitting}
          className="rounded border border-marble/40 px-3 py-2 text-xs font-semibold text-marble hover:border-white hover:text-white disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
        >
          Keep task
        </button>
      </div>
    </section>
  );
}
