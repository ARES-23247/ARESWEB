"use client";

import React, { useEffect, useState } from "react";
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Plus, Trash2, Shield, Activity } from "lucide-react";

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
}

const MOCK_TASKS: TaskItem[] = [
  {
    id: "task_1",
    title: "Calibrate Mecanum kS Friction Feedforward",
    description: "Run systematic motor sweeps to calibrate feedforward voltage deadbands at low velocity.",
    status: "in_progress",
    priority: "high",
    subteam: "software",
    assignees: ["lead.programmer@gmail.com"],
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
    assignees: ["mechanic.lead@gmail.com"],
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
    assignees: ["coach.david@gmail.com"],
    subtasks: [
      { id: "sub_5", title: "Compile World Championship recap data", done: true },
      { id: "sub_6", title: "Review pamphlet layouts with advisors", done: false }
    ],
    createdAt: new Date().toISOString()
  },
  {
    id: "task_4",
    title: "Zulip Two-Way Comment Sync",
    description: "Implement webhook triggers in next-firebase to write back Zulip stream replies directly to task cards.",
    status: "todo",
    priority: "high",
    subteam: "software",
    assignees: ["lead.programmer@gmail.com"],
    subtasks: [
      { id: "sub_7", title: "Read Hono webhook router files", done: true }
    ],
    createdAt: new Date().toISOString()
  }
];

export default function KanbanPage() {
  const { user, authorizedUser } = useAuth();
  const [tasks, setTasks] = useState<TaskItem[]>(MOCK_TASKS);
  const [filterSubteam, setFilterSubteam] = useState<string>("all");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskSubteam, setNewTaskSubteam] = useState<"software" | "hardware" | "business" | "outreach">("software");
  const [newTaskPriority, setNewTaskPriority] = useState<"low" | "medium" | "high">("medium");
  const [isLive, setIsLive] = useState(false);

  const canEdit = !!(user && authorizedUser && authorizedUser.role !== "unverified");

  // 1. Listen for real-time task updates
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
              createdAt: data.createdAt || new Date().toISOString()
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

  // 2. Action: Create a new Task
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
      assignees: [user?.email || "anonymous"],
      subtasks: [],
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, "tasks", taskId), newTask);
      setNewTaskTitle("");
      setNewTaskDesc("");
    } catch (err) {
      console.warn("Unable to save task online, updating local UI array.", err);
      setTasks([newTask, ...tasks]);
    }
  };

  // 3. Action: Update Card Status (Mobile & Desktop Friendly Selects)
  const handleMoveStatus = async (taskId: string, newStatus: TaskItem["status"]) => {
    if (!canEdit) return;
    try {
      const taskRef = doc(db, "tasks", taskId);
      await updateDoc(taskRef, { status: newStatus });
    } catch (err) {
      console.warn("Firestore offline, moving card locally.", err);
      setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    }
  };

  // 4. Action: Toggle Subtask Status
  const handleToggleSubtask = async (taskId: string, subtaskId: string) => {
    if (!canEdit) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const updatedSubtasks = task.subtasks.map(sub => 
      sub.id === subtaskId ? { ...sub, done: !sub.done } : sub
    );

    try {
      const taskRef = doc(db, "tasks", taskId);
      await updateDoc(taskRef, { subtasks: updatedSubtasks });
    } catch (err) {
      console.warn("Firestore offline, toggling subtask locally.", err);
      setTasks(tasks.map(t => t.id === taskId ? { ...t, subtasks: updatedSubtasks } : t));
    }
  };

  // 5. Action: Delete a Card
  const handleDeleteTask = async (taskId: string) => {
    if (!canEdit) return;
    if (!confirm("Are you sure you want to delete this task card?")) return;

    try {
      await deleteDoc(doc(db, "tasks", taskId));
    } catch (err) {
      console.warn("Firestore offline, deleting card locally.", err);
      setTasks(tasks.filter(t => t.id !== taskId));
    }
  };

  // 6. Filter tasks by subteam
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
              className="glass-card p-5 border border-white/10 min-h-[550px] flex flex-col rounded-2xl"
            >
              <h3 className="font-extrabold text-base text-white border-b border-white/5 pb-4 mb-4 flex items-center justify-between font-heading uppercase tracking-tight">
                <span className="flex items-center gap-2">
                  <span className="text-lg">{col.emoji}</span> {col.title}
                </span>
                <span className="bg-ares-red/20 border border-ares-red/35 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full">
                  {colTasks.length}
                </span>
              </h3>

              <div className="space-y-4 flex-1">
                {colTasks.map((task) => {
                  const totalSub = task.subtasks.length;
                  const doneSub = task.subtasks.filter((s) => s.done).length;
                  const progressPercent = totalSub > 0 ? (doneSub / totalSub) * 100 : 0;

                  return (
                    <div
                      key={task.id}
                      className="bg-black/35 border border-white/5 rounded-xl p-4.5 transition-all duration-200 hover:border-ares-red hover:-translate-y-0.5 shadow-sm flex flex-col justify-between gap-4"
                    >
                      <div>
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

                        <h4 className="font-bold text-white leading-snug mb-2 font-heading text-sm">
                          {task.title}
                        </h4>
                        <p className="text-marble/60 text-[11px] leading-relaxed mb-4">{task.description}</p>

                        {/* Subtasks checklists */}
                        {totalSub > 0 && (
                          <div className="mb-2 bg-black/45 p-3 rounded-lg border border-white/5">
                            <div className="flex justify-between items-center text-[9px] font-bold text-marble/55 mb-2 uppercase tracking-wider">
                              <span>Subtasks Progress</span>
                              <span>
                                {doneSub}/{totalSub}
                              </span>
                            </div>
                            {/* Progress bar */}
                            <div className="w-full bg-black/60 h-1.5 rounded-full overflow-hidden mb-3 border border-white/5">
                              <div
                                className="bg-ares-red h-full rounded-full transition-all duration-300"
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                            {/* Subtask list */}
                            <div className="space-y-2">
                              {task.subtasks.map((sub) => (
                                <label
                                  key={sub.id}
                                  className="flex items-center gap-2 text-[11px] text-marble/80 cursor-pointer select-none hover:text-white"
                                >
                                  <input
                                    type="checkbox"
                                    checked={sub.done}
                                    disabled={!canEdit}
                                    onChange={() => handleToggleSubtask(task.id, sub.id)}
                                    className="rounded bg-black border-white/25 text-ares-red focus:ring-0 focus:ring-offset-0 disabled:opacity-50"
                                  />
                                  <span className={sub.done ? "line-through text-marble/40" : ""}>
                                    {sub.title}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Controls */}
                      <div className="border-t border-white/5 pt-3 flex justify-between items-center gap-2 mt-auto">
                        {canEdit ? (
                          <>
                            <select
                              value={task.status}
                              onChange={(e) => handleMoveStatus(task.id, e.target.value as any)}
                              className="bg-black/60 border border-white/10 text-marble/95 text-[10px] font-black uppercase rounded px-2.5 py-1.5 focus:outline-none focus:border-ares-red cursor-pointer"
                            >
                              <option value="todo">📋 To Do</option>
                              <option value="in_progress">⚙️ In Progress</option>
                              <option value="review">👀 In Review</option>
                              <option value="completed">✅ Completed</option>
                            </select>
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              className="text-marble/40 hover:text-ares-red transition-colors p-1 cursor-pointer"
                              title="Delete task card"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        ) : (
                          <span className="text-[9px] text-marble/45 italic flex items-center gap-1 font-semibold uppercase tracking-wider">
                            🔒 Read-only
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
    </div>
  );
}
