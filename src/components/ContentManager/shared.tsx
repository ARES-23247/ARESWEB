export type ViewType = "active" | "trash" | "pending" | "internal" | "outreach" | "external" | "all";

export interface ContentMutationResult {
  mutate: (variables: { type: 'event' | 'post' | 'doc' | 'season'; id: string }) => void;
  isPending: boolean;
  variables: { type: 'event' | 'post' | 'doc' | 'season'; id: string } | undefined;
}

export interface EventItem {
  id: string;
  title: string;
  dateStart: string;
  cfEmail?: string;
  isDeleted?: number;
  status?: string;
  revisionOf?: string;
  category?: string;
}

export interface PostItem {
  slug: string;
  title: string;
  date: string;
  cfEmail?: string;
  isDeleted?: number;
  status?: string;
  revisionOf?: string;
}

export interface DocItem {
  slug: string;
  title: string;
  category: string;
  sortOrder: number;
  isDeleted?: number;
  isPortfolio?: number;
  isExecutiveSummary?: number;
  status?: string;
  revisionOf?: string;
}

export const ClickToDeleteButton = ({ 
  id, 
  onDelete, 
  isDeleting,
  confirmId,
  setConfirmId
}: { 
  id: string; 
  onDelete: () => void; 
  isDeleting: boolean; 
  confirmId: string | null;
  setConfirmId: (id: string | null) => void;
}) => {
  const isConfirming = confirmId === id;

  if (isDeleting) {
    return (
      <button disabled className="text-xs font-bold text-marble/90 bg-white/5 px-3 py-1 ares-cut-sm opacity-50 cursor-not-allowed">
        DELETING...
      </button>
    );
  }

  if (isConfirming) {
    return (
      <button
        onClick={onDelete}
        className="text-xs font-bold text-white bg-ares-red hover:bg-ares-red/80 px-3 py-1 ares-cut-sm shadow-[0_0_20px_rgba(204,0,0,0.4)] transition-all animate-pulse focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        CONFIRM DELETE
      </button>
    );
  }

  return (
    <button
      onClick={() => setConfirmId(id)}
      className="text-xs font-bold text-marble/60 hover:text-white bg-white/5 hover:bg-ares-red px-3 py-1 ares-cut-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
    >
      DELETE
    </button>
  );
};

export const contentFilter = (view: ViewType) => (item: { isDeleted?: number | boolean, status?: string }) => {
  const isDeleted = Number(item.isDeleted) === 1;
  if (view === 'trash') return isDeleted;
  if (view === 'pending') return !isDeleted && (item.status === 'pending' || item.status === 'rejected' || item.status === 'draft');
  return !isDeleted && (item.status === 'published' || !item.status);
};

