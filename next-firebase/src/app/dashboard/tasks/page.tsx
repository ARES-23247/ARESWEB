"use client";

import React, { useEffect, useState } from "react";
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Plus, Trash2, Shield, Activity, MessageSquare, CheckSquare } from "lucide-react";
import { authenticatedFetch } from "@/lib/api";
import { Drawer } from "vaul";

interface TaskComment {
  id: string;
  author: string;
  content: string;
  createdAt: string;
  source: "web" | "zulip";
}

interface SubTask {
  id: string;
  title: string;
  done: boolean;
}

interface TaskItem {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "review" | "completed";
  priority: "low" | "medium" | "high";
  subteam: "software" | "hardware" | "business" | "outreach";
  assignees: string[];
  subtasks: SubTask[];
  createdAt: string;
  comments?: TaskComment[];
}

interface MemberProfile {
  uid: string;
  email?: string;
  nickname: string;
  avatar: string;
}

const MOCK_TASKS: TaskItem[] = [
  {
    id: "task_1",
    title: "Calibrate Mecanum kS Friction Feedforward",
    description: "Run systematic motor sweeps to calibrate feedforward voltage deadbands at low velocity.",
    status: "in_progress",
    priority: "high",
    subteam: "software",
    assignees: ["lead_programmer"],
    subtasks: [
      { id: "sub_1", title: "Run friction sweep script", done: true },
      { id: "sub_2", title: "Apply 0.05 kS compensation in FtcMecanumRobot.kt", done: false }
    ],
    createdAt: new Date().toISOString()
  },
  {
    id: "task_2",
    title: "Assemble Compliant Intake Flywheels",
    description: "3D print and mount compliant wheels to the main hex shaft assembly for intake testing.",
    status: "todo",
    priority: "medium",
    subteam: "hardware",
    assignees: ["mechanic_lead"],
    subtasks: [
      { id: "sub_3", title: "3D print TPU compliant wheels", done: true },
      { id: "sub_4", title: "Mount hex shaft to side plates", done: false }
    ],
    createdAt: new Date().toISOString()
  },
  {
    id: "task_3",
    title: "Sponsorship Outreach Pamphlets",
    description: "Design and print marketing pamphlets detailing ARES 23247 FIRST® achievements.",
    status: "review",
    priority: "high",
    subteam: "business",
    assignees: ["coach_david"],
    subtasks: [
      { id: "sub_5", title: "Compile World Championship recap data", done: true },
      { id: "sub_6", title: "Review pamphlet layouts with advisors", done: false }
    ],
    createdAt: new Date().toISOString()
  }
];

function TaskCommentsSection({ task, canEdit, user }: { task: TaskItem; canEdit: boolean; user: any }) {
  const [expanded, setExpanded] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submitting || !canEdit) return;

    setSubmitting(true);
    const commentPayload = {
      id: `comment_${Date.now()}`,
      author: user?.displayName || user?.email || "Web User",
      content: newComment.trim(),
      createdAt: new Date().toISOString(),
      source: "web" as const,
    };

    try {
      const taskRef = doc(db, "tasks", task.id);
      const updatedComments = [...(task.comments || []), commentPayload];
      await updateDoc(taskRef, { comments: updatedComments });
      setNewComment("");

      // Forward to Zulip stream
      await authenticatedFetch("/api/tasks/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.id,
          title: task.title,
          author: commentPayload.author,
          content: commentPayload.content,
        }),
      });
    } catch (err) {
      console.error("Failed to add comment:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const commentsCount = task.comments?.length || 0;

  return (
    <div className="mt-4 border-t border-white/5 pt-4">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-marble/55 hover:text-white transition-colors cursor-pointer"
      >
        <MessageSquare size={14} className="text-ares-gold" />
        <span>Discussion ({commentsCount})</span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {commentsCount > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-2 pr-1.5 scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent">
              {task.comments?.map((comment) => (
                <div key={comment.id} className="text-[11px] bg-black/45 p-2.5 rounded-lg border border-white/5">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="font-extrabold text-white">{comment.author}</span>
                    <span className="text-marble/30 text-[9px] flex items-center gap-1">
                      {comment.source === "zulip" && (
                        <span className="text-ares-gold font-bold tracking-wider">[ZULIP]</span>
                      )}
                      {new Date(comment.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-marble/75 leading-relaxed break-words">{comment.content}</p>
                </div>
              ))}
            </div>
          )}

          {canEdit && (
            <form onSubmit={handlePostComment} className="flex gap-1.5 mt-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Post reply to Zulip..."
                className="flex-grow bg-black/60 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-ares-red transition-colors placeholder:text-marble/30"
                required
                disabled={submitting}
              />
              <button
                type="submit"
                disabled={submitting || !newComment.trim()}
                className="bg-ares-red hover:bg-ares-red-dark text-white px-3 py-1.5 rounded transition-all text-xs font-bold cursor-pointer disabled:opacity-50 shrink-0"
              >
                Send
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

function TaskDetailsModal({
  taskId,
  tasks,
  teamProfiles,
  canEdit,
  user,
  onClose,
  onToggleSubtask,
  onDeleteSubtask,
  onAddSubtask,
  onDeleteTask
}: {
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
}) {
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
        assignees: modalAssignees
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
          status: modalStatus
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
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">
              Description
            </label>
            <textarea
              value={modalDesc}
              onChange={(e) => setModalDesc(e.target.value)}
              placeholder="Detail technical requirements, subsystem specs, etc..."
              className="w-full bg-black/60 border border-white/10 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-ares-red h-32 transition-colors placeholder:text-marble/30"
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

          <TaskCommentsSection task={task} canEdit={canEdit} user={user} />
        </div>

        <div className="space-y-5 bg-black/10 p-4 rounded-xl border border-white/5 h-fit">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Status</label>
            <select
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
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Subteam</label>
            <select
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
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Priority</label>
            <select
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
      <div className="relative w-full max-w-4xl bg-obsidian border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {renderInnerContent()}
      </div>
    </div>
  );
}

export default function KanbanPage() {
  const { user, authorizedUser } = useAuth();
  const [tasks, setTasks] = useState<TaskItem[]>(MOCK_TASKS);
  const [teamProfiles, setTeamProfiles] = useState<MemberProfile[]>([]);
  const [filterSubteam, setFilterSubteam] = useState<string>("all");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskSubteam, setNewTaskSubteam] = useState<"software" | "hardware" | "business" | "outreach">("software");
  const [newTaskPriority, setNewTaskPriority] = useState<"low" | "medium" | "high">("medium");
  const [isLive, setIsLive] = useState(false);

  const [draggedOverCol, setDraggedOverCol] = useState<string | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const canEdit = !!(user && authorizedUser && authorizedUser.role !== "unverified");

  useEffect(() => {
    try {
      const tasksRef = collection(db, "tasks");
      const unsubscribe = onSnapshot(
        tasksRef,
        (snapshot) => {
          if (snapshot.empty) {
            setTasks(MOCK_TASKS);
            setIsLive(false);
            return;
          }
          const list = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              title: data.title || "Untitled Task",
              description: data.description || "",
              status: data.status || "todo",
              priority: data.priority || "medium",
              subteam: data.subteam || "software",
              assignees: data.assignees || [],
              subtasks: data.subtasks || [],
              createdAt: data.createdAt || new Date().toISOString(),
              comments: data.comments || []
            } as TaskItem;
          });
          setTasks(list);
          setIsLive(true);
        },
        (err) => {
          console.warn("Firestore not connected, using fallback mock task board.", err.message);
          setTasks(MOCK_TASKS);
          setIsLive(false);
        }
      );
      return () => unsubscribe();
    } catch (e) {
      console.warn("Local sandbox mode, using static mock task cards.", e);
      setTasks(MOCK_TASKS);
      setIsLive(false);
    }
  }, []);

  useEffect(() => {
    try {
      const profilesRef = collection(db, "user_profiles");
      const unsubscribe = onSnapshot(profilesRef, (snapshot) => {
        const list = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            uid: doc.id,
            email: data.email || "",
            nickname: data.nickname || data.firstName || data.displayName || "Team Member",
            avatar: data.avatar || `https://api.dicebear.com/9.x/bottts/svg?seed=${doc.id}`
          };
        });
        setTeamProfiles(list);
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn("Failed to listen to user_profiles collection:", e);
    }
  }, []);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    if (!canEdit) return;

    const taskId = `task_${Date.now()}`;
    const newTask: TaskItem = {
      id: taskId,
      title: newTaskTitle.trim(),
      description: newTaskDesc.trim(),
      status: "todo",
      priority: newTaskPriority,
      subteam: newTaskSubteam,
      assignees: [user?.uid || "anonymous"],
      subtasks: [],
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, "tasks", taskId), newTask);
      setNewTaskTitle("");
      setNewTaskDesc("");

      authenticatedFetch("/api/tasks/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          action: "create",
          title: newTask.title,
          description: newTask.description,
          priority: newTask.priority,
          subteam: newTask.subteam,
        }),
      }).catch((err) => console.error("Zulip notification failed:", err));
    } catch (err) {
      console.warn("Unable to save task online, updating local UI array.", err);
      setTasks([newTask, ...tasks]);
    }
  };

  const handleMoveStatus = async (taskId: string, newStatus: TaskItem["status"]) => {
    if (!canEdit) return;
    const task = tasks.find((t) => t.id === taskId);
    try {
      const taskRef = doc(db, "tasks", taskId);
      await updateDoc(taskRef, { status: newStatus });

      if (task) {
        authenticatedFetch("/api/tasks/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId,
            action: "move",
            title: task.title,
            status: newStatus,
          }),
        }).catch((err) => console.error("Zulip notification failed:", err));
      }
    } catch (err) {
      console.warn("Firestore offline, moving card locally.", err);
      setTasks(tasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
    }
  };

  const handleToggleSubtask = async (taskId: string, subtaskId: string) => {
    if (!canEdit) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const updatedSubtasks = task.subtasks.map((sub) =>
      sub.id === subtaskId ? { ...sub, done: !sub.done } : sub
    );

    try {
      const taskRef = doc(db, "tasks", taskId);
      await updateDoc(taskRef, { subtasks: updatedSubtasks });
    } catch (err) {
      console.warn("Firestore offline, toggling subtask locally.", err);
      setTasks(tasks.map((t) => (t.id === taskId ? { ...t, subtasks: updatedSubtasks } : t)));
    }
  };

  const handleDeleteSubtask = async (taskId: string, subtaskId: string) => {
    if (!canEdit) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const updatedSubtasks = task.subtasks.filter((sub) => sub.id !== subtaskId);

    try {
      const taskRef = doc(db, "tasks", taskId);
      await updateDoc(taskRef, { subtasks: updatedSubtasks });
    } catch (err) {
      console.warn("Firestore offline, deleting subtask locally.", err);
      setTasks(tasks.map((t) => (t.id === taskId ? { ...t, subtasks: updatedSubtasks } : t)));
    }
  };

  const handleAddSubtaskDirect = async (taskId: string, title: string) => {
    if (!title.trim() || !canEdit) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const newSub: SubTask = {
      id: `sub_${Date.now()}`,
      title: title.trim(),
      done: false
    };
    const updatedSubtasks = [...(task.subtasks || []), newSub];

    try {
      const taskRef = doc(db, "tasks", taskId);
      await updateDoc(taskRef, { subtasks: updatedSubtasks });
    } catch (err) {
      console.warn("Firestore offline, adding subtask locally.", err);
      setTasks(tasks.map((t) => (t.id === taskId ? { ...t, subtasks: updatedSubtasks } : t)));
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!canEdit) return;
    try {
      await deleteDoc(doc(db, "tasks", taskId));
    } catch (err) {
      console.warn("Firestore offline, deleting card locally.", err);
      setTasks(tasks.filter((t) => t.id !== taskId));
    }
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("text/plain", taskId);
    setDraggingTaskId(taskId);
  };

  const handleDragEnd = () => {
    setDraggingTaskId(null);
    setDraggedOverCol(null);
  };

  const handleDrop = async (e: React.DragEvent, newStatus: TaskItem["status"]) => {
    e.preventDefault();
    setDraggedOverCol(null);
    setDraggingTaskId(null);
    const taskId = e.dataTransfer.getData("text/plain");
    if (!taskId) return;
    await handleMoveStatus(taskId, newStatus);
  };

  const filteredTasks = tasks.filter(
    (t) => filterSubteam === "all" || t.subteam === filterSubteam
  );

  const columns: { id: TaskItem["status"]; title: string; emoji: string }[] = [
    { id: "todo", title: "To Do", emoji: "📋" },
    { id: "in_progress", title: "In Progress", emoji: "⚙️" },
    { id: "review", title: "In Review", emoji: "👀" },
    { id: "completed", title: "Completed", emoji: "✅" }
  ];

  return (
    <div className="space-y-10 w-full">
      {/* Header */}
      <header className="border-b border-white/5 pb-8 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div>
          <p className="text-ares-gold font-bold uppercase tracking-widest text-xs mb-3 font-heading flex items-center gap-2">
            <Activity size={12} className="animate-pulse" /> Operational Workspace
          </p>
          <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter font-heading flex flex-wrap items-center gap-3">
            Kanban Tasks
            {isLive ? (
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400 ring-1 ring-inset ring-emerald-500/30 ml-2">
                ● Live Sync
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-ares-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-ares-gold ring-1 ring-inset ring-ares-gold/30 ml-2">
                ● Offline Mode
              </span>
            )}
          </h1>
          <p className="text-marble/70 text-sm mt-2 max-w-2xl font-medium">
            Collaborative subteam Kanban dashboard. Create cards, assign responsibilities, and update status blocks in real-time.
          </p>
        </div>

        {/* Subteam Filters */}
        <div className="flex flex-wrap gap-1.5 bg-black/45 p-1.5 rounded-lg border border-white/5 shrink-0">
          {["all", "software", "hardware", "business", "outreach"].map((st) => (
            <button
              key={st}
              onClick={() => setFilterSubteam(st)}
              className={`px-3 py-1.5 text-[10px] font-black uppercase rounded transition-all duration-200 cursor-pointer ${
                filterSubteam === st
                  ? "bg-ares-red text-white shadow-md"
                  : "text-marble/75 hover:text-white"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </header>

      {/* Create Task Form */}
      {canEdit ? (
        <form onSubmit={handleCreateTask} className="glass-card hero-card text-marble mb-12 max-w-3xl mx-auto p-8 space-y-6 border border-white/10">
          <h3 className="text-lg font-bold border-b border-white/5 pb-3 text-ares-gold flex items-center gap-2 font-heading uppercase tracking-tight">
            <Plus size={18} /> Create New Task Card
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Title</label>
              <input
                type="text"
                placeholder="e.g. Calibrate pinpoint pod parameters"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red transition-colors"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Subteam</label>
                <select
                  value={newTaskSubteam}
                  onChange={(e) => setNewTaskSubteam(e.target.value as any)}
                  className="w-full bg-black/60 border border-white/10 rounded px-3 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red transition-colors"
                >
                  <option value="software">Software</option>
                  <option value="hardware">Hardware</option>
                  <option value="business">Business</option>
                  <option value="outreach">Outreach</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Priority</label>
                <select
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value as any)}
                  className="w-full bg-black/60 border border-white/10 rounded px-3 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red transition-colors"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Description</label>
            <textarea
              placeholder="Detail technical calibration thresholds, subsystem specs, etc..."
              value={newTaskDesc}
              onChange={(e) => setNewTaskDesc(e.target.value)}
              className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red h-24 transition-colors"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="clipped-button-sm bg-ares-red text-white hover:bg-ares-red-dark transition-all cursor-pointer text-xs"
            >
              Add Task Card
            </button>
          </div>
        </form>
      ) : (
        <div className="glass-card ares-cut border border-ares-bronze/20 text-marble/80 px-6 py-5 rounded-xl text-center text-xs font-semibold max-w-lg mx-auto mb-12 flex items-center gap-3 justify-center">
          <Shield size={16} className="text-ares-gold shrink-0" />
          <span>🔒 Guest View Mode: Please request developer clearance to manage task cards.</span>
        </div>
      )}

      {/* Board Columns Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        {columns.map((col) => {
          const colTasks = filteredTasks.filter((t) => t.status === col.id);

          return (
            <div
              key={col.id}
              className="glass-card p-5 border border-white/10 min-h-[550px] flex flex-col rounded-2xl bg-black/10"
            >
              <h3 className="font-extrabold text-base text-white border-b border-white/5 pb-4 mb-4 flex items-center justify-between font-heading uppercase tracking-tight">
                <span className="flex items-center gap-2">
                  <span className="text-lg">{col.emoji}</span> {col.title}
                </span>
                <span className="bg-ares-red/20 border border-ares-red/35 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full">
                  {colTasks.length}
                </span>
              </h3>

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, col.id)}
                onDragEnter={() => setDraggedOverCol(col.id)}
                onDragLeave={() => setDraggedOverCol(null)}
                className={`space-y-4 flex-1 transition-all duration-300 ${
                  draggedOverCol === col.id ? "bg-white/5 border border-dashed border-ares-red/20 rounded-xl p-2" : ""
                }`}
              >
                {colTasks.map((task) => {
                  const totalSub = task.subtasks?.length || 0;
                  const doneSub = task.subtasks?.filter((s) => s.done).length || 0;
                  const progressPercent = totalSub > 0 ? (doneSub / totalSub) * 100 : 0;
                  const commentsCount = task.comments?.length || 0;

                  return (
                    <div
                      key={task.id}
                      draggable={canEdit}
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDragEnd={handleDragEnd}
                      onClick={(e) => {
                        const target = e.target as HTMLElement;
                        if (
                          target.closest("button") ||
                          target.closest("select") ||
                          target.closest("input") ||
                          target.closest("a") ||
                          target.closest("form")
                        ) {
                          return;
                        }
                        setEditingTaskId(task.id);
                      }}
                      className={`bg-black/35 border border-white/5 rounded-xl p-4.5 transition-all duration-200 hover:border-ares-red hover:-translate-y-0.5 shadow-sm flex flex-col justify-between gap-4 cursor-grab active:cursor-grabbing ${
                        draggingTaskId === task.id ? "opacity-30 border-dashed border-white/20" : ""
                      }`}
                    >
                      <div className={draggingTaskId ? "pointer-events-none" : ""}>
                        {/* Card tags */}
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-[9px] bg-white/5 border border-white/10 px-2 py-0.5 rounded font-black uppercase tracking-wider text-marble/80">
                            {task.subteam}
                          </span>
                          <span
                            className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${
                              task.priority === "high"
                                ? "bg-ares-gold/20 text-ares-gold border-ares-gold/30"
                                : task.priority === "medium"
                                ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            }`}
                          >
                            {task.priority}
                          </span>
                        </div>

                        <h4 className="font-bold text-white leading-snug mb-2 font-heading text-sm hover:text-ares-gold transition-colors">
                          {task.title}
                        </h4>
                        <p className="text-marble/60 text-[11px] leading-relaxed mb-4 line-clamp-3">
                          {task.description || "No description provided."}
                        </p>

                        {/* Subtasks Progress stats */}
                        {totalSub > 0 && (
                          <div className="mb-2 bg-black/45 p-3 rounded-lg border border-white/5 space-y-2">
                            <div className="flex justify-between items-center text-[9px] font-bold text-marble/55 uppercase tracking-wider">
                              <span className="flex items-center gap-1">
                                <CheckSquare size={10} className="text-ares-gold" /> Subtasks
                              </span>
                              <span>
                                {doneSub}/{totalSub}
                              </span>
                            </div>
                            <div className="w-full bg-black/60 h-1.5 rounded-full overflow-hidden border border-white/5">
                              <div
                                className="bg-ares-red h-full rounded-full transition-all duration-300"
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Card Footer Details */}
                      <div className="border-t border-white/5 pt-3 flex justify-between items-center gap-2 mt-auto text-[10px]">
                        {/* Assignees visual stack */}
                        <div className="flex -space-x-1.5 overflow-hidden">
                          {task.assignees?.slice(0, 4).map((uid) => {
                            const profile = teamProfiles.find((p) => p.uid === uid);
                            const avatar = profile?.avatar || `https://api.dicebear.com/9.x/bottts/svg?seed=${uid}`;
                            const name = profile?.nickname || "Team Member";
                            return (
                              <img
                                key={uid}
                                className="inline-block h-5 w-5 rounded-full ring-1 ring-black bg-black object-contain shrink-0"
                                src={avatar}
                                alt={name}
                                title={name}
                              />
                            );
                          })}
                          {task.assignees && task.assignees.length > 4 && (
                            <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-white/5 border border-white/10 text-white font-bold text-[8px] z-10">
                              +{task.assignees.length - 4}
                            </span>
                          )}
                        </div>

                        {/* Comments count indicator */}
                        {commentsCount > 0 && (
                          <span className="flex items-center gap-1.5 text-[10px] font-black text-marble/45 uppercase tracking-wider">
                            <MessageSquare size={11} className="text-ares-gold" /> {commentsCount}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Details Modal */}
      {editingTaskId && (
        <TaskDetailsModal
          taskId={editingTaskId}
          tasks={tasks}
          teamProfiles={teamProfiles}
          canEdit={canEdit}
          user={user}
          onClose={() => setEditingTaskId(null)}
          onToggleSubtask={handleToggleSubtask}
          onDeleteSubtask={handleDeleteSubtask}
          onAddSubtask={handleAddSubtaskDirect}
          onDeleteTask={handleDeleteTask}
        />
      )}
    </div>
  );
}
