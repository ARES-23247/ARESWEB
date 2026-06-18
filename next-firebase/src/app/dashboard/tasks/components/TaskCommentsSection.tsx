import React, { useEffect, useState } from "react";
import { collection, doc, onSnapshot, setDoc, updateDoc, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { MessageSquare } from "lucide-react";
import { authenticatedFetch } from "@/lib/api";

export interface TaskComment {
  id: string;
  author: string;
  content: string;
  createdAt: string;
  source: "web" | "zulip";
}

export interface MemberProfile {
  uid: string;
  email?: string;
  nickname: string;
  avatar: string;
}

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "review" | "completed";
  priority: "low" | "medium" | "high";
  subteam: "software" | "hardware" | "business" | "outreach";
  assignees: string[];
  subtasks: any[];
  createdAt: string;
  comments?: TaskComment[];
  commentsCount?: number;
}

interface TaskCommentsSectionProps {
  task: TaskItem;
  canEdit: boolean;
  user: any;
  teamProfiles: MemberProfile[];
}

export default function TaskCommentsSection({
  task,
  canEdit,
  user,
  teamProfiles,
}: TaskCommentsSectionProps) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const commentsRef = collection(db, "tasks", task.id, "comments");
    const unsubscribe = onSnapshot(commentsRef, (snapshot) => {
      const list = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          author: data.author || "Team Member",
          content: data.content || "",
          createdAt: data.createdAt || new Date().toISOString(),
          source: data.source || "web",
        } as TaskComment;
      });
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setComments(list);
    });
    return () => unsubscribe();
  }, [task.id]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submitting || !canEdit) return;

    setSubmitting(true);
    const myProfile = teamProfiles.find(
      (p) =>
        p.uid === user?.uid ||
        (user?.email && p.email && p.email.toLowerCase() === user.email.toLowerCase())
    );
    const authorNickname = myProfile?.nickname || "Team Member";

    const commentId = `comment_${Date.now()}`;
    const commentPayload = {
      id: commentId,
      author: authorNickname,
      content: newComment.trim(),
      createdAt: new Date().toISOString(),
      source: "web" as const,
    };

    try {
      const taskRef = doc(db, "tasks", task.id);
      const commentRef = doc(db, "tasks", task.id, "comments", commentId);

      await setDoc(commentRef, commentPayload);
      await updateDoc(taskRef, {
        commentsCount: increment(1),
      });
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
          {commentsCount > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-2 pr-1.5 scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent">
              {comments.map((comment) => (
                <div key={comment.id} className="text-[11px] bg-black/45 p-2.5 rounded-lg border border-white/5">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="font-extrabold text-white">
                      {comment.author?.includes("@") ? "Team Member" : comment.author || "Team Member"}
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
