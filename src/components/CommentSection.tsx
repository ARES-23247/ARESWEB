import { useState, useEffect, useCallback } from "react";
import { MessageCircle, Send, Trash2, RefreshCw } from "lucide-react";

interface Comment {
  id: number;
  user_id: string;
  nickname: string;
  avatar: string;
  content: string;
  created_at: string;
  is_own: boolean;
  is_deleted: number;
}

interface CommentSectionProps {
  targetType: "post" | "event" | "doc";
  targetId: string;
  isAdmin?: boolean;
}

export default function CommentSection({ targetType, targetId, isAdmin }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  const fetchComments = useCallback(() => {
    fetch(`/api/comments/${targetType}/${targetId}`, { credentials: "include" })
      .then(r => r.json())
      .then((data) => {
        const typed = data as { comments: Comment[]; authenticated: boolean; role: string | null };
        setComments(typed.comments || []);
        setIsAuthenticated(typed.authenticated);
        setUserRole(typed.role);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [targetType, targetId]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  const submitComment = async () => {
    if (!newComment.trim()) return;
    setPosting(true);
    await fetch(`/api/comments/${targetType}/${targetId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ content: newComment }),
    });
    setNewComment("");
    setPosting(false);
    fetchComments();
  };

  const deleteComment = async (id: number) => {
    await fetch(`/api/admin/comments/${id}`, { method: "DELETE", credentials: "include" });
    fetchComments();
  };

  if (loading) return null;

  return (
    <div className="mt-12 border-t border-zinc-800 pt-8">
      <h3 className="text-lg font-black flex items-center gap-2 mb-6">
        <MessageCircle size={20} className="text-ares-red" />
        Discussion ({comments.filter(c => !c.is_deleted).length})
      </h3>

      {isAuthenticated ? (
        userRole === "unverified" ? (
          <div className="mb-8 p-6 bg-ares-red/5 border border-ares-red/20 rounded-2xl text-center">
            <p className="text-sm text-zinc-300 mb-2">
              <span className="text-ares-red font-bold">Account Verification Pending</span>
            </p>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              Your account is pending team verification. Once an admin confirms your membership, you'll be able to join the conversation.
            </p>
          </div>
        ) : (
          <div className="flex gap-3 mb-8">
            <textarea
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Share your thoughts..."
              className="flex-1 bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-ares-red resize-none min-h-[60px]"
            />
            <button onClick={submitComment} disabled={posting || !newComment.trim()}
              className="px-4 bg-ares-red hover:bg-red-700 text-white rounded-xl font-bold text-sm disabled:opacity-50 transition-colors flex items-center gap-1.5 self-end h-[60px]"
            >
              {posting ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
              Post
            </button>
          </div>
        )
      ) : (
        <div className="mb-8 p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl text-center text-sm text-zinc-500">
          <a href="/login" className="text-ares-red hover:text-red-400 font-bold">Sign in</a> to join the conversation.
        </div>
      )}

      <div className="space-y-4">
        {comments.filter(c => !c.is_deleted).map(comment => (
          <div key={comment.id} className="flex gap-3 group">
            <img src={comment.avatar || `https://api.dicebear.com/9.x/bottts/svg?seed=${comment.user_id}`}
              alt="" className="w-8 h-8 rounded-lg bg-zinc-800 flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-bold text-white">{comment.nickname || "ARES Member"}</span>
                <span className="text-[10px] text-zinc-600">{new Date(comment.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-sm text-zinc-300 leading-relaxed">{comment.content}</p>
            </div>
            {(isAdmin || comment.is_own) && (
              <button onClick={() => deleteComment(comment.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-zinc-600 hover:text-red-500">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
