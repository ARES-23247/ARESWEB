import { logger } from "@/utils/logger";
import React, { useEffect, useState } from "react";
import { collection, doc, onSnapshot, increment, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebaseFirestore";
import { MessageSquare } from "lucide-react";
import { authenticatedFetch } from "@/lib/api";

import { TaskComment, MemberProfile, TaskItem } from "@/types/task";
import type { User } from "firebase/auth";
import TaskOperationErrorAlert from "./TaskOperationErrorAlert";
import { describeTaskError, TaskOperationError } from "../taskErrors";
export type { TaskComment, MemberProfile, TaskItem };

interface TaskCommentsSectionProps {
  task: TaskItem;
  canEdit: boolean;
  user: User | null;
  teamProfiles: MemberProfile[];
  setSyncState?: (state: "idle" | "syncing" | "success" | "error") => void;
}

export default function TaskCommentsSection({
  task,
  canEdit,
  user,
  teamProfiles,
  setSyncState,
}: TaskCommentsSectionProps) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [operationError, setOperationError] = useState<TaskOperationError | null>(null);

  useEffect(() => {
    const commentsRef = collection(db, "tasks", task.id, "comments");
    const unsubscribe = onSnapshot(
      commentsRef,
      (snapshot) => {
        const list = snapshot.docs.map((commentDoc) => {
          const data = commentDoc.data();
          return {
            id: commentDoc.id,
            author: data.author || "Team Member",
            authorUid: typeof data.authorUid === "string" ? data.authorUid : undefined,
            content: data.content || "",
            createdAt: data.createdAt || new Date().toISOString(),
            source: data.source || "web",
          } as TaskComment;
        });
        list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        setComments(list);
      },
      (error) => {
        logger.error(`Unable to load comments for task ${task.id}:`, error);
        setOperationError(describeTaskError("load task comments", error));
      }
    );
    return () => unsubscribe();
  }, [task.id]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submitting || !canEdit || !user) return;

    setSubmitting(true);
    const myProfile = teamProfiles.find((p) => p.uid === user?.uid);
    const authorNickname = myProfile?.nickname || "Team Member";

    const commentId = `comment_${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
    const commentPayload = {
      id: commentId,
      author: authorNickname,
      authorUid: user.uid,
      content: newComment.trim(),
      createdAt: new Date().toISOString(),
      source: "web" as const,
    };

    try {
      const taskRef = doc(db, "tasks", task.id);
      const commentRef = doc(db, "tasks", task.id, "comments", commentId);
      const batch = writeBatch(db);
      batch.set(commentRef, commentPayload);
      batch.update(taskRef, { commentsCount: increment(1) });
      await batch.commit();
      setNewComment("");
      setOperationError(null);

      // Forward to Zulip stream
      if (setSyncState) setSyncState("syncing");
      authenticatedFetch("/api/tasks/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.id,
          content: commentPayload.content,
        }),
      }).then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        if (setSyncState) setSyncState("success");
        setTimeout(() => {
          if (setSyncState) setSyncState("idle");
        }, 3000);
      }).catch((err) => {
        logger.error("Zulip notification failed:", err);
        const notificationError = describeTaskError("notify Zulip", err);
        setOperationError({
          ...notificationError,
          message: "The comment was saved, but its Zulip notification failed. Retry from Zulip if teammates need an immediate alert.",
        });
        if (setSyncState) setSyncState("error");
        setTimeout(() => {
          if (setSyncState) setSyncState("idle");
        }, 3000);
      });
    } catch (err) {
      logger.error("Failed to add comment:", err);
      setOperationError(describeTaskError("post comment", err));
    } finally {
      setSubmitting(false);
    }
  };

  const commentsCount = comments.length;

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
          {operationError && (
            <TaskOperationErrorAlert error={operationError} onDismiss={() => setOperationError(null)} />
          )}
          {commentsCount > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-2 pr-1.5 scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent">
              {comments.map((comment) => (
                <div key={comment.id} className="text-[11px] bg-black/45 p-2.5 rounded-lg border border-white/5">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="font-extrabold text-white">
                      {comment.authorUid
                        ? teamProfiles.find((profile) => profile.uid === comment.authorUid)?.nickname || "Team Member"
                        : comment.author?.includes("@") ? "Team Member" : comment.author || "Team Member"}
                    </span>
                    <span className="text-marble/30 text-[9px] flex items-center gap-1">
                      {comment.source === "zulip" && (
                        <span className="text-ares-gold font-bold tracking-wider">[ZULIP]</span>
                      )}
                      {new Date(comment.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-marble/75 leading-relaxed break-words">{comment.content}</p>
                </div>
              ))}
            </div>
          )}

          {canEdit && (
            <form onSubmit={handlePostComment} className="flex gap-1.5 mt-2">
              <label htmlFor={`task-comment-${task.id}`} className="sr-only">
                Add a comment to {task.title}
              </label>
              <input
                id={`task-comment-${task.id}`}
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
                className="bg-ares-red hover:bg-ares-bronze text-white px-3 py-1.5 rounded transition-all text-xs font-bold cursor-pointer disabled:opacity-50 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
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
