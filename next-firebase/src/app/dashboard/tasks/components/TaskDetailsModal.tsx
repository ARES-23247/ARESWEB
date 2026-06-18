import React, { useEffect, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Trash2 } from "lucide-react";
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
      }).catch((err) => console.error("Zulip notification failed:", err));

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
      <div className="flex justify-between items-center px-6 py-4 border-b border-white/5 bg-black/20 shrink-0">
        <div>
          <span className="text-[9px] font-mono text-marble/40 uppercase tracking-widest block mb-0.5">Task ID: {task.id}</span>
          <input
            type="text"
            value={modalTitle}
            onChange={(e) => setModalTitle(e.target.value)}
            className="bg-transparent border-none text-white text-lg font-bold p-0 focus:outline-none focus:ring-0 max-w-lg w-full placeholder:text-marble/30"
            placeholder="Task Title"
            disabled={!canEdit}
          />
        </div>
        <button onClick={onClose} className="text-marble/40 hover:text-white transition-colors cursor-pointer text-xl p-1">
          &times;
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent">
        <div className="lg:col-span-2 space-y-6">
          <div>
            <label htmlFor="modal-desc" className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">
              Description
            </label>
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
            <h4 className="text-xs font-bold text-ares-gold uppercase tracking-wider">
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

          <TaskCommentsSection task={task} canEdit={canEdit} user={user} teamProfiles={teamProfiles} />
        </div>

        <div className="space-y-5 bg-black/10 p-4 rounded-xl border border-white/5 h-fit">
          <div>
            <label htmlFor="modal-status" className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Status</label>
            <select
              id="modal-status"
              value={modalStatus}
              onChange={(e) => setModalStatus(e.target.value as any)}
              className="w-full bg-black/60 border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-ares-red transition-colors cursor-pointer"
              disabled={!canEdit}
            >
              <option value="todo">📋 To Do</option>
              <option value="in_progress">⚙️ In Progress</option>
              <option value="review">👀 In Review</option>
              <option value="completed">✅ Completed</option>
            </select>
          </div>

          <div>
            <label htmlFor="modal-subteam" className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Subteam</label>
            <select
              id="modal-subteam"
              value={modalSubteam}
              onChange={(e) => setModalSubteam(e.target.value as any)}
              className="w-full bg-black/60 border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-ares-red transition-colors cursor-pointer"
              disabled={!canEdit}
            >
              <option value="software">Software</option>
              <option value="hardware">Hardware</option>
              <option value="business">Business</option>
              <option value="outreach">Outreach</option>
            </select>
          </div>

          <div>
            <label htmlFor="modal-priority" className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Priority</label>
            <select
              id="modal-priority"
              value={modalPriority}
              onChange={(e) => setModalPriority(e.target.value as any)}
              className="w-full bg-black/60 border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-ares-red transition-colors cursor-pointer"
              disabled={!canEdit}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">
              Assignees ({modalAssignees.length})
            </label>
            <div className="bg-black/40 border border-white/10 rounded p-2.5 max-h-36 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent">
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

          {canEdit && (
            <div className="pt-3 border-t border-white/5 space-y-2">
              <button
                onClick={handleSave}
                className="w-full bg-ares-red hover:bg-ares-red-dark text-white text-xs font-bold py-2 px-3 rounded transition-colors cursor-pointer"
              >
                Save Changes
              </button>
              <button
                onClick={() => {
                  if (confirm("Are you sure you want to delete this task card?")) {
                    onDeleteTask(task.id);
                    onClose();
                  }
                }}
                className="w-full bg-black/40 hover:bg-ares-red/10 border border-white/10 hover:border-ares-red/35 text-marble/60 hover:text-ares-red text-xs font-bold py-2 px-3 rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 size={12} /> Delete Card
              </button>
            </div>
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
      <div ref={modalRef} tabIndex={-1} className="relative w-full max-w-4xl bg-obsidian border border-white/10 ares-cut-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden focus:outline-none">
        {renderInnerContent()}
      </div>
    </div>
  );
}
