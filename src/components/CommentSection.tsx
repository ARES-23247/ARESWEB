import { useState, useEffect, useCallback } from "react";
import { MessageCircle, Send, Trash2, RefreshCw, Pencil, Check, X } from "lucide-react";
import { publicApi } from "../api/publicApi";
import { commentSchema } from "../schemas/commentSchema";

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

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");

  const fetchComments = useCallback(() => {
    publicApi.get<{ comments: Comment[]; authenticated: boolean; role: string | null }>(`/api/comments/${targetType}/${targetId}`)
      .then((data) => {
        setComments(data.comments || []);
        setIsAuthenticated(data.authenticated);
        setUserRole(data.role);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [targetType, targetId]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  const submitComment = async () => {
    if (!newComment.trim()) return;
    setPosting(true);
    try {
      const payloadResult = commentSchema.safeParse({ content: newComment });
      if (!payloadResult.success) throw new Error(payloadResult.error.issues[0].message);
      await publicApi.submitComment(targetType, targetId, payloadResult.data);
      setNewComment("");
      fetchComments();
    } catch (e) {
      console.error(e);
    } finally {
      setPosting(false);
    }
  };

  const deleteComment = async (id: number) => {
    await publicApi.deleteComment(id.toString());
    fetchComments();
  };

  const saveEdit = async (id: number) => {
    if (!editContent.trim()) return;
    try {
      const payloadResult = commentSchema.safeParse({ content: editContent });
      if (!payloadResult.success) throw new Error(payloadResult.error.issues[0].message);
      await publicApi.updateComment(id.toString(), payloadResult.data);
      setEditingId(null);
      fetchComments();
    } catch(e) {
      console.error(e);
    }
  };

  if (loading) return null;

  return (
    <div className="mt-12 border-t border-white/5 pt-8">
      <h3 className="text-lg font-black flex items-center gap-2 mb-6">
        <MessageCircle size={20} className="text-ares-red" />
        Discussion ({comments.filter(c => !c.is_deleted).length})
      </h3>

      {isAuthenticated && userRole !== "unverified" ? (
        <div className="space-y-4">
          <div className="flex gap-3 mb-8">
            <textarea
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Share your thoughts..."
              className="flex-1 bg-white/5 border border-white/10 ares-cut-sm px-4 py-3 text-sm text-white placeholder-marble/40 focus:outline-none focus:border-ares-red resize-none min-h-[60px]"
            />
            <button onClick={submitComment} disabled={posting || !newComment.trim()}
              className="px-4 bg-ares-red hover:bg-ares-bronze text-white ares-cut-sm font-bold text-sm disabled:opacity-50 transition-colors flex items-center gap-1.5 self-end h-[60px]"
            >
              {posting ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
              Post
            </button>
          </div>

          <div className="space-y-4">
            {comments.filter(c => !c.is_deleted).map(comment => {
              const isEditing = editingId === comment.id;
              const userCanModify = isAdmin || comment.is_own;

              return (
                <div key={comment.id} className="flex gap-3 group">
                  <img src={comment.avatar || `https://api.dicebear.com/9.x/bottts/svg?seed=${comment.user_id}`}
                    alt="" className="w-8 h-8 ares-cut-sm bg-white/5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-white">{comment.nickname || "ARES Member"}</span>
                      <span className="text-[10px] text-marble/30">{new Date(comment.created_at).toLocaleDateString()}</span>
                      {userCanModify && !isEditing && (
                        <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingId(comment.id); setEditContent(comment.content); }}
                            className="p-1 text-marble/40 hover:text-white transition-colors">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => deleteComment(comment.id)}
                            className="p-1 text-marble/40 hover:text-ares-red transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                    {isEditing ? (
                      <div className="mt-2 flex gap-2">
                        <textarea
                          value={editContent}
                          onChange={e => setEditContent(e.target.value)}
                          className="flex-1 bg-white/5 border border-white/10 ares-cut-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-ares-red resize-none min-h-[60px]"
                        />
                        <div className="flex flex-col gap-2">
                          <button onClick={() => saveEdit(comment.id)} disabled={!editContent.trim() || editContent === comment.content}
                            className="p-2 bg-white/5 hover:bg-ares-cyan/20 text-ares-cyan ares-cut-sm transition-colors disabled:opacity-50">
                            <Check size={16} />
                          </button>
                          <button onClick={() => setEditingId(null)}
                            className="p-2 bg-white/5 hover:bg-white/10 text-marble/40 ares-cut-sm transition-colors">
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-marble/70 leading-relaxed whitespace-pre-wrap">{comment.content}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mb-8 p-6 bg-white/5 border border-white/10 ares-cut text-center">
          <p className="text-sm text-marble/70 mb-2">
            <span className="text-ares-red font-bold">Verified Access Required</span>
          </p>
          <p className="text-sm text-marble/40 max-w-md mx-auto mb-6">
            Discussions are strictly restricted to verified ARES members to protect privacy.
          </p>
          {!isAuthenticated ? (
            <div>
              <a href="/login" className="px-5 py-2.5 bg-ares-red hover:bg-ares-bronze text-white ares-cut-sm font-bold text-sm inline-block transition-colors">
                Sign in with ARES ID
              </a>
              <p className="text-xs text-marble/30 mt-5">
                Don&apos;t have an ARES ID? <a href="/about" className="text-ares-red hover:underline">Contact us</a>
              </p>
            </div>
          ) : (
            <p className="text-xs text-marble/40 max-w-sm mx-auto">
              Your account is pending team verification. If you have any questions, <a href="/about" className="text-ares-red hover:underline">contact us</a>.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
