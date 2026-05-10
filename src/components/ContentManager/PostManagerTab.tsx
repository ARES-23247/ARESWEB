
import { useState } from "react";
import { format } from "date-fns";
import { Radio, FileText } from "lucide-react";
import { toast } from "sonner";
import { PostItem, ViewType, contentFilter } from "./shared";
import RevisionManager from "../RevisionManager";
import {
  useGetAdminPosts,
  useDeletePost,
  useApprovePost,
  useRejectPost,
  useUndeletePost,
  usePurgePost,
} from "../../api/posts";
import GenericManagerList from "./GenericManagerList";

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
  const [historyTarget, setHistoryTarget] = useState<{ slug: string, title: string } | null>(null);

  const { data, isLoading, isError, error } = useGetAdminPosts();

  const posts = (data?.posts || []) as unknown as PostItem[];
  const errorMessage = error instanceof Error ? error.message : "Failed to load posts";

  const deleteMutation = useDeletePost({
    onSuccess: () => {
      setConfirmId(null);
      toast.success("Post deleted");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Delete failed");
    }
  });

  const localApproveMutation = useApprovePost({
    onSuccess: () => {
      toast.success("Post approved");
    }
  });

  const localRejectMutation = useRejectPost({
    onSuccess: () => {
      toast.success("Post rejected");
    }
  });

  const localRestoreMutation = useUndeletePost({
    onSuccess: () => {
      toast.success("Post restored");
    }
  });

  const localPurgeMutation = usePurgePost({
    onSuccess: () => {
      toast.success("Post purged");
    }
  });

  const filtered = posts.filter(contentFilter(view));

  return (
    <>
      <GenericManagerList
        items={filtered}
        rawCount={posts.length}
        view={view}
        isLoading={isLoading}
        isError={isError}
        errorMessage={errorMessage}
        emptyIcon={<FileText size={24} />}
        emptyMessage={`No ${view} posts found.`}
        headerTitle={
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40 px-1 flex items-center gap-2">
            <Radio size={12} className={isLoading ? "animate-pulse text-ares-red" : "text-ares-red"} />
            Post Registry
            {isError && (
              <span className="ml-auto text-[9px] text-ares-red animate-pulse flex items-center gap-1 font-bold">
                TELEMETRY FAULT
              </span>
            )}
          </h3>
        }
        getItemId={(p) => p.slug}
        isItemDeleted={(p) => Number(p.isDeleted) === 1}
        isItemRevision={(p) => !!p.revisionOf}
        getItemStatus={(p) => p.status}
        renderTitle={(p) => p.title}
        renderSubtitle={(p) => (
          <span className="text-xs text-marble/60 bg-obsidian border border-white/10 px-2 py-0.5 ares-cut-sm">
            {format(new Date(p.date), 'MMM do, yyyy')}
          </span>
        )}
        renderCustomActions={(p) => (
          <button
            onClick={() => setBroadcastData({ isOpen: true, type: "blog", id: p.slug, title: p.title })}
            className="text-xs font-bold text-ares-gold/80 hover:text-ares-gold border border-ares-gold/20 hover:bg-ares-gold/10 px-3 py-1 ares-cut-sm transition-all flex items-center gap-1.5"
          >
            <Radio size={12} className={broadcastData.isOpen && broadcastData.id === p.slug ? "animate-pulse" : ""} />
            SEND
          </button>
        )}
        onEdit={onEditPost ? (p) => onEditPost(p.slug) : undefined}
        onHistory={(p) => setHistoryTarget({ slug: p.slug, title: p.title })}
        onApprove={(p) => localApproveMutation.mutate(p.slug)}
        isApprovePending={() => localApproveMutation.isPending}
        onReject={(p) => localRejectMutation.mutate({ slug: p.slug })}
        isRejectPending={() => localRejectMutation.isPending}
        onDelete={(p) => deleteMutation.mutate(p.slug)}
        isDeletePending={(p) => deleteMutation.isPending && deleteMutation.variables === p.slug}
        onRestore={(p) => localRestoreMutation.mutate(p.slug)}
        isRestorePending={(p) => localRestoreMutation.isPending && localRestoreMutation.variables === p.slug}
        onPurge={(p) => localPurgeMutation.mutate(p.slug)}
        isPurgePending={(p) => localPurgeMutation.isPending && localPurgeMutation.variables === p.slug}
        confirmId={confirmId}
        setConfirmId={setConfirmId}
      />
      
      <RevisionManager 
        isOpen={!!historyTarget}
        onClose={() => setHistoryTarget(null)}
        type="post"
        slug={historyTarget?.slug || ""}
        displayTitle={historyTarget?.title || ""}
      />
    </>
  );
}

