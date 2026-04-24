/* eslint-disable @typescript-eslint/no-explicit-any */
import { format } from "date-fns";
import { History, RotateCcw, X, Clock } from "lucide-react";
import { toast } from "sonner";
import { api } from "../api/client";
import { useQueryClient } from "@tanstack/react-query";

export interface Revision {
  id: number;
  title: string;
  author_email: string;
  created_at: string;
  category?: string;
  author?: string;
}

interface RevisionManagerProps {
  isOpen: boolean;
  onClose: () => void;
  type: "doc" | "post";
  slug: string;
  displayTitle: string;
}

export default function RevisionManager({ isOpen, onClose, type, slug, displayTitle }: RevisionManagerProps) {
  const queryClient = useQueryClient();

  const historyQuery = type === "post" 
    ? api.posts.getPostHistory.useQuery(["history", "post", slug], {
        params: { slug },
      }, {
        enabled: isOpen && !!slug && type === "post"
      })
    : api.docs.getHistory.useQuery(["history", "doc", slug], {
        params: { slug },
      }, {
        enabled: isOpen && !!slug && type === "doc"
      });

  const postRestoreMutation = api.posts.restorePostHistory.useMutation({
    onSuccess: () => {
      toast.success("Post restored successfully");
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      onClose();
    },
    onError: (err: any) => toast.error(err.message || "Post restoration failed")
  });

  const docRestoreMutation = api.docs.restoreHistory.useMutation({
    onSuccess: () => {
      toast.success("Doc restored successfully");
      queryClient.invalidateQueries({ queryKey: ["docs"] });
      onClose();
    },
    onError: (err: any) => toast.error(err.message || "Doc restoration failed")
  });

  const isLoading = historyQuery.isLoading;
  const isError = historyQuery.isError;
  const revisions = historyQuery.data?.status === 200 ? (historyQuery.data.body as { history: Revision[] }).history : [];

  const restoreRevision = (id: number) => {
    if (type === "post") {
      postRestoreMutation.mutate({ params: { slug, id: id.toString() }, body: {} });
    } else {
      docRestoreMutation.mutate({ params: { slug, id: id.toString() }, body: {} });
    }
  };

  const isRestoring = postRestoreMutation.isPending || docRestoreMutation.isPending;
   
  const restoringId = (postRestoreMutation.variables as any)?.params?.id || (docRestoreMutation.variables as any)?.params?.id;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-obsidian border border-white/10 ares-cut-lg w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 ares-cut-sm bg-ares-gold/10 flex items-center justify-center text-ares-gold">
              <History size={20} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white tracking-tight">Revision History</h3>
              <p className="text-white/60 text-xs">Viewing legacy versions for <span className="text-white font-mono italic">&quot;{displayTitle}&quot;</span></p>
            </div>
          </div>
          <button onClick={onClose} title="Close history" className="text-white/60 hover:text-white transition-colors p-2 bg-white/5 border border-white/10 ares-cut-sm">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {isError && (
            <div className="bg-ares-red/10 border border-ares-red/30 p-4 ares-cut-sm text-ares-red text-xs font-bold mb-6 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-ares-red animate-pulse" />
              TELEMETRY FAULT: Failed to retrieve archive timeline.
            </div>
          )}
          {isLoading ? (
            <div className="h-48 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-white/10 border-t-ares-gold rounded-full animate-spin"></div>
            </div>
          ) : revisions.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-white/60">
               <Clock size={32} className="mb-2 opacity-20" />
               <p className="text-sm italic">No legacy revisions found for this entry.</p>
               <p className="text-xs mt-1 text-white/60">History is captured automatically whenever an admin modifies content.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {revisions.map((rev) => (
                <div key={rev.id} className="bg-white/5 border border-white/10 ares-cut p-4 flex items-center justify-between hover:border-white/20 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-white truncate">{rev.title}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-white/60 bg-black/40 border border-white/10 px-2 py-0.5 ares-cut-sm">
                        {format(new Date(rev.created_at), 'MMM do, yyyy @ HH:mm')}
                      </span>
                      <span className="text-xs text-ares-cyan truncate max-w-[150px]">
                        By {rev.author_email}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                        if (confirm(`Are you sure you want to restore "${displayTitle}" to the version from ${format(new Date(rev.created_at), 'PPP')}? Current unsaved changes might be lost if you haven't saved.`)) {
                           restoreRevision(rev.id);
                        }
                    }}
                    disabled={isRestoring}
                    className="flex items-center gap-2 text-xs font-bold text-ares-gold bg-ares-gold/10 hover:bg-ares-gold/20 border border-ares-gold/20 px-4 py-2 ares-cut-sm transition-all"
                  >
                    <RotateCcw size={14} className={isRestoring && restoringId === rev.id.toString() ? "animate-spin" : ""} />
                    {isRestoring && restoringId === rev.id.toString() ? "RESTORING..." : "RESTORE"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 bg-white/5 border-t border-white/10 flex items-center justify-center">
            <p className="text-xs text-white/60 uppercase tracking-widest font-mono">End of Revision Timeline</p>
        </div>
      </div>
    </div>
  );
}
