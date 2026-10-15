import { useEffect, useState } from "react";
import {
  collection as fsCollection,
  limit as fsLimit,
  onSnapshot,
  orderBy as fsOrderBy,
  query as fsQuery,
} from "firebase/firestore";
import { History } from "lucide-react";
import { db } from "@/lib/firebaseFirestore";
import { logger } from "@/utils/logger";

export interface TaskRevisionEntry {
  id: string;
  action: string;
  actorName: string;
  createdAt: string;
  from?: string;
  to?: string;
  fields?: string[];
}

interface TaskRevisionsSectionProps {
  taskId: string;
}

export default function TaskRevisionsSection({ taskId }: TaskRevisionsSectionProps) {
  const [revisions, setRevisions] = useState<TaskRevisionEntry[]>([]);

  useEffect(() => {
    if (!taskId) {
      setRevisions([]);
      return;
    }
    const revisionsQuery = fsQuery(
      fsCollection(db, "tasks", taskId, "revisions"),
      fsOrderBy("createdAt", "desc"),
      fsLimit(30),
    );
    const unsubscribe = onSnapshot(
      revisionsQuery,
      (snapshot) => {
        setRevisions(
          snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<TaskRevisionEntry, "id">),
          })),
        );
      },
      (err) => logger.warn("Task history unavailable:", err),
    );
    return () => unsubscribe();
  }, [taskId]);

  return (
    <div className="bg-black/20 p-4 rounded-xl border border-white/5">
      <h4 className="text-xs font-black text-ares-gold uppercase tracking-wider flex items-center gap-1.5 mb-3">
        <History size={12} aria-hidden="true" /> Card History
      </h4>
      {revisions.length === 0 ? (
        <p className="text-[11px] text-marble/40 italic">No recorded activity yet.</p>
      ) : (
        <ol className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-white/5">
          {revisions.map((entry, idx) => (
            <li
              key={entry.id || `${entry.createdAt}-${idx}`}
              className="text-[11px] text-marble/70 flex flex-wrap gap-x-2"
            >
              <span className="font-bold text-white">
                {new Date(entry.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
              <span>
                <span className="text-ares-cyan font-semibold">
                  {entry.actorName || "Member"}
                </span>{" "}
                {entry.action === "moved"
                  ? `moved ${entry.from || "?"} → ${entry.to || "?"}`
                  : entry.action === "updated"
                    ? `edited${entry.fields && entry.fields.length > 0 ? ` (${entry.fields.join(", ")})` : ""}`
                    : entry.action}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
