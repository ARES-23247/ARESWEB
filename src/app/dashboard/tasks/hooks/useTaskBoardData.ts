import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import {
  collection,
  getCountFromServer,
  limit,
  onSnapshot,
  query,
} from "firebase/firestore";
import { authenticatedFetch } from "@/lib/api";
import { db } from "@/lib/firebaseFirestore";
import type { MemberProfile, TaskItem } from "@/types/task";
import { logger } from "@/utils/logger";
import { normalizeTaskRecord } from "../taskRecord";

const TASK_QUERY_LIMIT = 500;

const E2E_TASK_FIXTURES: TaskItem[] = [
  {
    id: "task_1",
    title: "Calibrate Mecanum kS Friction Feedforward",
    description:
      "Run systematic motor sweeps to calibrate feedforward voltage deadbands at low velocity.",
    status: "in_progress",
    priority: "high",
    subteam: "software",
    assignees: ["lead_programmer"],
    subtasks: [
      { id: "sub_1", title: "Run friction sweep script", done: true },
      {
        id: "sub_2",
        title: "Apply 0.05 kS compensation in FtcMecanumRobot.kt",
        done: false,
      },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: "task_2",
    title: "Assemble Compliant Intake Flywheels",
    description:
      "3D print and mount compliant wheels to the main hex shaft assembly for intake testing.",
    status: "todo",
    priority: "medium",
    subteam: "hardware",
    assignees: ["mechanic_lead"],
    subtasks: [
      { id: "sub_3", title: "3D print TPU compliant wheels", done: true },
      { id: "sub_4", title: "Mount hex shaft to side plates", done: false },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: "task_3",
    title: "Sponsorship Outreach Pamphlets",
    description:
      "Design and print marketing pamphlets detailing ARES 23247 *FIRST*® achievements.",
    status: "review",
    priority: "high",
    subteam: "business",
    assignees: ["coach_david"],
    subtasks: [
      {
        id: "sub_5",
        title: "Compile World Championship recap data",
        done: true,
      },
      {
        id: "sub_6",
        title: "Review pamphlet layouts with advisors",
        done: false,
      },
    ],
    createdAt: new Date().toISOString(),
  },
];

interface TaskBoardData {
  tasks: TaskItem[];
  setTasks: Dispatch<SetStateAction<TaskItem[]>>;
  teamProfiles: MemberProfile[];
  isLive: boolean;
  loadError: string | null;
  overflowCount: number;
  overflowUnknown: boolean;
}

export function useTaskBoardData(): TaskBoardData {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [teamProfiles, setTeamProfiles] = useState<MemberProfile[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [overflowCount, setOverflowCount] = useState(0);
  const [overflowUnknown, setOverflowUnknown] = useState(false);

  useEffect(() => {
    if (import.meta.env.MODE === "e2e") {
      setTasks(E2E_TASK_FIXTURES);
      setIsLive(false);
      return;
    }

    try {
      const taskQuery = query(collection(db, "tasks"), limit(TASK_QUERY_LIMIT));
      return onSnapshot(
        taskQuery,
        (snapshot) => {
          const nextTasks = snapshot.empty
            ? []
            : snapshot.docs
                .map((taskDocument) =>
                  normalizeTaskRecord(taskDocument.id, taskDocument.data()),
                )
                .filter((task) => task.isDeleted !== 1);
          setTasks(nextTasks);
          setIsLive(true);
          setLoadError(null);
        },
        (error) => {
          logger.error("Unable to load task board:", error);
          setTasks([]);
          setIsLive(false);
          setLoadError(error.message);
        },
      );
    } catch (error) {
      logger.error("Unable to initialize task board:", error);
      setTasks([]);
      setIsLive(false);
      setLoadError(error instanceof Error ? error.message : String(error));
    }
  }, []);

  useEffect(() => {
    if (import.meta.env.MODE === "e2e") return;
    void getCountFromServer(
      query(collection(db, "tasks"), limit(TASK_QUERY_LIMIT + 1)),
    )
      .then((snapshot) => {
        setOverflowCount(
          Math.max(0, snapshot.data().count - TASK_QUERY_LIMIT),
        );
        setOverflowUnknown(false);
      })
      .catch((error: unknown) => {
        logger.error("Unable to verify the task truncation count:", error);
        setOverflowUnknown(true);
      });
  }, []);

  useEffect(() => {
    void authenticatedFetch("/api/profiles/team-roster")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch team roster: ${response.status}`);
        }
        const data = (await response.json()) as { members?: MemberProfile[] };
        setTeamProfiles(data.members ?? []);
      })
      .catch((error: unknown) => {
        logger.warn("Failed to fetch team roster from backend:", error);
      });
  }, []);

  return {
    tasks,
    setTasks,
    teamProfiles,
    isLive,
    loadError,
    overflowCount,
    overflowUnknown,
  };
}
