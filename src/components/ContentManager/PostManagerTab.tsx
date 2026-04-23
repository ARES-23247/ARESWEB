import { useState } from "react";
import { format } from "date-fns";
import { Radio, FileText } from "lucide-react";
import DashboardEmptyState from "../dashboard/DashboardEmptyState";
import { useQuery } from "@tanstack/react-query";
import { useContentMutation } from "../../hooks/useContentMutation";
import { PostItem, ViewType, ClickToDeleteButton, contentFilter, ContentMutationResult } from "./shared";
import RevisionManager from "../RevisionManager";
import { adminApi } from "../../api/adminApi";

interface PostManagerTabProps {
  view: ViewType;
  onEditPost?: (slug: string) => void;
  confirmId: string | null;
  setConfirmId: (id: string | null) => void;
  broadcastData: { isOpen: boolean, id: string };
  setBroadcastData: (data: { isOpen: boolean, type: "blog" | "event", id: string, title: string }) => void;
  approveMutation: ContentMutationResult;
  rejectMutation: ContentMutationResult;
  restoreMutation: ContentMutationResult;
  purgeMutation: ContentMutationResult;
}

export default function PostManagerTab({
  view,
  onEditPost,
  confirmId,
  setConfirmId,
  broadcastData,
  setBroadcastData,
  approveMutation,
  rejectMutation,
  restoreMutation,
  purgeMutation
}: PostManagerTabProps) {
  const [historyTarget, setHistoryTarget] = useState<{ slug: string, title: string } | null>(null);
  const { data: posts = [], isLoading, isError } = useQuery<PostItem[]>({
    queryKey: ["posts"],
    queryFn: async () => {
      const data = await adminApi.get<{ posts?: PostItem[] }>("/api/admin/posts/list");
      return data.posts ?? [];
    },
  });

  const deletePostMutation = useContentMutation<string>({
    endpoint: (slug) => `/api/admin/posts/${slug}`,
    invalidateKeys: ["posts"],
    setConfirmId,
  });

  if (isLoading) return <div className="h-32 flex items-center justify-center"><div className="w-6 h-6 border-2 border-white/10 border-t-ares-red rounded-full animate-spin"></div></div>;
  if (isError) return <div className="h-32 flex flex-col items-center justify-center text-ares-red gap-2"><p className="font-bold">FAILED TO LOAD POSTS</p><p className="text-[10px] text-marble/40">The database query failed. Check console for details.</p></div>;


  const filtered = posts.filter(contentFilter(view));

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <h3 className={`font-bold uppercase tracking-widest text-xs mb-4 border-b border-white/10 pb-2 ${view === 'trash' ? 'text-ares-red' : view === 'pending' ? 'text-ares-gold' : 'text-marble'}`}>
         {view === 'active' ? 'Published Blog Posts' : view === 'pending' ? 'Pending Posts' : 'Trashed Posts'}
      </h3>
      <div className="flex flex-col gap-3 overflow-y-auto flex-1 min-h-0 pr-2 custom-scrollbar">
        {filtered.length === 0 ? (
          <DashboardEmptyState
            className="text-marble/50 text-xs italic py-8 text-center border border-dashed border-white/5 ares-cut-sm"
            icon={<FileText size={24} />}
            message={`No ${view} posts found.`}
          />
        ) : (
          filtered.map((post) => (
            <div key={post.slug} className={`bg-black/40 border ${Number(post.is_deleted) === 1 ? 'border-ares-red/30 bg-ares-red/[0.02]' : 'border-white/10'} ares-cut-sm p-4 flex flex-col justify-between gap-4 hover:border-white/20 transition-colors`}>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-marble/90 truncate flex items-center gap-2">
                  {post.title}
                  {Number(post.is_deleted) === 1 && <span className="text-[9px] font-bold text-ares-red bg-ares-red/10 border border-ares-red/20 px-1.5 py-0.5 rounded uppercase tracking-wider">Deleted</span>}
                  {post.revision_of && <span className="text-[9px] font-bold text-ares-gold bg-ares-gold/10 border border-ares-gold/20 px-1.5 py-0.5 rounded uppercase tracking-wider">Revision</span>}
                  {post.status === 'rejected' && <span className="text-[9px] font-bold text-ares-bronze bg-ares-bronze/10 border border-ares-bronze/20 px-1.5 py-0.5 rounded uppercase tracking-wider">Rejected</span>}
                  {post.status === 'draft' && <span className="text-[9px] font-bold text-ares-gold bg-ares-gold/10 border border-ares-gold/20 px-1.5 py-0.5 rounded uppercase tracking-wider">Draft</span>}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-marble/40 bg-obsidian border border-white/10 px-2 py-0.5 ares-cut-sm">{format(new Date(post.date), 'MMM do, yyyy')}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
                {Number(post.is_deleted) !== 1 ? (
                  <>
                    <button
                      onClick={() => onEditPost && onEditPost(post.slug)}
                      className="text-xs font-bold text-marble/40 hover:text-ares-cyan bg-white/5 hover:bg-white/10 px-3 py-1 ares-cut-sm transition-colors"
                    >
                      EDIT
                    </button>
                    {view === 'active' && (
                      <button
                        onClick={() => setHistoryTarget({ slug: post.slug, title: post.title })}
                        className="text-xs font-bold text-marble/40 hover:text-ares-gold bg-white/5 hover:bg-white/10 px-3 py-1 ares-cut-sm transition-colors"
                      >
                        HISTORY
                      </button>
                    )}
                    {view === 'pending' ? (
                      <>
                      <button
                        onClick={() => approveMutation.mutate({ type: 'post', id: post.slug })}
                        disabled={approveMutation.isPending}
                        className="text-xs font-bold text-ares-cyan hover:text-white bg-ares-cyan/10 hover:bg-ares-cyan/40 border border-ares-cyan/20 px-3 py-1 ares-cut-sm transition-colors disabled:opacity-50"
                      >
                        APPROVE
                      </button>
                      <button
                        onClick={() => rejectMutation.mutate({ type: 'post', id: post.slug })}
                        disabled={rejectMutation.isPending}
                        className="text-xs font-bold text-ares-red hover:text-white bg-ares-red/10 hover:bg-ares-red/40 border border-ares-red/20 px-3 py-1 ares-cut-sm transition-colors disabled:opacity-50"
                      >
                        REJECT
                      </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setBroadcastData({ isOpen: true, type: "blog", id: post.slug, title: post.title })}
                        className="text-xs font-bold text-ares-gold/80 hover:text-ares-gold border border-ares-gold/20 hover:bg-ares-gold/10 px-3 py-1 ares-cut-sm transition-all flex items-center gap-1.5"
                      >
                        <Radio size={12} className={broadcastData.isOpen && broadcastData.id === post.slug ? "animate-pulse" : ""} />
                        SEND
                      </button>
                    )}
                    <ClickToDeleteButton 
                      id={post.slug} 
                      onDelete={() => deletePostMutation.mutate(post.slug)} 
                      isDeleting={deletePostMutation.isPending && deletePostMutation.variables === post.slug} 
                      confirmId={confirmId}
                      setConfirmId={setConfirmId}
                    />
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => restoreMutation.mutate({ type: 'post', id: post.slug })}
                      disabled={restoreMutation.isPending}
                      className="text-xs font-bold text-ares-cyan bg-ares-cyan/10 hover:bg-ares-cyan/20 px-3 py-1 ares-cut-sm transition-colors"
                    >
                     {restoreMutation.isPending && restoreMutation.variables?.id === post.slug ? "RESTORING..." : "RESTORE"}
                    </button>
                    <ClickToDeleteButton 
                      id={`purge-${post.slug}`} 
                      onDelete={() => purgeMutation.mutate({ type: 'post', id: post.slug })} 
                      isDeleting={purgeMutation.isPending && purgeMutation.variables?.id === post.slug} 
                      confirmId={confirmId}
                      setConfirmId={setConfirmId}
                    />
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <RevisionManager 
        isOpen={!!historyTarget}
        onClose={() => setHistoryTarget(null)}
        type="post"
        slug={historyTarget?.slug || ""}
        displayTitle={historyTarget?.title || ""}
      />
    </div>
  );
}
