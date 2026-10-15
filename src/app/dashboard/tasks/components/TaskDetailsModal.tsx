import { logger } from "@/utils/logger";
import { useLayoutEffect, useRef, useState } from "react";
import { doc, setDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebaseFirestore";
import {
  Trash2,
  Archive,
  X,
  Maximize2,
  Minimize2,
  Sparkles,
  AlertCircle,
  Plus,
  Link2,
} from "lucide-react";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import MarkdownEditor from "@/components/MarkdownEditor";
import TaskCommentsSection from "./TaskCommentsSection";
import { MemberProfile, TaskItem } from "@/types/task";
import TaskEditorAiCopilot from "./TaskEditorAiCopilot";
import TaskOperationErrorAlert from "./TaskOperationErrorAlert";
import TaskSubtasksSection from "./TaskSubtasksSection";
import TaskRevisionsSection from "./TaskRevisionsSection";
import TaskDeleteConfirmDialog from "./TaskDeleteConfirmDialog";
import { describeTaskError, TaskOperationError } from "../taskErrors";
import { notifyTaskZulip, type TaskSyncState } from "../utils/notifyTaskZulip";
import { getSubteamDescription } from "../utils/taskStyles";
import type { User } from "firebase/auth";

interface TaskDetailsModalProps {
  taskId: string | null;
  tasks: TaskItem[];
  teamProfiles: MemberProfile[];
  canEdit: boolean;
  canUseAi: boolean;
  user: User | null;
  onClose: () => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => Promise<TaskOperationError | null>;
  onDeleteSubtask: (taskId: string, subtaskId: string) => Promise<TaskOperationError | null>;
  onAddSubtask: (taskId: string, title: string) => Promise<TaskOperationError | null>;
  onDeleteTask: (taskId: string) => Promise<TaskOperationError | null>;
  onArchiveTask: (taskId: string, isArchived: boolean) => Promise<TaskOperationError | null>;
  onCreateTask?: (task: TaskItem) => Promise<TaskOperationError | null>;
  onNotificationError?: (error: TaskOperationError) => void;
  setSyncState?: (state: TaskSyncState) => void;
}

export default function TaskDetailsModal({
  taskId,
  tasks,
  teamProfiles,
  canEdit,
  canUseAi,
  user,
  onClose,
  onToggleSubtask,
  onDeleteSubtask,
  onAddSubtask,
  onDeleteTask,
  onArchiveTask,
  onCreateTask,
  onNotificationError,
  setSyncState,
}: TaskDetailsModalProps) {
  const task = taskId ? tasks.find((t) => t.id === taskId) : null;
  const isCreateMode = !taskId;
  const taskTitle = task?.title;
  const taskDescription = task?.description;
  const taskPriority = task?.priority;
  const taskSubteam = task?.subteam;
  const taskStatus = task?.status;
  const taskAssignees = task?.assignees;
  const taskDueDate = task?.dueDate;

  const [modalTitle, setModalTitle] = useState(task?.title || "");
  const [modalDesc, setModalDesc] = useState(task?.description || "");
  const [modalPriority, setModalPriority] = useState(task?.priority || "medium");
  const [modalSubteam, setModalSubteam] = useState(task?.subteam || "software");
  const [modalStatus, setModalStatus] = useState(task?.status || "todo");
  const [modalAssignees, setModalAssignees] = useState<string[]>(task?.assignees || []);
  const [modalDueDate, setModalDueDate] = useState(task?.dueDate || "");
  const [submitting, setSubmitting] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showAiSidebar, setShowAiSidebar] = useState(false);
  const [revertAlert, setRevertAlert] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<TaskOperationError | null>(null);
  const [titleTouched, setTitleTouched] = useState(false);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const { copied: linkCopied, copyToClipboard } = useCopyToClipboard();
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);
  const initializedTaskIdRef = useRef<string | null | undefined>(undefined);

  const cancelDeleteConfirmation = () => {
    setDeleteConfirmationOpen(false);
    queueMicrotask(() => deleteTriggerRef.current?.focus());
  };

  const modalRef = useFocusTrap(true, () => {
    if (deleteConfirmationOpen) {
      cancelDeleteConfirmation();
      return;
    }
    onClose();
  });
  const titleError = modalTitle.trim() ? null : "Enter a task title before saving.";

  // Initialize a newly selected task before the browser can accept input. A
  // passive effect could otherwise overwrite a title entered immediately
  // after the drawer becomes visible on a busy browser thread.
  useLayoutEffect(() => {
    if (taskId && !task) return;
    if (initializedTaskIdRef.current === taskId) return;
    initializedTaskIdRef.current = taskId;
    if (
      taskId &&
      taskTitle !== undefined &&
      taskDescription !== undefined &&
      taskPriority !== undefined &&
      taskSubteam !== undefined &&
      taskStatus !== undefined
    ) {
      setModalTitle(taskTitle);
      setModalDesc(taskDescription);
      setModalPriority(taskPriority);
      setModalSubteam(taskSubteam);
      setModalStatus(taskStatus);
      setModalAssignees(taskAssignees || []);
      setModalDueDate(taskDueDate || "");
    } else {
      setModalTitle("");
      setModalDesc("");
      setModalPriority("medium");
      setModalSubteam("software");
      setModalStatus("todo");
      setModalAssignees([]);
      setModalDueDate("");
    }
  }, [
    task,
    taskAssignees,
    taskDescription,
    taskDueDate,
    taskId,
    taskPriority,
    taskStatus,
    taskSubteam,
    taskTitle,
  ]);

  if (taskId && !task) return null;

  const handleSave = async () => {
    if (!canEdit || submitting) return;
    setTitleTouched(true);
    if (titleError) return;
    setSubmitting(true);
    setOperationError(null);
    try {
      if (isCreateMode) {
        const newTaskId = `task_${Date.now()}`;
        const newTaskData: TaskItem = {
          id: newTaskId,
          title: modalTitle.trim(),
          description: modalDesc.trim(),
          status: modalStatus,
          priority: modalPriority,
          subteam: modalSubteam,
          assignees:
            modalAssignees.length > 0 ? modalAssignees : user ? [user.uid] : [],
          subtasks: [],
          archived: false,
          dueDate: modalDueDate || null,
          createdAt: new Date().toISOString(),
        };

        if (onCreateTask) {
          const createError = await onCreateTask(newTaskData);
          if (createError) {
            setOperationError(createError);
            return;
          }
        } else {
          await setDoc(doc(db, "tasks", newTaskId), newTaskData);
        }

        void notifyTaskZulip(
          {
            taskId: newTaskId,
            action: "create",
            title: newTaskData.title,
            description: newTaskData.description,
            priority: newTaskData.priority,
            subteam: newTaskData.subteam,
            dueDate: newTaskData.dueDate || undefined,
          },
          { setSyncState, onNotificationError },
        );
      } else if (task) {
        const taskRef = doc(db, "tasks", task.id);
        const changedFields = (
          [
            ["title", task.title, modalTitle.trim()],
            ["description", task.description || "", modalDesc.trim()],
            ["priority", task.priority, modalPriority],
            ["subteam", task.subteam, modalSubteam],
            ["status", task.status, modalStatus],
            [
              "assignees",
              JSON.stringify(task.assignees || []),
              JSON.stringify(modalAssignees),
            ],
            ["due date", task.dueDate || "", modalDueDate || ""],
          ] as const
        )
          .filter(([, before, after]) => before !== after)
          .map(([field]) => field);

        const batch = writeBatch(db);
        batch.update(taskRef, {
          title: modalTitle.trim(),
          description: modalDesc.trim(),
          priority: modalPriority,
          subteam: modalSubteam,
          status: modalStatus,
          assignees: modalAssignees,
          dueDate: modalDueDate || null,
        });
        if (changedFields.length > 0) {
          batch.set(
            doc(
              db,
              "tasks",
              task.id,
              "revisions",
              `rev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            ),
            {
              action: "updated",
              ...(task.status !== modalStatus
                ? { from: task.status, to: modalStatus }
                : {}),
              fields: changedFields,
              actorUid: user?.uid || "unknown",
              actorName:
                teamProfiles.find((p) => p.uid === user?.uid)?.nickname ||
                "Team Member",
              createdAt: new Date().toISOString(),
            },
          );
        }
        await batch.commit();

        void notifyTaskZulip(
          {
            taskId: task.id,
            action: "move",
            title: modalTitle.trim(),
            priority: modalPriority,
            subteam: modalSubteam,
            status: modalStatus,
            dueDate: modalDueDate || undefined,
          },
          { setSyncState, onNotificationError },
        );
      }

      onClose();
    } catch (e) {
      logger.error("Failed to save task", e);
      setOperationError(
        describeTaskError(isCreateMode ? "create task" : "save task", e),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!task || deleteSubmitting) return;
    setDeleteSubmitting(true);
    setOperationError(null);
    try {
      const error = await onDeleteTask(task.id);
      setOperationError(error);
      if (!error) {
        setDeleteConfirmationOpen(false);
        onClose();
      }
    } catch (error) {
      logger.error("Failed to delete task", error);
      setOperationError(describeTaskError("delete task", error));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const renderInnerContent = () => (
    <>
      <header className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-black/20 shrink-0">
        <div>
          <h3 className="text-white font-extrabold text-lg font-heading uppercase tracking-tight flex items-center gap-2">
            {isCreateMode ? <Plus size={18} /> : null}{" "}
            {isCreateMode ? "Create New Task Card" : "Edit Task Details"}
          </h3>
          <p className="text-[10px] text-marble/60 uppercase font-bold mt-0.5">
            {isCreateMode
              ? "Populates on task boards dynamically"
              : "Synchronizes with Zulip chat stream"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Copy card link */}
          {!isCreateMode && task && (
            <button
              type="button"
              onClick={async () => {
                const url = `https://aresfirst.org/dashboard/tasks?task=${encodeURIComponent(task.id)}`;
                await copyToClipboard(url);
              }}
              title={`Card link: https://aresfirst.org/dashboard/tasks?task=${task.id}`}
              aria-label="Copy a link to this task card"
              className="h-8 px-3 rounded-lg border border-white/10 hover:border-white/25 text-marble/60 hover:text-white flex items-center gap-1.5 cursor-pointer transition-all text-[10px] font-black uppercase tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <Link2 size={11} aria-hidden="true" />
              {linkCopied ? "Copied" : "Link"}
            </button>
          )}

          {/* AI Copilot Toggle */}
          {!isCreateMode && canUseAi && (
            <button
              type="button"
              onClick={() => setShowAiSidebar(!showAiSidebar)}
              className={`h-8 px-3 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider ${
                showAiSidebar
                  ? "border-ares-cyan/30 bg-ares-cyan/10 text-ares-cyan"
                  : "border-white/10 hover:border-white/25 text-marble/60 hover:text-white"
              }`}
            >
              <Sparkles size={11} />
              {showAiSidebar ? "Hide AI" : "AI Copilot"}
            </button>
          )}

          {/* Full screen toggle */}
          <button
            type="button"
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-marble/60 hover:text-white flex items-center justify-center cursor-pointer transition-all active:scale-95 focus:ring-2 focus:ring-ares-cyan focus:outline-none"
            title={isFullScreen ? "Minimize Editor" : "Maximize Editor"}
            aria-label={isFullScreen ? "Minimize editor" : "Maximize editor"}
          >
            {isFullScreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            aria-label="Close editor"
            className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-marble/60 hover:text-white flex items-center justify-center cursor-pointer transition-all active:scale-95 focus:ring-2 focus:ring-ares-cyan focus:outline-none"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden bg-black/10 p-6 flex flex-col">
        {operationError && (
          <div className="mb-4 shrink-0">
            <TaskOperationErrorAlert
              error={operationError}
              onDismiss={() => setOperationError(null)}
            />
          </div>
        )}

        {/* Revert Alert banner */}
        {revertAlert && (
          <div className="mb-4 px-4 py-2 bg-ares-gold/10 border border-ares-gold/20 text-ares-gold text-xs font-semibold flex items-center justify-between shrink-0 rounded-lg animate-fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{revertAlert}</span>
            </div>
            <button
              onClick={() => setRevertAlert(null)}
              className="text-ares-gold hover:text-white cursor-pointer font-bold text-[10px] uppercase"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden min-h-0">
          <div
            className={`space-y-6 flex-grow overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent transition-all duration-300 ${
              !isCreateMode && showAiSidebar ? "w-full lg:max-w-[68%]" : "w-full"
            }`}
          >
            <div>
              <label
                htmlFor="modal-title"
                className="block text-[10px] font-black uppercase tracking-wider mb-1.5 text-marble/60"
              >
                Task Title
              </label>
              <input
                id="modal-title"
                type="text"
                required
                value={modalTitle}
                onChange={(e) => {
                  setModalTitle(e.target.value);
                  if (operationError) setOperationError(null);
                }}
                onBlur={() => setTitleTouched(true)}
                placeholder="Task Title"
                disabled={!canEdit}
                aria-invalid={titleTouched && !!titleError}
                aria-describedby={
                  titleTouched && titleError ? "modal-title-error" : undefined
                }
                className="w-full bg-black/35 border border-white/10 rounded-lg px-3.5 py-2 text-xs text-white outline-none focus:border-ares-red focus-visible:ring-2 focus-visible:ring-ares-cyan"
              />
              {titleTouched && titleError && (
                <p
                  id="modal-title-error"
                  className="mt-1.5 text-xs font-semibold text-white"
                  role="alert"
                >
                  <span className="mr-1 rounded bg-ares-red px-1.5 py-0.5 text-white">
                    Required
                  </span>
                  {titleError}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="modal-status"
                  className="block text-[10px] font-black uppercase tracking-wider mb-1.5 text-marble/60"
                >
                  Status
                </label>
                <select
                  id="modal-status"
                  value={modalStatus}
                  onChange={(e) =>
                    setModalStatus(e.target.value as TaskItem["status"])
                  }
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
                <label
                  htmlFor="modal-subteam"
                  className="block text-[10px] font-black uppercase tracking-wider mb-1.5 text-marble/60"
                >
                  Subteam
                </label>
                <select
                  id="modal-subteam"
                  value={modalSubteam}
                  onChange={(e) =>
                    setModalSubteam(e.target.value as TaskItem["subteam"])
                  }
                  aria-describedby="modal-subteam-hint"
                  className="w-full bg-black/35 border border-white/10 rounded-lg px-3.5 py-2 text-xs text-white outline-none focus:border-ares-red cursor-pointer"
                  disabled={!canEdit}
                >
                  <option value="software">Software</option>
                  <option value="hardware">Hardware</option>
                  <option value="business">Business</option>
                  <option value="outreach">Outreach</option>
                </select>
                <p id="modal-subteam-hint" className="mt-1.5 text-[10px] text-marble/60 leading-snug">
                  {getSubteamDescription(modalSubteam)}
                </p>
              </div>

              <div>
                <label
                  htmlFor="modal-priority"
                  className="block text-[10px] font-black uppercase tracking-wider mb-1.5 text-marble/60"
                >
                  Priority
                </label>
                <select
                  id="modal-priority"
                  value={modalPriority}
                  onChange={(e) =>
                    setModalPriority(e.target.value as TaskItem["priority"])
                  }
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
              <label
                htmlFor="modal-due-date"
                className="block text-[10px] font-black uppercase tracking-wider mb-1.5 text-marble/60"
              >
                Due Date <span className="normal-case font-medium">(optional)</span>
              </label>
              <input
                id="modal-due-date"
                type="date"
                value={modalDueDate}
                onChange={(event) => setModalDueDate(event.target.value)}
                disabled={!canEdit}
                className="w-full bg-black/35 border border-white/10 rounded-lg px-3.5 py-2 text-xs text-white outline-none focus:border-ares-red focus-visible:ring-2 focus-visible:ring-ares-cyan"
              />
              <p className="mt-1.5 text-[10px] text-marble/55">
                Uses the team member's local calendar date; no time of day is implied.
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider mb-1.5 text-marble/60">
                Assignees ({modalAssignees.length})
              </label>
              {isCreateMode && modalAssignees.length === 0 && (
                <p className="mb-2 text-[10px] text-ares-cyan/90 font-medium">
                  Tip: Leave unselected when creating a task to automatically assign it to yourself.
                </p>
              )}
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
                            setModalAssignees(
                              modalAssignees.filter(
                                (uid: string) => uid !== member.uid,
                              ),
                            );
                          } else {
                            setModalAssignees([...modalAssignees, member.uid]);
                          }
                        }}
                        className="rounded bg-black border-white/25 text-ares-red focus:ring-0 focus:ring-offset-0 disabled:opacity-50"
                      />
                      <img
                        src={member.avatar}
                        alt={member.nickname}
                        className="w-4 h-4 rounded-full object-contain shrink-0 bg-black/50"
                      />
                      <span className="truncate">{member.nickname}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label
                htmlFor="modal-desc"
                className="block text-[10px] font-black uppercase tracking-wider mb-1.5 text-marble/60"
              >
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

            {!isCreateMode && task && (
              <>
                <TaskSubtasksSection
                  task={task}
                  canEdit={canEdit}
                  onToggleSubtask={onToggleSubtask}
                  onDeleteSubtask={onDeleteSubtask}
                  onAddSubtask={onAddSubtask}
                  onOperationError={setOperationError}
                />

                {(() => {
                  const knownUids = new Set(teamProfiles.map((p) => p.uid));
                  const unknownAssignees = (task.assignees || []).filter(
                    (uid) => !knownUids.has(uid),
                  );
                  if (unknownAssignees.length === 0) return null;
                  return (
                    <div className="bg-black/20 p-3 rounded-xl border border-ares-gold/20">
                      <p className="text-[10px] font-black uppercase tracking-wider text-ares-gold mb-2">
                        Unknown assignees
                      </p>
                      <p className="text-[11px] text-marble/70 mb-2">
                        {unknownAssignees.length} assignee
                        {unknownAssignees.length === 1 ? "" : "s"} on this card no
                        longer match the team roster. Remove them below.
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {unknownAssignees.map((uid) => (
                          <button
                            key={uid}
                            type="button"
                            onClick={() =>
                              setModalAssignees(
                                modalAssignees.filter((a) => a !== uid),
                              )
                            }
                            disabled={!canEdit}
                            className="bg-ares-gold/10 border border-ares-gold/30 text-ares-gold text-[10px] font-bold px-2 py-1 rounded inline-flex items-center gap-1 cursor-pointer hover:bg-ares-gold/20 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                            aria-label={`Remove unknown assignee ${uid}`}
                          >
                            {uid} <X size={10} aria-hidden="true" />
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <TaskCommentsSection
                  task={task}
                  canEdit={canEdit}
                  user={user}
                  teamProfiles={teamProfiles}
                  setSyncState={setSyncState}
                />

                <TaskRevisionsSection taskId={task.id} />
              </>
            )}
          </div>

          {!isCreateMode && canUseAi && showAiSidebar && (
            <TaskEditorAiCopilot
              modalTitle={modalTitle}
              modalSubteam={modalSubteam}
              modalPriority={modalPriority}
              modalDesc={modalDesc}
              setModalDesc={setModalDesc}
              setRevertAlert={setRevertAlert}
            />
          )}
        </div>
      </div>

      {deleteConfirmationOpen && task && (
        <TaskDeleteConfirmDialog
          task={task}
          deleteSubmitting={deleteSubmitting}
          onConfirmDelete={handleDeleteTask}
          onCancelDelete={cancelDeleteConfirmation}
        />
      )}

      <footer className="px-6 py-4 border-t border-white/10 flex justify-between items-center bg-black/20 shrink-0">
        {canEdit && !isCreateMode && task ? (
          <button
            ref={deleteTriggerRef}
            type="button"
            onClick={() => {
              setOperationError(null);
              setDeleteConfirmationOpen(true);
            }}
            aria-expanded={deleteConfirmationOpen}
            className="px-3 py-2 border border-white/10 hover:border-ares-red hover:bg-ares-red text-marble/60 hover:text-white rounded font-black text-[10px] uppercase tracking-wider cursor-pointer flex items-center gap-1.5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
          >
            <Trash2 aria-hidden="true" size={12} /> Delete Card
          </button>
        ) : (
          <div />
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-white/10 text-white font-semibold text-xs rounded hover:bg-white/5 transition-all cursor-pointer"
          >
            Cancel
          </button>

          {canEdit &&
            !isCreateMode &&
            task &&
            (task.status === "completed" || task.archived) && (
              <button
                type="button"
                onClick={async () => {
                  const error = await onArchiveTask(task.id, !task.archived);
                  setOperationError(error);
                  if (!error) onClose();
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
              disabled={submitting || !!titleError}
              className="clipped-button-sm bg-ares-red text-white font-black uppercase tracking-widest text-[11px] py-2 px-6 transition-all hover:scale-102 active:scale-98 cursor-pointer shadow-lg disabled:opacity-50"
            >
              {submitting
                ? "Saving..."
                : isCreateMode
                  ? "Add Task Card"
                  : "Save Changes"}
            </button>
          )}
        </div>
      </footer>
    </>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-pointer"
        onClick={deleteConfirmationOpen ? cancelDeleteConfirmation : onClose}
      />

      {/* Editor Drawer container */}
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={isCreateMode ? "Create Task Card" : "Task Card Details"}
        className={`relative z-10 h-full bg-obsidian border-l border-white/10 flex flex-col justify-between shadow-2xl focus:outline-none transition-all duration-300 ${
          isFullScreen ? "w-full max-w-full" : "w-full max-w-3xl"
        }`}
      >
        {renderInnerContent()}
      </div>
    </div>
  );
}
