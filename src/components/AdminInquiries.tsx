// import { useQueryClient } from "@tanstack/react-query"; // Reserved for future query invalidation
import { Trash2, MessageSquare, Mail, CheckSquare, Clock, Search } from "lucide-react";
import { format } from "date-fns";
import { useState, useMemo, useEffect } from "react";
import { useQueryState } from "nuqs";
import {
  useGetAdminInquiries,
  useUpdateInquiryStatus,
  useUpdateInquiryNotes,
  useDeleteInquiry
} from "../api";
import DashboardPageHeader from "./dashboard/DashboardPageHeader";
import DashboardEmptyState from "./dashboard/DashboardEmptyState";
import DashboardLoadingGrid from "./dashboard/DashboardLoadingGrid";
import { toast } from "sonner";

function DebouncedNotesArea({
  id,
  initialValue,
  onSave
}: {
  id: string;
  initialValue: string;
  onSave: (val: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    // If it hasn't changed from what was initially passed, do nothing
    if (value === initialValue) return;
    
    const timeout = setTimeout(() => {
      onSave(value);
      setIsTyping(false);
    }, 1000); // 1-second debounce
    
    return () => clearTimeout(timeout);
  }, [value, initialValue, onSave]);

  return (
    <div className="relative">
      <textarea
        id={`notes-${id}`}
        value={value}
        onChange={(e) => {
          const val = e.target.value;
          setValue(val);
          setIsTyping(val !== initialValue);
        }}
        rows={2}
        placeholder="Add internal notes... (auto-saves automatically)"
        className="w-full bg-ares-gray-dark/50 border border-white/5 text-marble/80 text-xs px-3 py-2 ares-cut-sm outline-none focus:border-ares-cyan/30 transition-colors resize-none placeholder-marble/30"
      />
      {isTyping && (
        <span className="absolute bottom-2 right-2 text-[10px] text-ares-gold animate-pulse uppercase font-black">
          Saving...
        </span>
      )}
    </div>
  );
}

type Inquiry = {
  id: string;
  type: string;
  name: string;
  email: string;
  metadata: string | null;
  status: "pending" | "approved" | "resolved" | "rejected";
  createdAt: string;
  zulipMessageId: string | null;
  notes: string | null;
};

type StatusFilter = "all" | "pending" | "resolved" | "rejected";

const TYPE_COLORS: Record<string, string> = {
  student: "bg-ares-red text-white",
  mentor: "bg-ares-gold text-black",
  sponsor: "bg-ares-cyan text-black",
  outreach: "bg-ares-bronze text-white",
  support: "bg-white/10 text-white",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-ares-gold/20 text-ares-gold border-ares-gold/30",
  resolved: "bg-ares-cyan/20 text-ares-cyan border-ares-cyan/30",
  approved: "bg-ares-cyan/20 text-ares-cyan border-ares-cyan/30",
  rejected: "bg-ares-red/20 text-ares-red border-ares-red/30",
};

export default function AdminInquiries() {
  // const queryClient = useQueryClient(); // Reserved for future query invalidation
  const [globalFilter, setGlobalFilter] = useQueryState("q", { defaultValue: "" });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const { data: res, isLoading, isError } = useGetAdminInquiries({ limit: 100, offset: 0 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inquiries = useMemo(() => (res?.inquiries || []) as any as Inquiry[], [res?.inquiries]);

  const filtered = useMemo(() => {
    let result = inquiries as Inquiry[];
    if (statusFilter !== "all") {
      result = result.filter(i => i.status === statusFilter);
    }
    if (globalFilter) {
      const q = globalFilter.toLowerCase();
      result = result.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.email.toLowerCase().includes(q) ||
        i.type.toLowerCase().includes(q) ||
        (i.metadata && i.metadata.toLowerCase().includes(q))
      );
    }
    return result;
  }, [inquiries, statusFilter, globalFilter]); // Dependencies are stable: inquiries is memoized, statusFilter and globalFilter are from state

  const updateStatusMutation = useUpdateInquiryStatus({
    onSuccess: () => toast.success("Inquiry status updated."),
    onError: (err) => toast.error(`Failed to update status: ${err.message}`),
  });

  const deleteInquiryMutation = useDeleteInquiry({
    onSuccess: () => toast.success("Inquiry deleted."),
    onError: (err) => toast.error(`Failed to delete inquiry: ${err.message}`),
  });

  const updateNotesMutation = useUpdateInquiryNotes({
    onSuccess: () => toast.success("Notes updated.")
  });

  const parseMetadata = (metadata: string | null): Record<string, unknown> | null => {
    if (!metadata) return null;
    try { return JSON.parse(metadata); } catch { return null; }
  };

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Admin Inquiries"
        subtitle="Manage communication requests and outreach leads."
        icon={<MessageSquare className="text-ares-gold" />}
      />

      {isError && (
        <div className="bg-ares-red/10 border border-ares-red/30 p-4 ares-cut-sm text-ares-red text-xs font-bold mb-6 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-ares-red animate-pulse" />
          TELEMETRY FAULT: Failed to synchronize inquiry data.
        </div>
      )}

      {/* Search + Status Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-marble/30" size={18} />
          <input
            type="text"
            value={globalFilter ?? ""}
            onChange={e => setGlobalFilter(e.target.value)}
            placeholder="Search inquiries (name, email, type...)"
            className="w-full bg-white/5 border border-white/10 ares-cut-sm pl-12 pr-4 py-3 text-white outline-none focus:border-ares-gold transition-colors"
          />
        </div>
        <div className="flex items-center gap-2">
          {(["all", "pending", "resolved", "rejected"] as StatusFilter[]).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-[10px] font-black uppercase tracking-widest px-3 py-2 ares-cut-sm transition-colors ${
                statusFilter === s
                  ? "bg-ares-gold text-black"
                  : "bg-white/5 text-marble/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="text-xs text-marble/20 px-1 flex justify-between items-center font-mono uppercase tracking-widest border-b border-white/5 pb-1">
        <span>VIEW: {statusFilter} | RAW: {inquiries.length} | FILTERED: {filtered.length}</span>
        {isError && <span className="text-ares-red font-bold animate-pulse">API ERROR!</span>}
      </div>

      {/* Content */}
      {isLoading ? (
        <DashboardLoadingGrid count={5} heightClass="h-20" />
      ) : filtered.length === 0 ? (
        <DashboardEmptyState
          className="py-16 text-center border border-dashed border-white/5 ares-cut-sm"
          icon={<MessageSquare size={32} />}
          message={inquiries.length === 0 ? "No active inquiries or applications." : `No ${statusFilter} inquiries found.`}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((inquiry: Inquiry) => {
            const meta = parseMetadata(inquiry.metadata);
            const isConfirming = confirmId === inquiry.id;

            return (
              <div
                key={inquiry.id}
                className="bg-black/40 border border-white/10 ares-cut-sm p-4 flex flex-col gap-3 hover:border-white/20 transition-colors"
              >
                {/* Top Row: Type badge + Name/Email + Date + Status */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className={`px-2 py-0.5 ares-cut-xs text-[10px] font-black uppercase shrink-0 ${TYPE_COLORS[inquiry.type] || "bg-white/10 text-white"}`}>
                      {inquiry.type}
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-marble/90 truncate">{inquiry.name}</div>
                      <div className="text-xs text-marble/60 flex items-center gap-1 truncate">
                        <Mail size={10} /> {inquiry.email}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-marble/30 font-mono">
                      {format(new Date(inquiry.createdAt), "MMM d, yyyy")}
                    </span>
                    <span className={`px-3 py-1 ares-cut-xs text-[10px] font-bold uppercase tracking-widest border ${STATUS_COLORS[inquiry.status] || "bg-white/10 text-white border-white/20"}`}>
                      {inquiry.status}
                    </span>
                  </div>
                </div>

                {/* Metadata Preview */}
                {meta && (
                  <div className="flex flex-wrap gap-2 text-[11px] text-marble/50">
                    {Object.entries(meta).map(([k, v]) => (
                      <span key={k} className="bg-white/5 border border-white/10 px-2 py-0.5 ares-cut-xs">
                        <span className="text-marble/30 uppercase mr-1">{k}:</span>
                        <span className="text-marble/70">{String(v)}</span>
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-1">
                  <label htmlFor={`notes-${inquiry.id}`} className="text-[10px] font-black text-ares-gray uppercase tracking-widest mb-1.5 flex items-center gap-1">
                    Notes
                  </label>
                  <DebouncedNotesArea 
                    id={inquiry.id}
                    initialValue={inquiry.notes || ""}
                    onSave={(val) => {
                      updateNotesMutation.mutate({ id: inquiry.id, notes: val });
                    }}
                  />
                </div>

                {/* Action Bar */}
                <div className="flex flex-wrap items-center justify-between pt-2 border-t border-white/10 gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                  {inquiry.status === "pending" ? (
                    <button
                      onClick={() => updateStatusMutation.mutate({ id: inquiry.id, status: "resolved" })}
                      disabled={updateStatusMutation.isPending}
                      className="text-xs font-bold text-marble/60 hover:text-ares-cyan bg-white/5 hover:bg-ares-cyan/10 px-3 py-1 ares-cut-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <CheckSquare size={12} /> RESOLVE
                    </button>
                  ) : (
                    <button
                      onClick={() => updateStatusMutation.mutate({ id: inquiry.id, status: "pending" })}
                      disabled={updateStatusMutation.isPending}
                      className="text-xs font-bold text-marble/60 hover:text-ares-gold bg-white/5 hover:bg-ares-gold/10 px-3 py-1 ares-cut-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Clock size={12} /> REOPEN
                    </button>
                  )}

                  {/* Delete with confirmation */}
                  {isConfirming ? (
                    <>
                      <button
                        onClick={() => { deleteInquiryMutation.mutate(inquiry.id); setConfirmId(null); }}
                        className="text-xs font-bold text-white bg-ares-red hover:bg-ares-red/80 px-3 py-1 ares-cut-sm shadow-[0_0_20px_rgba(204,0,0,0.4)] transition-all animate-pulse"
                      >
                        CONFIRM DELETE
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="text-xs font-bold text-marble/60 bg-white/5 px-3 py-1 ares-cut-sm hover:bg-white/10 transition-colors"
                      >
                        CANCEL
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setConfirmId(inquiry.id)}
                      className="text-xs font-bold text-marble/60 hover:text-white bg-white/5 hover:bg-ares-red px-3 py-1 ares-cut-sm transition-colors flex items-center gap-1.5"
                    >
                      <Trash2 size={12} /> DELETE
                    </button>
                  )}
                  </div>

                  {/* Right side: Zulip button */}
                  {inquiry.zulipMessageId && (
                    <a
                      href={`https://aresfirst.zulipchat.com/#narrow/id/${inquiry.zulipMessageId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-black text-white hover:text-white bg-social-zulip/80 hover:bg-social-zulip px-3 py-1 ares-cut-sm transition-colors flex items-center gap-1.5 shadow-[0_0_10px_rgba(94,130,166,0.2)]"
                    >
                      <MessageSquare size={12} />
                      DISCUSS ON ZULIP
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

