"use client";

import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, setDoc, updateDoc, query, limit, runTransaction, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebaseFirestore";
import { useAuth } from "@/context/AuthContext";
import { Activity } from "lucide-react";
import { authenticatedFetch } from "@/lib/api";
import TaskDetailsModal from "./components/TaskDetailsModal";
import TaskFilters from "./components/TaskFilters";
import TaskBoardColumn from "./components/TaskBoardColumn";
import { TaskItem, MemberProfile, SubTask } from "@/types/task";
import { PublicDataState } from "@/components/PublicDataState";
import TaskOperationErrorAlert from "./components/TaskOperationErrorAlert";
import { describeTaskError, TaskOperationError } from "./taskErrors";
import { appendSubtask, readSubtasks, removeSubtask, toggleSubtask } from "./taskSubtasks";

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
    description: "Design and print marketing pamphlets detailing ARES 23247 *FIRST*® achievements.",
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
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [teamProfiles, setTeamProfiles] = useState<MemberProfile[]>([]);
  const [filterSubteam, setFilterSubteam] = useState<string>("all");
  const [isLive, setIsLive] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [draggedOverCol, setDraggedOverCol] = useState<TaskItem["status"] | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  // Operational state extensions
  const [showArchived, setShowArchived] = useState(false);
  const [sortBy, setSortBy] = useState<"newest" | "priority">("newest");
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "success" | "error">("idle");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [operationError, setOperationError] = useState<TaskOperationError | null>(null);
  const [retryOperation, setRetryOperation] = useState<(() => Promise<unknown>) | null>(null);

  const canEdit = !!(user && authorizedUser && authorizedUser.role !== "unverified");

  const executeTaskOperation = async (
    action: string,
    operation: () => Promise<void>,
    retry: () => Promise<unknown>
  ): Promise<TaskOperationError | null> => {
    try {
      await operation();
      setOperationError(null);
      setRetryOperation(null);
      return null;
    } catch (error) {
      console.error(`Kanban ${action} failed:`, error);
      const describedError = describeTaskError(action, error);
      setOperationError(describedError);
      setRetryOperation(() => retry);
      return describedError;
    }
  };

  const runZulipSync = async (fetchPromise: Promise<Response>) => {
    setSyncState("syncing");
    try {
      const res = await fetchPromise;
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      setSyncState("success");
      setTimeout(() => setSyncState("idle"), 3000);
    } catch (err) {
      console.error("Zulip sync error:", err);
      const notificationError = describeTaskError("notify Zulip", err);
      setOperationError({
        ...notificationError,
        message: "The task was saved, but its Zulip notification failed. The board remains the source of truth.",
      });
      setRetryOperation(null);
      setSyncState("error");
      setTimeout(() => setSyncState("idle"), 3000);
    }
  };

  useEffect(() => {
    if (import.meta.env.MODE === "e2e") {
      setTasks(MOCK_TASKS);
      setIsLive(false);
      return;
    }

    try {
      const tasksRef = collection(db, "tasks");
      const q = query(tasksRef, limit(500));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (snapshot.empty) {
            setTasks([]);
            setIsLive(true);
            setLoadError(null);
            return;
          }
          const list = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              title: data.title || "Untitled Task",
              description: data.description || "",
              status: data.status || "todo",
              priority: data.priority || "medium",
              subteam: data.subteam || "software",
              assignees: data.assignees || [],
              subtasks: data.subtasks || [],
              archived: data.archived || false,
              isDeleted: data.isDeleted === 1 ? 1 : 0,
              createdAt: data.createdAt || new Date().toISOString(),
              commentsCount: data.commentsCount || (data.comments?.length || 0)
            } as TaskItem;
          });
          setTasks(list.filter((task) => task.isDeleted !== 1));
          setIsLive(true);
          setLoadError(null);
        },
        (err) => {
          console.error("Unable to load task board:", err);
          setTasks([]);
          setIsLive(false);
          setLoadError(err.message);
        }
      );
      return () => unsubscribe();
    } catch (e) {
      console.error("Unable to initialize task board:", e);
      setTasks([]);
      setIsLive(false);
      setLoadError(e instanceof Error ? e.message : String(e));
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

  const handleMoveStatus = async (
    taskId: string,
    newStatus: TaskItem["status"]
  ): Promise<TaskOperationError | null> => {
    if (!canEdit) return null;
    const task = tasks.find((t) => t.id === taskId);
    if (import.meta.env.MODE === "e2e") {
      setTasks((current) => current.map((item) => (item.id === taskId ? { ...item, status: newStatus } : item)));
      return null;
    }
    const performMove = async () => {
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
    };
    return executeTaskOperation("move task", performMove, () => handleMoveStatus(taskId, newStatus));
  };

  const handleArchiveTask = async (
    taskId: string,
    isArchived: boolean
  ): Promise<TaskOperationError | null> => {
    if (!canEdit) return null;
    const performArchive = async () => {
      const taskRef = doc(db, "tasks", taskId);
      await updateDoc(taskRef, { archived: isArchived });
    };
    return executeTaskOperation(
      isArchived ? "archive task" : "restore task",
      performArchive,
      () => handleArchiveTask(taskId, isArchived)
    );
  };

  const handleArchiveAllCompleted = async (): Promise<TaskOperationError | null> => {
    if (!canEdit) return null;
    const completedTasks = tasks.filter((t) => t.status === "completed" && !t.archived);
    const performArchiveAll = async () => {
      const batch = writeBatch(db);
      completedTasks.forEach((task) => batch.update(doc(db, "tasks", task.id), { archived: true }));
      await batch.commit();
    };
    return executeTaskOperation(
      "archive completed tasks",
      performArchiveAll,
      handleArchiveAllCompleted
    );
  };

  const handleToggleSubtask = async (
    taskId: string,
    subtaskId: string
  ): Promise<TaskOperationError | null> => {
    if (!canEdit) return null;
    const performToggle = async () => {
      const taskRef = doc(db, "tasks", taskId);
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(taskRef);
        if (!snapshot.exists()) throw new Error("not-found: Task no longer exists");
        const currentSubtasks = readSubtasks(snapshot.data().subtasks);
        transaction.update(taskRef, { subtasks: toggleSubtask(currentSubtasks, subtaskId) });
      });
    };
    return executeTaskOperation(
      "update subtask",
      performToggle,
      () => handleToggleSubtask(taskId, subtaskId)
    );
  };

  const handleDeleteSubtask = async (
    taskId: string,
    subtaskId: string
  ): Promise<TaskOperationError | null> => {
    if (!canEdit) return null;
    const performDeleteSubtask = async () => {
      const taskRef = doc(db, "tasks", taskId);
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(taskRef);
        if (!snapshot.exists()) throw new Error("not-found: Task no longer exists");
        const currentSubtasks = readSubtasks(snapshot.data().subtasks);
        transaction.update(taskRef, { subtasks: removeSubtask(currentSubtasks, subtaskId) });
      });
    };
    return executeTaskOperation(
      "delete subtask",
      performDeleteSubtask,
      () => handleDeleteSubtask(taskId, subtaskId)
    );
  };

  const handleAddSubtaskDirect = async (
    taskId: string,
    title: string
  ): Promise<TaskOperationError | null> => {
    if (!title.trim() || !canEdit) return null;
    const randomId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const newSub: SubTask = {
      id: `sub_${randomId}`,
      title: title.trim(),
      done: false
    };
    const performAddSubtask = async () => {
      const taskRef = doc(db, "tasks", taskId);
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(taskRef);
        if (!snapshot.exists()) throw new Error("not-found: Task no longer exists");
        const currentSubtasks = readSubtasks(snapshot.data().subtasks);
        transaction.update(taskRef, { subtasks: appendSubtask(currentSubtasks, newSub) });
      });
    };
    return executeTaskOperation(
      "add subtask",
      performAddSubtask,
      () => handleAddSubtaskDirect(taskId, title)
    );
  };

  const handleDeleteTask = async (taskId: string): Promise<TaskOperationError | null> => {
    if (!canEdit) return null;
    const performDelete = async () => {
      await updateDoc(doc(db, "tasks", taskId), { isDeleted: 1, archived: true });
    };
    return executeTaskOperation("delete task", performDelete, () => handleDeleteTask(taskId));
  };

  const handleCreateTask = async (newTask: TaskItem): Promise<TaskOperationError | null> => {
    if (import.meta.env.MODE === "e2e") {
      setTasks((current) => [newTask, ...current]);
      return null;
    }
    const performCreate = () => setDoc(doc(db, "tasks", newTask.id), newTask);
    return executeTaskOperation("create task", performCreate, () => handleCreateTask(newTask));
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
    const taskId = e.dataTransfer.getData("text/plain") || draggingTaskId;
    setDraggedOverCol(null);
    setDraggingTaskId(null);
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
    <div className="space-y-10 w-full text-left">
      {/* Header */}
      <header className="border-b border-white/5 pb-8 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div>
          <p className="text-ares-gold font-bold uppercase tracking-widest text-xs mb-3 font-heading flex items-center gap-2">
            <Activity size={12} className="animate-pulse" /> Operational Workspace
          </p>
          <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter font-heading flex flex-wrap items-center gap-3">
            Kanban Tasks
            {isLive ? (
              <span className="inline-flex items-center rounded-full bg-ares-gold px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-black ring-1 ring-inset ring-ares-bronze ml-2">
                Live sync
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-ares-red px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white ring-1 ring-inset ring-ares-bronze ml-2">
                Data unavailable
              </span>
            )}
            
            {/* Zulip synchronization states */}
            {syncState === "syncing" && (
              <span className="inline-flex items-center rounded-full bg-ares-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-ares-gold ring-1 ring-inset ring-ares-gold/30 ml-2 animate-pulse">
                Zulip syncing...
              </span>
            )}
            {syncState === "success" && (
              <span className="inline-flex items-center rounded-full bg-ares-gold px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-black ring-1 ring-inset ring-ares-bronze ml-2">
                Zulip synced
              </span>
            )}
            {syncState === "error" && (
              <span className="inline-flex items-center rounded-full bg-ares-red px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white ring-1 ring-inset ring-ares-bronze ml-2">
                Sync error
              </span>
            )}
          </h1>
          <p className="text-marble/70 text-sm mt-2 max-w-2xl font-medium">
            Collaborative subteam Kanban dashboard. Create cards, assign responsibilities, and update status blocks in real-time.
          </p>
        </div>

        <TaskFilters
          canEdit={canEdit}
          onOpenCreate={() => setIsCreateOpen(true)}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          showArchived={showArchived}
          onShowArchivedChange={setShowArchived}
          filterSubteam={filterSubteam}
          onFilterSubteamChange={setFilterSubteam}
        />
      </header>

      {loadError && (
        <PublicDataState
          title="Unable to load the task board"
          message="The task records could not be reached. Check your session and connection, then retry."
          diagnostic={loadError}
          onRetry={() => window.location.reload()}
        />
      )}

      {operationError && (
        <TaskOperationErrorAlert
          error={operationError}
          onDismiss={() => {
            setOperationError(null);
            setRetryOperation(null);
          }}
          onRetry={retryOperation ? () => void retryOperation().catch(() => undefined) : undefined}
        />
      )}

      {/* Board Columns Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        {columns.map((col) => {
          let colTasks = filteredTasks.filter((t) => t.status === col.id);

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
            <TaskBoardColumn
              key={col.id}
              col={col}
              colTasks={colTasks}
              canEdit={canEdit}
              onArchiveAllCompleted={handleArchiveAllCompleted}
              onDrop={handleDrop}
              draggedOverCol={draggedOverCol}
              setDraggedOverCol={setDraggedOverCol}
              draggingTaskId={draggingTaskId}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onEditTask={setEditingTaskId}
              onArchiveTask={handleArchiveTask}
              teamProfiles={teamProfiles}
            />
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
          onNotificationError={(error) => {
            setOperationError(error);
            setRetryOperation(null);
          }}
          setSyncState={setSyncState}
        />
      )}

      {/* Create Task Modal Overlay */}
      {isCreateOpen && canEdit && (
        <TaskDetailsModal
          taskId={null}
          tasks={tasks}
          teamProfiles={teamProfiles}
          canEdit={canEdit}
          user={user}
          onClose={() => setIsCreateOpen(false)}
          onToggleSubtask={handleToggleSubtask}
          onDeleteSubtask={handleDeleteSubtask}
          onAddSubtask={handleAddSubtaskDirect}
          onDeleteTask={handleDeleteTask}
          onArchiveTask={handleArchiveTask}
          onNotificationError={(error) => {
            setOperationError(error);
            setRetryOperation(null);
          }}
          onCreateTask={handleCreateTask}
          setSyncState={setSyncState}
        />
      )}
    </div>
  );
}
