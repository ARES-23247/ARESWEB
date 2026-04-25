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
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
        {headerTitle}
        {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
      </div>

      <div className="text-xs text-marble/20 mb-2 px-1 flex justify-between items-center font-mono uppercase tracking-widest border-b border-white/5 pb-1">
        <span>VIEW: {view} | RAW: {rawCount} | FILTERED: {items.length}</span>
        {isError && <span className="text-ares-red font-bold animate-pulse">API ERROR!</span>}
      </div>

      <div className="flex flex-col gap-3 overflow-y-auto flex-1 min-h-0 pr-2 custom-scrollbar">
        {items.length === 0 ? (
          <DashboardEmptyState
            className="text-marble/50 text-xs italic py-8 text-center border border-dashed border-white/5 ares-cut-sm"
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
                className={`bg-black/40 border ${
                  deleted ? "border-ares-red/30 bg-ares-red/[0.02]" : "border-white/10"
                } ares-cut-sm p-4 flex flex-col justify-between gap-4 hover:border-white/20 transition-colors`}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-marble/90 truncate flex items-center gap-2">
                    {renderTitle(item)}
                    {deleted && (
                      <span className="text-[9px] font-black text-white bg-ares-red px-1.5 py-0.5 rounded uppercase tracking-wider">
                        Deleted
                      </span>
                    )}
                    {isRevision && (
                      <span className="text-[9px] font-black text-black bg-ares-gold px-1.5 py-0.5 rounded uppercase tracking-wider shadow-[0_0_10px_rgba(255,191,0,0.3)]">
                        Revision
                      </span>
                    )}
                    {status === "rejected" && (
                      <span className="text-[9px] font-black text-white bg-ares-bronze px-1.5 py-0.5 rounded uppercase tracking-wider">
                        Rejected
                      </span>
                    )}
                    {status === "draft" && (
                      <span className="text-[9px] font-black text-black bg-ares-gold px-1.5 py-0.5 rounded uppercase tracking-wider">
                        Draft
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {renderSubtitle(item)}
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
                  {!deleted ? (
                    <>
                      {onEdit && (
                        <button
                          onClick={() => onEdit(item)}
                          className="text-xs font-bold text-marble/40 hover:text-ares-cyan bg-white/5 hover:bg-white/10 px-3 py-1 ares-cut-sm transition-colors"
                        >
                          EDIT
                        </button>
                      )}
                      {onHistory && view === "active" && (
                        <button
                          onClick={() => onHistory(item)}
                          className="text-xs font-bold text-marble/40 hover:text-ares-gold bg-white/5 hover:bg-white/10 px-3 py-1 ares-cut-sm transition-colors"
                        >
                          HISTORY
                        </button>
                      )}
                      {view === "pending" ? (
                        <>
                          {onApprove && (
                            <button
                              onClick={() => onApprove(item)}
                              disabled={isApprovePending?.(item)}
                              className="text-xs font-bold text-ares-cyan hover:text-white bg-ares-cyan/10 hover:bg-ares-cyan px-3 py-1 ares-cut-sm transition-colors disabled:opacity-50"
                            >
                              APPROVE
                            </button>
                          )}
                          {onReject && (
                            <button
                              onClick={() => onReject(item)}
                              disabled={isRejectPending?.(item)}
                              className="text-xs font-bold text-white bg-ares-red/80 hover:bg-ares-red px-3 py-1 ares-cut-sm transition-colors disabled:opacity-50"
                            >
                              REJECT
                            </button>
                          )}
                        </>
                      ) : (
                        renderCustomActions && renderCustomActions(item)
                      )}
                      {onDelete && (
                        <ClickToDeleteButton
                          id={id}
                          onDelete={() => onDelete(item)}
                          isDeleting={isDeletePending?.(item) || false}
                          confirmId={confirmId}
                          setConfirmId={setConfirmId}
                        />
                      )}
                    </>
                  ) : (
                    <>
                      {onRestore && (
                        <button
                          onClick={() => onRestore(item)}
                          disabled={isRestorePending?.(item)}
                          className="text-xs font-bold text-ares-cyan bg-ares-cyan/10 hover:bg-ares-cyan/20 px-3 py-1 ares-cut-sm transition-colors"
                        >
                          {isRestorePending?.(item) ? "RESTORING..." : "RESTORE"}
                        </button>
                      )}
                      {onPurge && (
                        <ClickToDeleteButton
                          id={`purge-${id}`}
                          onDelete={() => onPurge(item)}
                          isDeleting={isPurgePending?.(item) || false}
                          confirmId={confirmId}
                          setConfirmId={setConfirmId}
                        />
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
