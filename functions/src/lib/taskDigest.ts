import { adminDb } from "./firebase-admin";
import { logger } from "./logger";
import { sendZulipMessage } from "./zulip";

const DIGEST_LIMIT = 400;

export interface TaskDueDigestEntry {
  id: string;
  title: string;
  dueDate: string;
  status: string;
  assignees: string[];
}

export type DueBucket = "overdue" | "today" | "tomorrow";

/** Buckets a task by its YYYY-MM-DD due date relative to the digest date. */
export function bucketByDueDate(dueDate: string, today: string): DueBucket | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return null;
  if (dueDate < today) return "overdue";
  const tomorrow = new Date(`${today}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  if (dueDate === tomorrow.toISOString().slice(0, 10)) return "tomorrow";
  if (dueDate === today) return "today";
  return null;
}

function titleFor(entry: TaskDueDigestEntry): string {
  return entry.title || "Untitled task";
}

function ownersFor(entry: TaskDueDigestEntry): string {
  return entry.assignees.length > 0 ? ` — ${entry.assignees.join(", ")}` : "";
}

export function formatDueDigest(
  buckets: Record<DueBucket, TaskDueDigestEntry[]>,
  streamBoardUrl = "https://aresfirst.org/dashboard/tasks",
): string | null {
  const total = buckets.overdue.length + buckets.today.length + buckets.tomorrow.length;
  if (total === 0) return null;

  const lines: string[] = ["📅 **Task due dates**"];
  const section = (label: string, entries: TaskDueDigestEntry[]) => {
    if (entries.length === 0) return;
    lines.push(`\n**${label} (${entries.length})**`);
    for (const entry of entries) {
      lines.push(
        `• ${titleFor(entry)}${ownersFor(entry)} — [card](${streamBoardUrl}?task=${encodeURIComponent(entry.id)})`,
      );
    }
  };
  section("Overdue", buckets.overdue);
  section("Due today", buckets.today);
  section("Due tomorrow", buckets.tomorrow);
  return lines.join("\n");
}

/**
 * Posts one daily digest of open tasks that are overdue or due within a day
 * to the kanban stream. Tasks without a due date, or further out, are never
 * included; completed, archived, and deleted cards are excluded.
 */
export async function sendTaskDueDigest(now = new Date()): Promise<boolean> {
  const today = now.toISOString().slice(0, 10);
  const snapshot = await adminDb
    .collection("tasks")
    .where("isDeleted", "==", 0)
    .limit(DIGEST_LIMIT)
    .get();

  const buckets: Record<DueBucket, TaskDueDigestEntry[]> = {
    overdue: [],
    today: [],
    tomorrow: [],
  };
  for (const document of snapshot.docs) {
    const data = document.data();
    // The query filters isDeleted, but re-check defensively so a legacy record
    // can never surface in the digest.
    if (data.isDeleted === 1 || data.archived === true || data.status === "completed") continue;
    const dueDate = typeof data.dueDate === "string" ? data.dueDate : "";
    const bucket = bucketByDueDate(dueDate, today);
    if (!bucket) continue;
    buckets[bucket].push({
      id: document.id,
      title: typeof data.title === "string" ? data.title : "",
      dueDate,
      status: typeof data.status === "string" ? data.status : "",
      assignees: Array.isArray(data.assignees)
        ? data.assignees.filter((uid: unknown): uid is string => typeof uid === "string").slice(0, 6)
        : [],
    });
  }

  const content = formatDueDigest(buckets);
  if (!content) {
    logger.info("taskDigest", "No due-date tasks; digest skipped");
    return true;
  }

  const stream = process.env.ZULIP_KANBAN_STREAM || "kanban";
  const delivered = await sendZulipMessage(stream, "Due Dates", content);
  if (delivered) {
    logger.info("taskDigest", "Posted the daily due-date digest", {
      overdue: buckets.overdue.length,
      today: buckets.today.length,
      tomorrow: buckets.tomorrow.length,
    });
  } else {
    logger.warn("taskDigest", "Zulip did not accept the due-date digest");
  }
  return delivered;
}
