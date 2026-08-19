import { FieldPath, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin";
import { logger } from "./logger";
import { sendZulipMessage } from "./zulip";

const DIGEST_PAGE_LIMIT = 400;
// Bounded work per run: three pages keep a large board from stalling the
// schedule while still covering several times the current task count.
const DIGEST_MAX_PAGES = 3;
// Nickname lookups stay bounded; every unresolved or uncapped assignee is
// rendered as a generic label so raw Firebase UIDs never reach Zulip.
const NICKNAME_LOOKUP_LIMIT = 60;

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

/**
 * Renders assignee labels. Without a nickname map (pure formatting use) the
 * raw values are shown for transparency; the sending path always supplies a
 * map and falls back to a generic label so internal UIDs are never posted.
 */
function ownersFor(entry: TaskDueDigestEntry, nicknames?: Map<string, string>): string {
  if (entry.assignees.length === 0) return "";
  const labels = entry.assignees.map((assignee) =>
    nicknames ? (nicknames.get(assignee) ?? "member") : assignee,
  );
  return ` — ${labels.join(", ")}`;
}

export function formatDueDigest(
  buckets: Record<DueBucket, TaskDueDigestEntry[]>,
  streamBoardUrl = "https://aresfirst.org/dashboard/tasks",
  nicknames?: Map<string, string>,
): string | null {
  const total = buckets.overdue.length + buckets.today.length + buckets.tomorrow.length;
  if (total === 0) return null;

  const lines: string[] = ["📅 **Task due dates**"];
  const section = (label: string, entries: TaskDueDigestEntry[]) => {
    if (entries.length === 0) return;
    lines.push(`\n**${label} (${entries.length})**`);
    for (const entry of entries) {
      lines.push(
        `• ${titleFor(entry)}${ownersFor(entry, nicknames)} — [card](${streamBoardUrl}?task=${encodeURIComponent(entry.id)})`,
      );
    }
  };
  section("Overdue", buckets.overdue);
  section("Due today", buckets.today);
  section("Due tomorrow", buckets.tomorrow);
  return lines.join("\n");
}

async function resolveNicknames(uids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(uids)].slice(0, NICKNAME_LOOKUP_LIMIT);
  if (unique.length === 0) return new Map();
  const snapshots = await adminDb.getAll(
    ...unique.map((uid) => adminDb.collection("user_profiles").doc(uid)),
  );
  const nicknames = new Map<string, string>();
  snapshots.forEach((snapshot, index) => {
    const data = snapshot.data();
    const nickname = typeof data?.nickname === "string" ? data.nickname.trim() : "";
    if (nickname) nicknames.set(unique[index], nickname.slice(0, 60));
  });
  return nicknames;
}

/**
 * Posts one daily digest of open tasks that are overdue or due within a day
 * to the kanban stream. Tasks without a due date, or further out, are never
 * included; completed, archived, and deleted cards are excluded. Pages are
 * ordered by document id so every task is seen even past one page.
 */
export async function sendTaskDueDigest(now = new Date()): Promise<boolean> {
  const today = now.toISOString().slice(0, 10);

  const buckets: Record<DueBucket, TaskDueDigestEntry[]> = {
    overdue: [],
    today: [],
    tomorrow: [],
  };
  let lastDoc: QueryDocumentSnapshot | null = null;
  for (let page = 0; page < DIGEST_MAX_PAGES; page += 1) {
    let query = adminDb
      .collection("tasks")
      .where("isDeleted", "==", 0)
      .orderBy(FieldPath.documentId())
      .limit(DIGEST_PAGE_LIMIT);
    if (lastDoc) query = query.startAfter(lastDoc);
    const snapshot = await query.get();
    if (snapshot.empty) break;

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

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < DIGEST_PAGE_LIMIT) break;
  }

  const nicknames = await resolveNicknames(
    buckets.overdue.concat(buckets.today, buckets.tomorrow).flatMap((entry) => entry.assignees),
  );
  const content = formatDueDigest(buckets, undefined, nicknames);
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
