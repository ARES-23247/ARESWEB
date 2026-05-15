import { ReactNode } from "react";
import DashboardEmptyState from "../dashboard/DashboardEmptyState";
import { ClickToDeleteButton, ViewType } from "./shared";

interface GenericManagerListProps<T> {
  // Data & State
  items: T[];
  rawCount: number;
  view: ViewType;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  emptyIcon: ReactNode;
  emptyMessage: string;

  // Header Elements
  headerTitle: ReactNode;
  headerActions?: ReactNode;

  // Item Identity
  getItemId: (item: T) => string;
  isItemDeleted: (item: T) => boolean;
  isItemRevision?: (item: T) => boolean;
  getItemStatus?: (item: T) => string | undefined;

  // Render Props
  renderTitle: (item: T) => ReactNode;
  renderSubtitle: (item: T) => ReactNode;
  renderCustomActions?: (item: T) => ReactNode;

  // Action Callbacks
  onEdit?: (item: T) => void;
  onHistory?: (item: T) => void;
  onApprove?: (item: T) => void;
  isApprovePending?: (item: T) => boolean;
  onReject?: (item: T) => void;
  isRejectPending?: (item: T) => boolean;
  onDelete?: (item: T) => void;
  isDeletePending?: (item: T) => boolean;
  onRestore?: (item: T) => void;
  isRestorePending?: (item: T) => boolean;
  onPurge?: (item: T) => void;
  isPurgePending?: (item: T) => boolean;

  // Confirm State
  confirmId: string | null;
  setConfirmId: (id: string | null) => void;
}

export default function GenericManagerList<T>({
  items,
  rawCount,
  view,
  isLoading,
  isError,
  errorMessage,
  emptyIcon,
  emptyMessage,
  headerTitle,
  headerActions,
  getItemId,
  isItemDeleted,
  isItemRevision,
  getItemStatus,
  renderTitle,
  renderSubtitle,
  renderCustomActions,
  onEdit,
  onHistory,
  onApprove,
  isApprovePending,
  onReject,
  isRejectPending,
  onDelete,
  isDeletePending,
  onRestore,
  isRestorePending,
  onPurge,
  isPurgePending,
  confirmId,
  setConfirmId,
}: GenericManagerListProps<T>) {
  if (isLoading) {
    return (
      <div className="h-32 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/10 border-t-ares-red rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-4">
        <div className="flex items-center gap-4">
          <div className="w-1 h-8 bg-ares-red shadow-[0_0_15px_rgba(192,0,0,0.4)]"></div>
          {headerTitle}
        </div>
        {headerActions && <div className="flex items-center gap-3">{headerActions}</div>}
      </div>

      <div className="text-[10px] font-black text-marble/20 mb-6 px-4 py-2 bg-white/5 ares-cut-sm flex justify-between items-center uppercase tracking-[0.3em] border border-white/5">
        <span>MODE: {view} {" // "} REGISTRY_SIZE: {rawCount} {" // "} STREAM_ACTIVE: {items.length}</span>
        {isError && <span className="text-ares-red font-black animate-pulse" title={errorMessage}>{errorMessage || "TELEMETRY_FAULT"}</span>}
      </div>

      <div className="flex flex-col gap-6">
        {items.length === 0 ? (
          <DashboardEmptyState
            className="text-marble/20 text-[10px] font-black uppercase tracking-[0.4em] py-16 text-center border-2 border-dashed border-white/5 ares-cut-lg shadow-inner"
            icon={emptyIcon}
            message={emptyMessage}
          />
        ) : (
          items.map((item) => {
            const id = getItemId(item);
            const deleted = isItemDeleted(item);
            const status = getItemStatus ? getItemStatus(item) : undefined;
            const isRevision = isItemRevision ? isItemRevision(item) : false;

            return (
              <div
                key={id}
                className={`bg-black/40 border backdrop-blur-sm transition-all hover:border-white/20 shadow-xl overflow-hidden group ${
                  deleted ? "border-ares-red/30 bg-ares-red/[0.02]" : "border-white/5"
                } ares-cut-lg p-8 flex flex-col justify-between gap-6 relative`}
              >
                <div className="absolute top-0 right-0 w-1 h-0 bg-white/10 group-hover:h-full transition-all duration-500"></div>
                <div className="flex-1 min-w-0 relative z-10">
                  <div className="text-2xl font-black text-white uppercase tracking-tighter truncate flex items-center gap-4 group-hover:text-ares-cyan transition-colors leading-none mb-4">
                    {renderTitle(item)}
                    <div className="flex gap-2">
                      {deleted && (
                        <span className="text-[9px] font-black text-white bg-ares-red px-3 py-1 ares-cut-sm uppercase tracking-widest shadow-lg shadow-ares-red/20">
                          DELETED
                        </span>
                      )}
                      {isRevision && (
                        <span className="text-[9px] font-black text-black bg-ares-gold px-3 py-1 ares-cut-sm uppercase tracking-widest shadow-lg shadow-ares-gold/20">
                          REVISION
                        </span>
                      )}
                      {status === "rejected" && (
                        <span className="text-[9px] font-black text-white bg-ares-bronze px-3 py-1 ares-cut-sm uppercase tracking-widest shadow-lg shadow-ares-bronze/20">
                          REJECTED
                        </span>
                      )}
                      {status === "draft" && (
                        <span className="text-[9px] font-black text-black bg-ares-gold px-3 py-1 ares-cut-sm uppercase tracking-widest shadow-lg shadow-ares-gold/20">
                          DRAFT
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-6 mt-1">
                    {renderSubtitle(item)}
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 pt-6 border-t border-white/5 relative z-10">
                  {!deleted ? (
                    <>
                      {onEdit && (
                        <button
                          onClick={() => onEdit(item)}
                          className="text-[10px] font-black text-white/60 hover:text-ares-cyan bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 ares-cut-sm transition-all uppercase tracking-widest shadow-md"
                        >
                          EDIT_RECORD
                        </button>
                      )}
                      {onHistory && view === "active" && (
                        <button
                          onClick={() => onHistory(item)}
                          className="text-[10px] font-black text-white/60 hover:text-ares-gold bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 ares-cut-sm transition-all uppercase tracking-widest shadow-md"
                        >
                          VIEW_HISTORY
                        </button>
                      )}
                      {view === "pending" ? (
                        <>
                          {onApprove && (
                            <button
                              onClick={() => onApprove(item)}
                              disabled={isApprovePending?.(item)}
                              className="text-[10px] font-black text-black bg-ares-cyan hover:bg-white px-5 py-2 ares-cut-sm transition-all disabled:opacity-50 uppercase tracking-widest shadow-lg shadow-ares-cyan/20"
                            >
                              APPROVE_MISSION
                            </button>
                          )}
                          {onReject && (
                            <button
                              onClick={() => onReject(item)}
                              disabled={isRejectPending?.(item)}
                              className="text-[10px] font-black text-white bg-ares-red/80 hover:bg-ares-red px-5 py-2 ares-cut-sm transition-all disabled:opacity-50 uppercase tracking-widest shadow-lg shadow-ares-red/20"
                            >
                              REJECT_DEPLOYMENT
                            </button>
                          )}
                        </>
                      ) : (
                        renderCustomActions && renderCustomActions(item)
                      )}
                      {onDelete && (
                        <div className="ml-auto">
                          <ClickToDeleteButton
                            id={id}
                            onDelete={() => onDelete(item)}
                            isDeleting={isDeletePending?.(item) || false}
                            confirmId={confirmId}
                            setConfirmId={setConfirmId}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {onRestore && (
                        <button
                          onClick={() => onRestore(item)}
                          disabled={isRestorePending?.(item)}
                          className="text-[10px] font-black text-ares-cyan bg-ares-cyan/10 hover:bg-ares-cyan hover:text-black border border-ares-cyan/20 px-5 py-2 ares-cut-sm transition-all uppercase tracking-widest shadow-lg shadow-ares-cyan/10"
                        >
                          {isRestorePending?.(item) ? "RESTORING_ASSET..." : "RESTORE_TO_ACTIVE"}
                        </button>
                      )}
                      {onPurge && (
                        <div className="ml-auto">
                          <ClickToDeleteButton
                            id={`purge-${id}`}
                            onDelete={() => onPurge(item)}
                            isDeleting={isPurgePending?.(item) || false}
                            confirmId={confirmId}
                            setConfirmId={setConfirmId}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
