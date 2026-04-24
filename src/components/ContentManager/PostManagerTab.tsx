/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { format } from "date-fns";
import { Radio, FileText } from "lucide-react";
import DashboardEmptyState from "../dashboard/DashboardEmptyState";
import { PostItem, ViewType, ClickToDeleteButton, contentFilter } from "./shared";
import RevisionManager from "../RevisionManager";
import { api } from "../../api/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface PostManagerTabProps {
  view: ViewType;
  onEditPost?: (slug: string) => void;
  confirmId: string | null;
  setConfirmId: (id: string | null) => void;
  broadcastData: { isOpen: boolean, id: string };
  setBroadcastData: (data: { isOpen: boolean, type: "blog" | "event", id: string, title: string }) => void;
}

export default function PostManagerTab({
  view,
  onEditPost,
  confirmId,
  setConfirmId,
  broadcastData,
  setBroadcastData,
}: PostManagerTabProps) {
  const queryClient = useQueryClient();
  const [historyTarget, setHistoryTarget] = useState<{ slug: string, title: string } | null>(null);
  
  const { data, isLoading, isError } = api.posts.getAdminPosts.useQuery(["admin_posts"], {});

  const rawBody = (data as any)?.body;
  const posts = data?.status === 200 ? (Array.isArray(rawBody) ? rawBody : (Array.isArray(rawBody?.posts) ? rawBody.posts : [])) as unknown as PostItem[] : [];

  const deleteMutation = api.posts.deletePost.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      setConfirmId(null);
      toast.success("Post deleted");
    },
    onError: (err: any) => {
      toast.error(err.message || "Delete failed");
    }
  });

  const localApproveMutation = api.posts.approvePost.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast.success("Post approved");
    }
  });

  const localRejectMutation = api.posts.rejectPost.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast.success("Post rejected");
    }
  });

  const localRestoreMutation = api.posts.undeletePost.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast.success("Post restored");
    }
  });

  const localPurgeMutation = api.posts.purgePost.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast.success("Post purged");
    }
  });

  if (isLoading) return <div className="h-32 flex items-center justify-center"><div className="w-6 h-6 border-2 border-white/10 border-t-ares-red rounded-full animate-spin"></div></div>;

  const filtered = posts.filter(contentFilter(view));

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40 mb-4 px-1 flex items-center gap-2">
        <Radio size={12} className={isLoading ? "animate-pulse text-ares-red" : "text-ares-red"} />
        Post Registry
        {isError && (
          <span className="ml-auto text-[9px] text-ares-red animate-pulse flex items-center gap-1">
            TELEMETRY FAULT
          </span>
        )}
      </h3>

      <div className="text-xs text-marble/20 mb-2 px-1 flex justify-between items-center font-mono uppercase tracking-widest border-b border-white/5 pb-1">
        <span>VIEW: {view} | RAW: {posts.length} | FILTERED: {filtered.length}</span>
        {isError && <span className="text-ares-red font-bold">API ERROR!</span>}
      </div>
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
                        onClick={() => localApproveMutation.mutate({ params: { slug: post.slug }, body: {} })}
                        disabled={localApproveMutation.isPending}
                        className="text-xs font-bold text-ares-cyan hover:text-white bg-ares-cyan/10 hover:bg-ares-cyan/40 border border-ares-cyan/20 px-3 py-1 ares-cut-sm transition-colors disabled:opacity-50"
                      >
                        APPROVE
                      </button>
                      <button
                        onClick={() => localRejectMutation.mutate({ params: { slug: post.slug }, body: {} })}
                        disabled={localRejectMutation.isPending}
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
                      onDelete={() => deleteMutation.mutate({ params: { slug: post.slug }, body: {} })} 
                       
                      isDeleting={deleteMutation.isPending && (deleteMutation.variables as any)?.params?.slug === post.slug} 
                      confirmId={confirmId}
                      setConfirmId={setConfirmId}
                    />
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => localRestoreMutation.mutate({ params: { slug: post.slug }, body: {} })}
                      disabled={localRestoreMutation.isPending}
                      className="text-xs font-bold text-ares-cyan bg-ares-cyan/10 hover:bg-ares-cyan/20 px-3 py-1 ares-cut-sm transition-colors"
                    >
                      { }
                     {(localRestoreMutation.isPending && (localRestoreMutation.variables as any)?.params?.slug === post.slug) ? "RESTORING..." : "RESTORE"}
                    </button>
                    <ClickToDeleteButton 
                      id={`purge-${post.slug}`} 
                      onDelete={() => localPurgeMutation.mutate({ params: { slug: post.slug }, body: {} })} 
                       
                      isDeleting={localPurgeMutation.isPending && (localPurgeMutation.variables as any)?.params?.slug === post.slug} 
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
