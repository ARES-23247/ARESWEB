"use client";

import { logger } from "@/utils/logger";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, limit, runTransaction, writeBatch, getCountFromServer } from "firebase/firestore";
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
import {
  buildDuplicateTaskCounts,
  normalizeTaskRecord,
  sortTasks,
  taskMatchesSearch,
  type TaskSortMode,
} from "./taskRecord";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [draggedOverCol, setDraggedOverCol] = useState<TaskItem["status"] | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [moveAnnouncement, setMoveAnnouncement] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  // Operational state extensions
  const [showArchived, setShowArchived] = useState(false);
  const [sortBy, setSortBy] = useState<TaskSortMode>("newest");
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "success" | "error">("idle");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [overflowCount, setOverflowCount] = useState(0);
  const [operationError, setOperationError] = useState<TaskOperationError | null>(null);
  const [retryOperation, setRetryOperation] = useState<(() => Promise<unknown>) | null>(null);

  const canEdit = !!(user && authorizedUser && authorizedUser.role !== "unverified");
  const canUseAi = authorizedUser?.role === "admin" || authorizedUser?.role === "coach";

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
      logger.error(`Kanban ${action} failed:`, error);
      const describedError = describeTaskError(action, error);
      setOperationError(describedError);
      setRetryOperation(() => retry);
      return describedError;
    }
  };

  const actorLabel = () => {
    const profile = teamProfiles.find((p) => p.uid === user?.uid);
    return profile?.nickname || "Team Member";
  };

  // Activity trail: one immutable revision entry per board operation, written
  // in the same batch as the change it describes (rules-bounded).
  const taskRevisionRef = (taskId: string) =>
    doc(db, "tasks", taskId, "revisions", `rev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

  const writeTaskRevision = (
    batch: ReturnType<typeof writeBatch>,
    taskId: string,
    entry: { action: "created" | "updated" | "moved" | "archived" | "restored" | "deleted"; from?: string; to?: string; fields?: string[] }
  ) => {
    batch.set(taskRevisionRef(taskId), {
      action: entry.action,
      ...(entry.from !== undefined ? { from: entry.from } : {}),
      ...(entry.to !== undefined ? { to: entry.to } : {}),
      ...(entry.fields !== undefined ? { fields: entry.fields } : {}),
      actorUid: user?.uid || "unknown",
      actorName: actorLabel(),
      createdAt: new Date().toISOString(),
    });
  };

  const runZulipSync = async (fetchPromise: Promise<Response>) => {
    setSyncState("syncing");
    try {
      const res = await fetchPromise;
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      setSyncState("success");
      setTimeout(() => setSyncState("idle"), 3000);
    } catch (err) {
      logger.error("Zulip sync error:", err);
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
          const list = snapshot.docs.map((docSnap) => normalizeTaskRecord(docSnap.id, docSnap.data()));
          setTasks(list.filter((task) => task.isDeleted !== 1));
          setIsLive(true);
          setLoadError(null);
        },
        (err) => {
          logger.error("Unable to load task board:", err);
          setTasks([]);
          setIsLive(false);
          setLoadError(err.message);
        }
      );
      return () => unsubscribe();
    } catch (e) {
      logger.error("Unable to initialize task board:", e);
      setTasks([]);
      setIsLive(false);
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  // ?task={id} deep links (from Zulip messages or copied card links) arrive as
  // full page loads, so the parameter is read from the location once and then
  // cleared without a router dependency.
  const [deepLinkId, setDeepLinkId] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get("task")
  );
  useEffect(() => {
    if (!deepLinkId) return;
    if (tasks.some((task) => task.id === deepLinkId)) {
      setEditingTaskId(deepLinkId);
      setDeepLinkId(null);
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState(null, "", cleanUrl);
    }
  }, [deepLinkId, tasks]);

  // Surface silent truncation: the board queries at most 500 tasks.
  useEffect(() => {
    if (import.meta.env.MODE === "e2e") return;
    getCountFromServer(query(collection(db, "tasks"), limit(501)))
      .then((snap) => setOverflowCount(Math.max(0, snap.data().count - 500)))
      .catch(() => setOverflowCount(0));
  }, []);

  useEffect(() => {
    const fetchTeamRoster = async () => {
      try {
        const response = await authenticatedFetch("/api/profiles/team-roster");
        if (!response.ok) throw new Error(`Failed to fetch team roster: ${response.status}`);
        const data = await response.json();
        setTeamProfiles(data.members || []);
      } catch (e) {
        logger.warn("Failed to fetch team roster from backend:", e);
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
      setMoveAnnouncement(`${task?.title || "Task"} moved to ${newStatus.replaceAll("_", " ")}.`);
      return null;
    }
    const performMove = async () => {
      const taskRef = doc(db, "tasks", taskId);
      const batch = writeBatch(db);
      batch.update(taskRef, { status: newStatus });
      if (task) writeTaskRevision(batch, taskId, { action: "moved", from: task.status, to: newStatus });
      await batch.commit();

      if (task) {
        const syncPromise = authenticatedFetch("/api/tasks/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId,
            action: "move",
            title: task.title,
            status: newStatus,
            dueDate: task.dueDate || undefined,
          }),
        });
        runZulipSync(syncPromise);
      }
    };
    const error = await executeTaskOperation("move task", performMove, () => handleMoveStatus(taskId, newStatus));
    if (!error) setMoveAnnouncement(`${task?.title || "Task"} moved to ${newStatus.replaceAll("_", " ")}.`);
    return error;
  };

  const handleArchiveTask = async (
    taskId: string,
    isArchived: boolean
  ): Promise<TaskOperationError | null> => {
    if (!canEdit) return null;
    const performArchive = async () => {
      const taskRef = doc(db, "tasks", taskId);
      const batch = writeBatch(db);
      batch.update(taskRef, { archived: isArchived });
      writeTaskRevision(batch, taskId, { action: isArchived ? "archived" : "restored" });
      await batch.commit();
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
      const taskRef = doc(db, "tasks", taskId);
      const batch = writeBatch(db);
      batch.update(taskRef, { isDeleted: 1, archived: true });
      writeTaskRevision(batch, taskId, { action: "deleted" });
      await batch.commit();
    };
    return executeTaskOperation("delete task", performDelete, () => handleDeleteTask(taskId));
  };

  const handleCreateTask = async (newTask: TaskItem): Promise<TaskOperationError | null> => {
    if (import.meta.env.MODE === "e2e") {
      setTasks((current) => [newTask, ...current]);
      return null;
    }
    const performCreate = async () => {
      const taskRef = doc(db, "tasks", newTask.id);
      const batch = writeBatch(db);
      batch.set(taskRef, newTask);
      writeTaskRevision(batch, newTask.id, { action: "created" });
      await batch.commit();
    };
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

  const duplicateTaskCounts = useMemo(
    () => buildDuplicateTaskCounts(tasks.filter((task) => !task.archived)),
    [tasks],
  );
  const filteredTasks = tasks.filter(
    (task) =>
      (filterSubteam === "all" || task.subteam === filterSubteam) &&
      (!task.archived || showArchived) &&
      taskMatchesSearch(task, searchQuery) &&
      (!showDuplicatesOnly || duplicateTaskCounts.has(task.id)),
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
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          showDuplicatesOnly={showDuplicatesOnly}
          onShowDuplicatesOnlyChange={setShowDuplicatesOnly}
          duplicateTaskCount={duplicateTaskCounts.size}
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

      <p role="status" aria-live="polite" className="sr-only">{moveAnnouncement}</p>

      {!loadError && tasks.length > 0 && filteredTasks.length === 0 && (
        <p role="status" className="rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm text-marble/75">
          No tasks match the current search and filters.
        </p>
      )}

      {overflowCount > 0 && (
        <p role="status" className="rounded-lg border border-ares-gold/30 bg-ares-gold/10 px-4 py-3 text-sm text-ares-gold">
          Showing the first 500 task cards; {overflowCount} more {overflowCount === 1 ? "card is" : "cards are"} hidden. Archive completed tasks to see older work.
        </p>
      )}

      {/* Board Columns Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        {columns.map((col) => {
          const colTasks = sortTasks(
            filteredTasks.filter((task) => task.status === col.id),
            sortBy,
          );

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
              onMoveStatus={handleMoveStatus}
              onEditTask={setEditingTaskId}
              onArchiveTask={handleArchiveTask}
              teamProfiles={teamProfiles}
              duplicateCounts={duplicateTaskCounts}
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
          canUseAi={canUseAi}
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
          canUseAi={canUseAi}
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
