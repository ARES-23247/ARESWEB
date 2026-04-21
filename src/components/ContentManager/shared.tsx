export type ViewType = "active" | "trash" | "pending";

export interface ContentMutationResult {
  mutate: (variables: { type: 'event' | 'post' | 'doc'; id: string }) => void;
  isPending: boolean;
  variables: { type: 'event' | 'post' | 'doc'; id: string } | undefined;
}

export interface EventItem {
  id: string;
  title: string;
  date_start: string;
  cf_email?: string;
  is_deleted?: number;
  status?: string;
  revision_of?: string;
  category?: string;
}

export interface PostItem {
  slug: string;
  title: string;
  date: string;
  cf_email?: string;
  is_deleted?: number;
  status?: string;
  revision_of?: string;
}

export interface DocItem {
  slug: string;
  title: string;
  category: string;
  sort_order: number;
  is_deleted?: number;
  is_portfolio?: number;
  is_executive_summary?: number;
  status?: string;
  revision_of?: string;
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
      <button disabled className="text-xs font-bold text-zinc-300 bg-zinc-800 px-3 py-1 ares-cut-sm opacity-50 cursor-not-allowed">
        DELETING...
      </button>
    );
  }

  if (isConfirming) {
    return (
      <button
        onClick={onDelete}
        className="text-xs font-bold text-white bg-ares-red/80 hover:bg-ares-red px-3 py-1 ares-cut-sm shadow-[0_0_10px_rgba(204,0,0,0.5)] transition-all animate-pulse focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        CONFIRM DELETE
      </button>
    );
  }

  return (
    <button
      onClick={() => setConfirmId(id)}
      className="text-xs font-bold text-zinc-400 hover:text-ares-red bg-zinc-800/50 hover:bg-zinc-800 px-3 py-1 ares-cut-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-red"
    >
      DELETE
    </button>
  );
};

export const contentFilter = (view: ViewType) => (item: { is_deleted?: number, status?: string }) => {
  if (view === 'trash') return item.is_deleted === 1;
  if (view === 'pending') return item.is_deleted !== 1 && (item.status === 'pending' || item.status === 'rejected');
  return item.is_deleted !== 1 && (item.status === 'published' || !item.status);
};
