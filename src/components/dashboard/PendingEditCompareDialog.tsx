import { useMemo } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { CheckCircle2, GitCompare, RotateCcw, X } from "lucide-react";
import type { DocRecord } from "@/hooks/useDocumentSync";
import { computeLineDiff } from "@/lib/diff";

interface ComparableFields {
  title: string;
  category: string;
  description: string;
  fileUrl?: string;
  content: string;
}

function toComparableFields(
  source: Record<string, unknown> | DocRecord,
  fallback: DocRecord,
): ComparableFields {
  const rec = source as Record<string, unknown>;
  const description =
    typeof rec.description === "string"
      ? rec.description
      : typeof rec.snippet === "string"
        ? rec.snippet
        : typeof rec.summary === "string"
          ? rec.summary
          : fallback.description;
  return {
    title: typeof rec.title === "string" ? rec.title : fallback.title,
    category: typeof rec.category === "string" ? rec.category : fallback.category,
    description,
    fileUrl: typeof rec.fileUrl === "string" ? rec.fileUrl : fallback.fileUrl,
    content: typeof rec.content === "string" ? rec.content : fallback.content,
  };
}

export function StagedContentDiffView({
  liveSnapshot,
  pendingDoc,
}: {
  liveSnapshot: Record<string, unknown> | DocRecord;
  pendingDoc: DocRecord;
}) {
  const live = useMemo(
    () => toComparableFields(liveSnapshot, pendingDoc),
    [liveSnapshot, pendingDoc],
  );
  const pending = useMemo(
    () => toComparableFields(pendingDoc, pendingDoc),
    [pendingDoc],
  );
  const contentDiff = useMemo(
    () => computeLineDiff(live.content || "", pending.content || ""),
    [live.content, pending.content],
  );

  const metadataChanges = useMemo(() => {
    const entries: Array<{ label: string; before: string; after: string }> = [];
    if (live.title !== pending.title) {
      entries.push({ label: "Title", before: live.title, after: pending.title });
    }
    if (live.category !== pending.category) {
      entries.push({
        label: "Category",
        before: live.category || "(none)",
        after: pending.category || "(none)",
      });
    }
    if ((live.description || "") !== (pending.description || "")) {
      entries.push({
        label: "Summary / Description",
        before: live.description || "(empty)",
        after: pending.description || "(empty)",
      });
    }
    if ((live.fileUrl || "") !== (pending.fileUrl || "")) {
      entries.push({
        label: "File URL",
        before: live.fileUrl || "(none)",
        after: pending.fileUrl || "(none)",
      });
    }
    return entries;
  }, [live, pending]);

  return (
    <div
      data-testid="staged-content-diff-view"
      className="space-y-4 rounded-lg border border-white/10 bg-black/30 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <GitCompare size={16} className="text-ares-gold" aria-hidden="true" />
          <h3 className="text-xs font-black uppercase tracking-wider text-white">
            Live Published Version vs. Pending Edit
          </h3>
        </div>
        <div className="flex items-center gap-3 font-mono text-xs">
          <span className="text-emerald-300">+{contentDiff.addedCount} added</span>
          <span className="text-rose-300">-{contentDiff.removedCount} removed</span>
          <span className="text-marble/60">{contentDiff.unchangedCount} unchanged</span>
        </div>
      </div>

      {metadataChanges.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-black uppercase tracking-wider text-ares-gold">
            Metadata Changes ({metadataChanges.length})
          </p>
          <div className="grid gap-2">
            {metadataChanges.map((change) => (
              <div
                key={change.label}
                className="rounded border border-white/10 bg-black/40 p-3 text-xs"
              >
                <p className="font-bold text-white/80">{change.label}</p>
                <div className="mt-1 grid gap-1 sm:grid-cols-2">
                  <div className="rounded bg-rose-500/10 px-2 py-1 font-mono text-rose-200">
                    <span className="mr-1 font-bold text-rose-300">Live:</span>
                    {change.before}
                  </div>
                  <div className="rounded bg-emerald-500/10 px-2 py-1 font-mono text-emerald-200">
                    <span className="mr-1 font-bold text-emerald-300">Pending:</span>
                    {change.after}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-marble/70">
          Content Line Diff
        </p>
        {contentDiff.lines.length === 0 ? (
          <p className="rounded border border-white/10 bg-black/40 p-3 text-xs text-marble/60">
            No body content in either version.
          </p>
        ) : (
          <div className="max-h-96 overflow-y-auto rounded border border-white/10 bg-black/60 font-mono text-xs">
            {contentDiff.lines.map((line, index) => {
              const rowStyle =
                line.type === "added"
                  ? "bg-emerald-500/15 text-emerald-200"
                  : line.type === "removed"
                    ? "bg-rose-500/15 text-rose-200"
                    : "text-marble/70";
              const prefix =
                line.type === "added" ? "+" : line.type === "removed" ? "-" : " ";
              return (
                <div
                  key={`${line.originalLineNumber ?? "n"}-${line.comparedLineNumber ?? "n"}-${index}`}
                  className={`flex gap-3 px-3 py-0.5 leading-5 ${rowStyle}`}
                >
                  <span className="w-6 shrink-0 select-none text-right opacity-60">
                    {line.originalLineNumber ?? ""}
                  </span>
                  <span className="w-6 shrink-0 select-none text-right opacity-60">
                    {line.comparedLineNumber ?? ""}
                  </span>
                  <span className="w-3 shrink-0 select-none font-bold">{prefix}</span>
                  <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">
                    {line.line || " "}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

interface PendingEditCompareDialogProps {
  item: DocRecord | null;
  sectionLabel: string;
  isApproving: boolean;
  isDiscarding: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onApprove: (item: DocRecord) => void | Promise<unknown>;
  onDiscard: (item: DocRecord) => void | Promise<unknown>;
}

export default function PendingEditCompareDialog({
  item,
  sectionLabel,
  isApproving,
  isDiscarding,
  errorMessage = null,
  onClose,
  onApprove,
  onDiscard,
}: PendingEditCompareDialogProps) {
  const isBusy = isApproving || isDiscarding;

  return (
    <Dialog.Root
      open={Boolean(item && item.publishedSnapshot)}
      onOpenChange={(open) => {
        if (!open && !isBusy) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[110] bg-black/85 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-x-2 top-4 z-[111] flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden border border-white/15 bg-obsidian shadow-2xl focus:outline-none sm:inset-x-6 sm:top-6 sm:max-h-[calc(100dvh-3rem)] lg:left-1/2 lg:right-auto lg:w-[min(92vw,68rem)] lg:-translate-x-1/2">
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 bg-black/25 p-4 sm:p-6">
            <div>
              <Dialog.Title className="font-heading text-xl font-black uppercase text-white sm:text-2xl">
                Compare &amp; Review Pending {sectionLabel} Edit
              </Dialog.Title>
              <Dialog.Description className="mt-1 max-w-3xl text-sm leading-6 text-marble/70">
                The last approved version of{" "}
                <span className="font-bold text-white">{item?.title}</span> remains live on
                the public website until you approve or discard this pending edit.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                disabled={isBusy}
                aria-label="Close comparison dialog"
                className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center border border-white/15 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50"
              >
                <X aria-hidden="true" size={20} />
              </button>
            </Dialog.Close>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {item && item.publishedSnapshot && (
              <StagedContentDiffView
                liveSnapshot={item.publishedSnapshot}
                pendingDoc={item}
              />
            )}
          </div>

          <footer className="shrink-0 border-t border-white/10 bg-black/35 p-4 sm:p-6">
            {errorMessage && (
              <div
                role="alert"
                className="mb-4 border border-ares-red/45 bg-ares-red/15 p-3 text-sm text-white"
              >
                {errorMessage}
              </div>
            )}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button
                type="button"
                disabled={isBusy || !item}
                onClick={() => item && void onDiscard(item)}
                className="inline-flex min-h-11 items-center justify-center gap-2 border border-ares-red/45 bg-ares-red/15 px-4 py-2 text-xs font-black uppercase text-white hover:bg-ares-red/25 focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50"
              >
                <RotateCcw size={15} aria-hidden="true" />
                {isDiscarding ? "Discarding edit…" : "Discard Pending Edit"}
              </button>
              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    disabled={isBusy}
                    className="min-h-11 border border-white/15 px-4 py-2 text-xs font-bold uppercase text-white focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50"
                  >
                    Keep Pending
                  </button>
                </Dialog.Close>
                <button
                  type="button"
                  disabled={isBusy || !item}
                  onClick={() => item && void onApprove(item)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 bg-ares-gold px-4 py-2 text-xs font-black uppercase text-black hover:bg-ares-gold/90 focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50"
                >
                  <CheckCircle2 size={15} aria-hidden="true" />
                  {isApproving ? "Approving edit…" : "Approve & Publish Edit"}
                </button>
              </div>
            </div>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
