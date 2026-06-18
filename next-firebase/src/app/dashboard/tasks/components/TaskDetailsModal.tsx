import React, { useEffect, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Trash2, Archive, X } from "lucide-react";
import { authenticatedFetch } from "@/lib/api";
import { Drawer } from "vaul";
import { useFocusTrap } from "@/lib/useFocusTrap";
import MarkdownEditor from "@/components/MarkdownEditor";
import TaskCommentsSection, { MemberProfile, TaskItem } from "./TaskCommentsSection";

interface TaskDetailsModalProps {
  taskId: string;
  tasks: TaskItem[];
  teamProfiles: MemberProfile[];
  canEdit: boolean;
  user: any;
  onClose: () => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => Promise<void>;
  onDeleteSubtask: (taskId: string, subtaskId: string) => Promise<void>;
  onAddSubtask: (taskId: string, title: string) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onArchiveTask: (taskId: string, isArchived: boolean) => Promise<void>;
  setSyncState?: (state: "idle" | "syncing" | "success" | "error") => void;
}

export default function TaskDetailsModal({
  taskId,
  tasks,
  teamProfiles,
  canEdit,
  user,
  onClose,
  onToggleSubtask,
  onDeleteSubtask,
  onAddSubtask,
  onDeleteTask,
  onArchiveTask,
  setSyncState,
}: TaskDetailsModalProps) {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return null;

  const [modalTitle, setModalTitle] = useState(task.title);
  const [modalDesc, setModalDesc] = useState(task.description);
  const [modalPriority, setModalPriority] = useState(task.priority);
  const [modalSubteam, setModalSubteam] = useState(task.subteam);
  const [modalStatus, setModalStatus] = useState(task.status);
  const [modalAssignees, setModalAssignees] = useState<string[]>(task.assignees || []);
  const [submitting, setSubmitting] = useState(false);
  const [newSubTitle, setNewSubTitle] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const modalRef = useFocusTrap(!isMobile, onClose);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    setModalTitle(task.title);
    setModalDesc(task.description);
    setModalPriority(task.priority);
    setModalSubteam(task.subteam);
    setModalStatus(task.status);
    setModalAssignees(task.assignees || []);
  }, [task.id, task.title, task.description, task.priority, task.subteam, task.status, task.assignees]);

  const handleSave = async () => {
    if (!canEdit || submitting) return;
    setSubmitting(true);
    try {
      const taskRef = doc(db, "tasks", task.id);
      await updateDoc(taskRef, {
        title: modalTitle.trim(),
        description: modalDesc.trim(),
        priority: modalPriority,
        subteam: modalSubteam,
        status: modalStatus,
        assignees: modalAssignees,
      });

      if (setSyncState) setSyncState("syncing");
      authenticatedFetch("/api/tasks/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.id,
          action: "update",
          title: modalTitle.trim(),
          priority: modalPriority,
          subteam: modalSubteam,
          status: modalStatus,
        }),
      }).then((res) => {
        if (res.ok) {
          if (setSyncState) setSyncState("success");
        } else {
          if (setSyncState) setSyncState("error");
        }
        setTimeout(() => {
          if (setSyncState) setSyncState("idle");
        }, 3000);
      }).catch((err) => {
        console.error("Zulip notification failed:", err);
        if (setSyncState) setSyncState("error");
        setTimeout(() => {
          if (setSyncState) setSyncState("idle");
        }, 3000);
      });

      onClose();
    } catch (e) {
      console.error("Failed to update task", e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddSub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubTitle.trim() || !canEdit) return;
    await onAddSubtask(task.id, newSubTitle.trim());
    setNewSubTitle("");
  };

  const renderInnerContent = () => (
    <>
      <div className="flex justify-between items-center px-6 py-4 border-b border-white/5 shrink-0">
        <div>
          <h3 className="text-lg font-black text-white uppercase tracking-tight font-heading flex items-center gap-2">
            Edit Task Details
          </h3>
          <span className="text-[8px] font-mono text-marble/40 uppercase tracking-widest block mt-0.5">Task ID: {task.id}</span>
        </div>
        <button onClick={onClose} className="text-marble/55 hover:text-white cursor-pointer transition-colors p-1" aria-label="Close dialog">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent">
        <div>
          <label htmlFor="modal-title" className="block text-[10px] font-black uppercase tracking-wider mb-1.5 text-marble/60">Task Title</label>
          <input
            id="modal-title"
            type="text"
            required
            value={modalTitle}
            onChange={(e) => setModalTitle(e.target.value)}
            placeholder="Task Title"
            disabled={!canEdit}
            className="w-full bg-black/35 border border-white/10 rounded-lg px-3.5 py-2 text-xs text-white outline-none focus:border-ares-red"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="modal-status" className="block text-[10px] font-black uppercase tracking-wider mb-1.5 text-marble/60">Status</label>
            <select
              id="modal-status"
              value={modalStatus}
              onChange={(e) => setModalStatus(e.target.value as any)}
              className="w-full bg-black/35 border border-white/10 rounded-lg px-3.5 py-2 text-xs text-white outline-none focus:border-ares-red cursor-pointer"
              disabled={!canEdit}
            >
              <option value="todo">📋 To Do</option>
              <option value="in_progress">⚙️ In Progress</option>
              <option value="review">👀 In Review</option>
              <option value="completed">✅ Completed</option>
            </select>
          </div>

          <div>
            <label htmlFor="modal-subteam" className="block text-[10px] font-black uppercase tracking-wider mb-1.5 text-marble/60">Subteam</label>
            <select
              id="modal-subteam"
              value={modalSubteam}
              onChange={(e) => setModalSubteam(e.target.value as any)}
              className="w-full bg-black/35 border border-white/10 rounded-lg px-3.5 py-2 text-xs text-white outline-none focus:border-ares-red cursor-pointer"
              disabled={!canEdit}
            >
              <option value="software">Software</option>
              <option value="hardware">Hardware</option>
              <option value="business">Business</option>
              <option value="outreach">Outreach</option>
            </select>
          </div>

          <div>
            <label htmlFor="modal-priority" className="block text-[10px] font-black uppercase tracking-wider mb-1.5 text-marble/60">Priority</label>
            <select
              id="modal-priority"
              value={modalPriority}
              onChange={(e) => setModalPriority(e.target.value as any)}
              className="w-full bg-black/35 border border-white/10 rounded-lg px-3.5 py-2 text-xs text-white outline-none focus:border-ares-red cursor-pointer"
              disabled={!canEdit}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase tracking-wider mb-1.5 text-marble/60">
            Assignees ({modalAssignees.length})
          </label>
          <div className="bg-black/35 border border-white/10 rounded-lg p-3 max-h-36 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent">
            {teamProfiles.map((member) => {
              const isAssigned = modalAssignees.includes(member.uid);
              return (
                <label
                  key={member.uid}
                  className="flex items-center gap-2 text-xs text-marble/80 cursor-pointer select-none hover:text-white"
                >
                  <input
                    type="checkbox"
                    checked={isAssigned}
                    disabled={!canEdit}
                    onChange={() => {
                      if (isAssigned) {
                        setModalAssignees(modalAssignees.filter((uid) => uid !== member.uid));
                      } else {
                        setModalAssignees([...modalAssignees, member.uid]);
                      }
                    }}
                    className="rounded bg-black border-white/25 text-ares-red focus:ring-0 focus:ring-offset-0 disabled:opacity-50"
                  />
                  <img src={member.avatar} alt={member.nickname} className="w-4 h-4 rounded-full object-contain shrink-0 bg-black/50" />
                  <span className="truncate">{member.nickname}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div>
          <label htmlFor="modal-desc" className="block text-[10px] font-black uppercase tracking-wider mb-1.5 text-marble/60">Description</label>
          <MarkdownEditor
            id="modal-desc"
            value={modalDesc}
            onChange={setModalDesc}
            placeholder="Detail technical requirements, subsystem specs, etc..."
            className="h-32"
            disabled={!canEdit}
          />
        </div>

        <div className="bg-black/20 p-4 rounded-xl border border-white/5 space-y-4">
          <h4 className="text-xs font-black text-ares-gold uppercase tracking-wider">
            Subtasks Checklist
          </h4>

          {task.subtasks?.length > 0 ? (
            <div className="space-y-2">
              {task.subtasks.map((sub) => (
                <div key={sub.id} className="flex justify-between items-center group/sub">
                  <label className="flex items-center gap-2.5 text-xs text-marble/80 cursor-pointer select-none hover:text-white">
                    <input
                      type="checkbox"
                      checked={sub.done}
                      disabled={!canEdit}
                      onChange={() => onToggleSubtask(task.id, sub.id)}
                      className="rounded bg-black border-white/25 text-ares-red focus:ring-0 focus:ring-offset-0 disabled:opacity-50"
                    />
                    <span className={sub.done ? "line-through text-marble/40" : ""}>
                      {sub.title}
                    </span>
                  </label>
                  {canEdit && (
                    <button
                      onClick={() => onDeleteSubtask(task.id, sub.id)}
                      className="opacity-0 group-hover/sub:opacity-100 text-marble/40 hover:text-ares-red transition-all cursor-pointer p-0.5"
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
              <input
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

        <TaskCommentsSection task={task} canEdit={canEdit} user={user} teamProfiles={teamProfiles} setSyncState={setSyncState} />
      </div>

      <div className="flex justify-between items-center p-6 border-t border-white/5 shrink-0">
        {canEdit ? (
          <button
            type="button"
            onClick={() => {
              if (confirm("Are you sure you want to delete this task card?")) {
                onDeleteTask(task.id);
                onClose();
              }
            }}
            className="px-3 py-2 border border-white/10 hover:border-ares-red/30 hover:bg-ares-red/10 text-marble/60 hover:text-ares-red rounded font-black text-[10px] uppercase tracking-wider cursor-pointer flex items-center gap-1.5 transition-all duration-200"
          >
            <Trash2 size={12} /> Delete Card
          </button>
        ) : (
          <div />
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-white/10 hover:bg-white/5 rounded text-marble/70 hover:text-white font-black text-[10px] uppercase tracking-wider cursor-pointer transition-colors"
          >
            Cancel
          </button>
          
          {canEdit && (task.status === "completed" || task.archived) && (
            <button
              type="button"
              onClick={async () => {
                await onArchiveTask(task.id, !task.archived);
                onClose();
              }}
              className="px-4 py-2 border border-ares-gold/30 hover:bg-ares-gold/10 text-ares-gold rounded font-black text-[10px] uppercase tracking-wider cursor-pointer transition-all flex items-center gap-1.5"
            >
              <Archive size={12} /> {task.archived ? "Restore" : "Archive"}
            </button>
          )}

          {canEdit && (
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 bg-ares-red hover:bg-ares-red-dark text-white rounded font-black text-[10px] uppercase tracking-wider ares-cut-sm cursor-pointer shadow disabled:opacity-50 transition-colors"
            >
              Save Changes
            </button>
          )}
        </div>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <Drawer.Root open={true} onOpenChange={(open) => !open && onClose()}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" />
          <Drawer.Content className="bg-obsidian border-t border-white/10 flex flex-col rounded-t-[20px] max-h-[92vh] fixed bottom-0 left-0 right-0 z-50 focus:outline-none overflow-hidden">
            <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-white/20 my-4" />
            {renderInnerContent()}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div ref={modalRef} tabIndex={-1} className="glass-card relative w-full max-w-2xl bg-obsidian border border-white/10 ares-cut-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden focus:outline-none">
        {renderInnerContent()}
      </div>
    </div>
  );
}
