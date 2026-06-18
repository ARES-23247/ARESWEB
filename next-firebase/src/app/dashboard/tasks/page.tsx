"use client";

import React, { useEffect, useState } from "react";
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Plus, Trash2, Shield, Activity, MessageSquare, CheckSquare, Archive } from "lucide-react";
import { authenticatedFetch } from "@/lib/api";
import TaskDetailsModal from "./components/TaskDetailsModal";
import MarkdownEditor from "@/components/MarkdownEditor";

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
  archived?: boolean;
  createdAt: string;
  comments?: TaskComment[];
  commentsCount?: number;
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

  // Operational state extensions
  const [showArchived, setShowArchived] = useState(false);
  const [newTaskAssignees, setNewTaskAssignees] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"newest" | "priority">("newest");
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "success" | "error">("idle");

  const canEdit = !!(user && authorizedUser && authorizedUser.role !== "unverified");

  const runZulipSync = async (fetchPromise: Promise<Response>) => {
    setSyncState("syncing");
    try {
      const res = await fetchPromise;
      if (res.ok) {
        setSyncState("success");
      } else {
        setSyncState("error");
      }
      setTimeout(() => setSyncState("idle"), 3000);
    } catch (err) {
      console.error("Zulip sync error:", err);
      setSyncState("error");
      setTimeout(() => setSyncState("idle"), 3000);
    }
  };

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
              archived: data.archived || false,
              createdAt: data.createdAt || new Date().toISOString(),
              commentsCount: data.commentsCount || (data.comments?.length || 0)
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
    const fetchTeamRoster = async () => {
      try {
        const response = await authenticatedFetch("/api/profiles/team-roster");
        if (!response.ok) throw new Error(`Failed to fetch team roster: ${response.status}`);
        const data = await response.json();
        setTeamProfiles(data.members || []);
      } catch (e) {
        console.warn("Failed to fetch team roster from backend:", e);
      }
    };
    fetchTeamRoster();
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
      assignees: newTaskAssignees.length > 0 ? newTaskAssignees : [user?.uid || "anonymous"],
      subtasks: [],
      archived: false,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, "tasks", taskId), newTask);
      setNewTaskTitle("");
      setNewTaskDesc("");
      setNewTaskAssignees([]);

      const syncPromise = authenticatedFetch("/api/tasks/notify", {
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
      });
      runZulipSync(syncPromise);
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
        const syncPromise = authenticatedFetch("/api/tasks/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId,
            action: "move",
            title: task.title,
            status: newStatus,
          }),
        });
        runZulipSync(syncPromise);
      }
    } catch (err) {
      console.warn("Firestore offline, moving card locally.", err);
      setTasks(tasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
    }
  };

  const handleArchiveTask = async (taskId: string, isArchived: boolean) => {
    if (!canEdit) return;
    try {
      const taskRef = doc(db, "tasks", taskId);
      await updateDoc(taskRef, { archived: isArchived });
    } catch (err) {
      console.warn("Firestore offline, archiving card locally.", err);
      setTasks(tasks.map((t) => (t.id === taskId ? { ...t, archived: isArchived } : t)));
    }
  };

  const handleArchiveAllCompleted = async () => {
    if (!canEdit) return;
    const completedTasks = tasks.filter((t) => t.status === "completed" && !t.archived);
    try {
      const promises = completedTasks.map((t) => {
        const taskRef = doc(db, "tasks", t.id);
        return updateDoc(taskRef, { archived: true });
      });
      await Promise.all(promises);
    } catch (err) {
      console.warn("Firestore offline, archiving all completed locally.", err);
      setTasks(tasks.map((t) => (t.status === "completed" ? { ...t, archived: true } : t)));
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
    (t) => (filterSubteam === "all" || t.subteam === filterSubteam) && (!t.archived || showArchived)
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
              <span className="inline-flex items-center rounded-full bg-ares-success/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-ares-success ring-1 ring-inset ring-ares-success/30 ml-2">
                ● Live Sync
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-ares-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-ares-gold ring-1 ring-inset ring-ares-gold/30 ml-2">
                ● Offline Mode
              </span>
            )}
            
            {/* Zulip synchronization states */}
            {syncState === "syncing" && (
              <span className="inline-flex items-center rounded-full bg-ares-cyan/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-ares-cyan ring-1 ring-inset ring-ares-cyan/30 ml-2 animate-pulse">
                ● Zulip Syncing...
              </span>
            )}
            {syncState === "success" && (
              <span className="inline-flex items-center rounded-full bg-ares-success/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-ares-success ring-1 ring-inset ring-ares-success/30 ml-2">
                ✓ Zulip Synced
              </span>
            )}
            {syncState === "error" && (
              <span className="inline-flex items-center rounded-full bg-ares-red/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-ares-red ring-1 ring-inset ring-ares-red/30 ml-2">
                ⚠️ Sync Error
              </span>
            )}
          </h1>
          <p className="text-marble/70 text-sm mt-2 max-w-2xl font-medium">
            Collaborative subteam Kanban dashboard. Create cards, assign responsibilities, and update status blocks in real-time.
          </p>
        </div>

        {/* Sort, Archive and Subteam Controls */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-4 items-start sm:items-center shrink-0 w-full lg:w-auto">
          {/* Sort & Archive Controls */}
          <div className="flex items-center gap-3 bg-black/45 p-1.5 rounded-lg border border-white/5 shrink-0">
            {/* Sort Dropdown */}
            <div className="flex items-center gap-2">
              <label htmlFor="board-sort" className="text-[10px] font-bold uppercase tracking-wider text-marble/55">Sort:</label>
              <select
                id="board-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-black/60 border border-white/10 rounded px-2.5 py-1 text-[10px] font-bold uppercase text-white focus:outline-none focus:border-ares-red transition-colors cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="priority">Priority (High-Low)</option>
              </select>
            </div>

            <div className="h-4 w-px bg-white/10" />

            {/* Show Archived Toggle */}
            <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-marble/75 hover:text-white cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="rounded bg-black border-white/25 text-ares-red focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
              Show Archived
            </label>
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
        </div>
      </header>

      {/* Create Task Form */}
      {canEdit ? (
        <form onSubmit={handleCreateTask} className="glass-card ares-cut-lg text-marble mb-12 max-w-3xl mx-auto p-8 space-y-6 border border-white/10">
          <h3 className="text-lg font-bold border-b border-white/5 pb-3 text-ares-gold flex items-center gap-2 font-heading uppercase tracking-tight">
            <Plus size={18} /> Create New Task Card
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="new-task-title" className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Title</label>
              <input
                id="new-task-title"
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
                <label htmlFor="new-task-subteam" className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Subteam</label>
                <select
                  id="new-task-subteam"
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
                <label htmlFor="new-task-priority" className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Priority</label>
                <select
                  id="new-task-priority"
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
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">
              Assign Task To ({newTaskAssignees.length})
            </label>
            <div className="flex flex-wrap gap-2 bg-black/40 border border-white/10 rounded p-3 max-h-36 overflow-y-auto scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent">
              {teamProfiles.length === 0 ? (
                <p className="text-[10px] text-marble/40 italic">Loading team members...</p>
              ) : (
                teamProfiles.map((member) => {
                  const isAssigned = newTaskAssignees.includes(member.uid);
                  return (
                    <button
                      key={member.uid}
                      type="button"
                      onClick={() => {
                        if (isAssigned) {
                          setNewTaskAssignees(newTaskAssignees.filter((uid) => uid !== member.uid));
                        } else {
                          setNewTaskAssignees([...newTaskAssignees, member.uid]);
                        }
                      }}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold transition-all cursor-pointer ${
                        isAssigned
                          ? "bg-ares-red/25 border-ares-red text-white shadow-sm"
                          : "bg-black/50 border-white/10 text-marble/70 hover:border-white/20 hover:text-white"
                      }`}
                    >
                      <img
                        src={member.avatar || `https://api.dicebear.com/9.x/bottts/svg?seed=${member.uid}`}
                        alt={member.nickname}
                        className="w-3.5 h-3.5 rounded-full object-contain bg-black/50"
                      />
                      <span>{member.nickname}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
          <div>
            <label htmlFor="new-task-desc" className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Description</label>
            <MarkdownEditor
              id="new-task-desc"
              placeholder="Detail technical calibration thresholds, subsystem specs, etc..."
              value={newTaskDesc}
              onChange={setNewTaskDesc}
              className="h-28"
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
        <div className="glass-card ares-cut border border-ares-bronze/20 text-marble/80 px-6 py-5 text-center text-xs font-semibold max-w-lg mx-auto mb-12 flex items-center gap-3 justify-center">
          <Shield size={16} className="text-ares-gold shrink-0" />
          <span>🔒 Guest View Mode: Please request developer clearance to manage task cards.</span>
        </div>
      )}

      {/* Board Columns Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        {columns.map((col) => {
          let colTasks = filteredTasks.filter((t) => t.status === col.id);

          // Apply client-side sorting logic
          colTasks = [...colTasks].sort((a, b) => {
            if (sortBy === "priority") {
              const priorityMap = { high: 3, medium: 2, low: 1 };
              const priorityA = priorityMap[a.priority] || 0;
              const priorityB = priorityMap[b.priority] || 0;
              if (priorityA !== priorityB) {
                return priorityB - priorityA;
              }
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            } else {
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }
          });

          return (
            <div
              key={col.id}
              className="glass-card p-5 border border-white/10 min-h-[550px] flex flex-col ares-cut-lg bg-black/10"
            >
              <h3 className="font-extrabold text-base text-white border-b border-white/5 pb-4 mb-4 flex items-center justify-between font-heading uppercase tracking-tight">
                <span className="flex items-center gap-2">
                  <span className="text-lg">{col.emoji}</span> {col.title}
                </span>
                <div className="flex items-center gap-2">
                  {col.id === "completed" && canEdit && colTasks.filter(t => !t.archived).length > 0 && (
                    <button
                      type="button"
                      onClick={handleArchiveAllCompleted}
                      title="Archive all active completed tasks"
                      className="text-[9px] bg-ares-gold/20 hover:bg-ares-gold/30 border border-ares-gold/30 text-ares-gold px-2 py-0.5 rounded transition-all cursor-pointer font-bold uppercase tracking-wider"
                    >
                      Archive All
                    </button>
                  )}
                  <span className="bg-ares-red/20 border border-ares-red/35 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full">
                    {colTasks.length}
                  </span>
                </div>
              </h3>

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, col.id)}
                onDragEnter={() => setDraggedOverCol(col.id)}
                onDragLeave={() => setDraggedOverCol(null)}
                className={`space-y-4 flex-1 transition-all duration-300 ${
                  draggedOverCol === col.id ? "bg-white/5 border border-dashed border-ares-red/20 ares-cut-lg p-2" : ""
                }`}
              >
                {colTasks.map((task) => {
                  const totalSub = task.subtasks?.length || 0;
                  const doneSub = task.subtasks?.filter((s) => s.done).length || 0;
                  const progressPercent = totalSub > 0 ? (doneSub / totalSub) * 100 : 0;
                  const commentsCount = task.commentsCount ?? (task.comments?.length || 0);

                  return (
                    <div
                      key={task.id}
                      draggable={canEdit}
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDragEnd={handleDragEnd}
                      tabIndex={0}
                      role="button"
                      aria-label={`Task: ${task.title}`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setEditingTaskId(task.id);
                        }
                      }}
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
                      className={`bg-black/35 border border-white/5 ares-cut p-4.5 transition-all duration-200 hover:border-ares-red hover:-translate-y-0.5 shadow-sm flex flex-col justify-between gap-4 cursor-grab active:cursor-grabbing ${
                        draggingTaskId === task.id ? "opacity-30 border-dashed border-white/20" : ""
                      }`}
                    >
                      <div className={draggingTaskId ? "pointer-events-none" : ""}>
                        {/* Card tags */}
                        <div className="flex justify-between items-center mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] bg-white/5 border border-white/10 px-2 py-0.5 rounded font-black uppercase tracking-wider text-marble/80">
                              {task.subteam}
                            </span>
                            {task.archived && (
                              <span className="text-[9px] bg-ares-gold/20 border border-ares-gold/30 px-2 py-0.5 rounded font-black uppercase tracking-wider text-ares-gold animate-pulse">
                                Archived
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {task.status === "completed" && canEdit && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleArchiveTask(task.id, !task.archived);
                                }}
                                title={task.archived ? "Restore Task" : "Archive Task"}
                                className="text-marble/55 hover:text-ares-gold transition-colors p-1 cursor-pointer bg-white/5 hover:bg-white/10 rounded border border-white/10 hover:border-ares-gold/30 flex items-center justify-center shrink-0"
                              >
                                <Archive size={10} />
                              </button>
                            )}
                            <span
                              className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${
                                task.priority === "high"
                                  ? "bg-ares-gold/20 text-ares-gold border-ares-gold/30"
                                  : task.priority === "medium"
                                  ? "bg-ares-cyan/10 text-ares-cyan border-ares-cyan/20"
                                  : "bg-ares-success/10 text-ares-success border-ares-success/20"
                              }`}
                            >
                              {task.priority}
                            </span>
                          </div>
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
          onArchiveTask={handleArchiveTask}
          setSyncState={setSyncState}
        />
      )}
    </div>
  );
}
