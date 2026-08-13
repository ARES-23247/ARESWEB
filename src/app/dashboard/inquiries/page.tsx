"use client";

import { logger } from "@/utils/logger";
import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { authenticatedFetch } from "@/lib/api";
import * as Dialog from "@radix-ui/react-dialog";
import { 
  MessageSquare, 
  Trash2, 
  Check, 
  X, 
  Clock, 
  Search, 
  AlertCircle, 
  RefreshCw,
  Mail,
  Phone,
  School,
  Briefcase,
  UserPlus
} from "lucide-react";

interface Inquiry {
  id: string;
  type: string;
  name: string;
  email: string;
  status: "pending" | "approved" | "resolved" | "rejected";
  metadata: {
    phone?: string;
    school?: string;
    grade?: string;
    occupation?: string;
    interests?: string[];
    additional?: string;
  };
  createdAt: string;
  isDeleted: boolean;
  archivedAt?: string | null;
}

interface InquiryPageResponse {
  error?: string;
  inquiries?: Inquiry[];
  nextCursor?: string | null;
  hasMore?: boolean;
}

export default function InquiriesPage() {
  const { user, authorizedUser } = useAuth();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ kind: "archive" | "approve"; inquiry: Inquiry } | null>(null);

  const userRole = authorizedUser?.role || "Pending Verification";
  const isAdmin = userRole === "admin" || userRole === "coach";

  const fetchInquiries = useCallback(async (cursor?: string) => {
    if (!user || !isAdmin) return;
    const append = Boolean(cursor);
    if (append) setIsLoadingMore(true);
    else setIsLoading(true);
    setError("");
    try {
      const url = cursor
        ? `/api/inquiries?limit=50&cursor=${encodeURIComponent(cursor)}`
        : "/api/inquiries?limit=50";
      const res = await authenticatedFetch(url);
      const data = await res.json() as InquiryPageResponse;
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${data.error || res.statusText}`);
      }
      const page = Array.isArray(data.inquiries) ? data.inquiries as Inquiry[] : [];
      setInquiries((current) => {
        if (!append) return page;
        const merged = new Map(current.map((inquiry) => [inquiry.id, inquiry]));
        page.forEach((inquiry) => merged.set(inquiry.id, inquiry));
        return Array.from(merged.values());
      });
      const cursorValue = typeof data.nextCursor === "string" && data.nextCursor ? data.nextCursor : null;
      setNextCursor(cursorValue);
      setHasMore(data.hasMore === true && cursorValue !== null);
    } catch (err: unknown) {
      logger.error("Failed to load the inquiry queue.");
      setError(err instanceof Error ? err.message : "Failed to load inquiries.");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [isAdmin, user]);

  useEffect(() => {
    void fetchInquiries();
  }, [fetchInquiries]);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    if (!user) return;
    setActionError("");
    setSuccess("");
    try {
      const res = await authenticatedFetch(`/api/inquiries/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${data.error || res.statusText}`);
      }
      // Update local state
      setInquiries((prev) =>
        prev.map((inq) => (inq.id === id ? { ...inq, status: newStatus as Inquiry["status"] } : inq))
      );
      setSuccess("Inquiry status updated.");
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to update inquiry status.");
    }
  };

  const handleDeleteInquiry = async (id: string) => {
    if (!user) return;
    setActionError("");
    setSuccess("");
    setIsProcessingId(id);
    try {
      const res = await authenticatedFetch(`/api/inquiries/${id}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${data.error || res.statusText}`);
      }
      setInquiries((prev) => prev.map((inq) => inq.id === id ? { ...inq, isDeleted: true } : inq));
      setPendingAction(null);
      setSuccess("Inquiry archived. It can be restored from the Archived filter.");
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to archive inquiry.");
    } finally {
      setIsProcessingId(null);
    }
  };

  const handleRestoreInquiry = async (id: string) => {
    if (!user) return;
    setActionError("");
    setSuccess("");
    setIsProcessingId(id);
    try {
      const res = await authenticatedFetch(`/api/inquiries/${id}/restore`, { method: "PATCH" });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${data.error || res.statusText}`);
      setInquiries((prev) => prev.map((inq) => inq.id === id ? { ...inq, isDeleted: false } : inq));
      setSuccess("Inquiry restored.");
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to restore inquiry.");
    } finally {
      setIsProcessingId(null);
    }
  };

  const handleApproveAccount = async (id: string) => {
    if (!user || isProcessingId) return;
    setActionError("");
    setSuccess("");
    setIsProcessingId(id);
    try {
      const res = await authenticatedFetch(`/api/inquiries/${id}/approve-account`, {
        method: "POST"
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${data.error || res.statusText}`);
      }
      // Update local state: mark as resolved
      setInquiries((prev) =>
        prev.map((inq) => (inq.id === id ? { ...inq, status: "resolved" } : inq))
      );
      setPendingAction(null);
      setSuccess(data.message || "Account pre-authorized successfully.");
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to pre-authorize account.");
    } finally {
      setIsProcessingId(null);
    }
  };

  // Filter inquiries based on search and filters
  const filteredInquiries = inquiries.filter((inq) => {
    const matchesSearch = 
      inq.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inq.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inq.metadata && JSON.stringify(inq.metadata).toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesType = typeFilter === "all" || inq.type === typeFilter;
    const matchesArchived = statusFilter === "archived" ? inq.isDeleted : !inq.isDeleted;
    const matchesStatus = statusFilter === "all" || statusFilter === "archived" || inq.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus && matchesArchived;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
      case "resolved":
        return <span className="px-2 py-0.5 bg-ares-cyan/15 text-ares-cyan text-[10px] font-black uppercase tracking-wider ares-cut-sm border border-ares-cyan/30">Resolved</span>;
      case "rejected":
        return <span className="px-2 py-0.5 bg-ares-red text-white text-[10px] font-black uppercase tracking-wider ares-cut-sm">Rejected</span>;
      case "pending":
      default:
        return <span className="px-2 py-0.5 bg-ares-gold/15 text-ares-gold text-[10px] font-black uppercase tracking-wider ares-cut-sm border border-ares-gold/30 animate-pulse">Pending</span>;
    }
  };

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      student: "bg-ares-red text-white border-transparent",
      mentor: "bg-ares-gold/15 text-ares-gold border-ares-gold/20",
      sponsor: "bg-ares-cyan/15 text-ares-cyan border-ares-cyan/20",
      demo: "bg-ares-gold/15 text-ares-gold border-ares-gold/20",
    };
    const cls = colors[type] || "bg-white/5 text-marble/60 border-white/10";
    return <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${cls}`}>{type}</span>;
  };

  if (!isAdmin) {
    return (
      <div className="min-h-[60vh] flex flex-col justify-center items-center text-center p-6 bg-obsidian text-marble">
        <div className="w-16 h-16 bg-ares-red/10 border border-ares-red/40 ares-cut flex items-center justify-center mb-6 text-ares-red">
          <AlertCircle size={28} className="animate-bounce" />
        </div>
        <h1 className="text-3xl font-black uppercase tracking-wider text-white mb-2 font-heading">Access Denied</h1>
        <p className="text-marble/60 text-sm max-w-md">
          You do not have the required credentials to access the ARES Inquiries console. Please contact a team administrator if you need your permissions elevated.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <header className="border-b border-white/5 pb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-ares-gold font-bold uppercase tracking-widest text-xs mb-3 font-heading flex items-center gap-2">
            <MessageSquare size={12} /> Communication & Applications
          </p>
          <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter font-heading">
            Inquiries Hub
          </h1>
          <p className="text-marble/70 text-sm mt-2 font-medium">
            Review and manage student enrollments, mentor applications, and general sponsorship inquiries.
          </p>
        </div>
        <button 
          onClick={() => void fetchInquiries()}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-black uppercase tracking-wider transition-colors cursor-pointer w-fit font-bold"
        >
          <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} /> Refresh
        </button>
      </header>

      {/* Filters Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white/5 p-4 ares-cut border border-white/5">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-marble/40" size={16} />
          <input
            type="text"
            placeholder="Search inquiries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search inquiries"
            className="w-full bg-obsidian border border-white/10 ares-cut-sm pl-10 pr-4 py-2 text-xs text-white placeholder-marble/30 focus:outline-none focus:border-ares-cyan focus:ring-1 focus:ring-ares-cyan/20 transition-all font-semibold"
          />
        </div>

        <div className="flex gap-4 w-full md:w-auto">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filter inquiries by type"
            className="bg-obsidian border border-white/10 ares-cut-sm px-3 py-2 text-xs text-white cursor-pointer w-full md:w-40 focus:outline-none focus:border-ares-cyan focus:ring-1 focus:ring-ares-cyan/20 font-bold"
          >
            <option value="all">All Types</option>
            <option value="student">Students</option>
            <option value="mentor">Mentors</option>
            <option value="sponsor">Sponsors</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter inquiries by status"
            className="bg-obsidian border border-white/10 ares-cut-sm px-3 py-2 text-xs text-white cursor-pointer w-full md:w-40 focus:outline-none focus:border-ares-cyan focus:ring-1 focus:ring-ares-cyan/20 font-bold"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
            <option value="rejected">Rejected</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {success && <div role="status" className="rounded border border-ares-gold/30 bg-ares-gold/10 p-4 text-sm font-semibold text-white">{success}</div>}
      {actionError && <div role="alert" className="rounded border border-ares-red/30 bg-ares-red/10 p-4 text-sm text-white"><span className="font-mono">{actionError}</span></div>}
      {error && inquiries.length > 0 && (
        <div role="alert" className="rounded border border-ares-red/30 bg-ares-red/10 p-4 text-sm text-white">
          The inquiry list could not refresh. The last loaded records remain below. <span className="font-mono">{error}</span>
        </div>
      )}

      {/* Content Section */}
      {isLoading && inquiries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white/5 border border-white/5 ares-cut gap-4">
          <RefreshCw size={36} className="text-ares-red animate-spin" />
          <span className="text-xs font-bold uppercase tracking-widest text-marble/55">Fetching records from Firestore...</span>
        </div>
      ) : error && inquiries.length === 0 ? (
        <div role="alert" className="flex flex-col items-center justify-center py-16 bg-ares-red/10 border border-ares-red/20 ares-cut gap-4 text-center">
          <AlertCircle size={36} className="text-ares-red" />
          <span className="text-sm font-bold bg-ares-red text-white px-3 py-1.5 rounded">{error}</span>
          <button onClick={() => void fetchInquiries()} className="px-4 py-2 bg-ares-red text-white text-xs font-black uppercase tracking-wider ares-cut-sm shadow-md cursor-pointer font-bold">Retry</button>
        </div>
      ) : filteredInquiries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white/5 border border-white/5 ares-cut gap-3 text-center">
          <MessageSquare size={36} className="text-marble/30" />
          <span className="text-sm font-bold text-white/80 font-heading">No Inquiries Found</span>
          <span className="text-xs text-marble/50 font-medium">Either there are no submissions or they do not match filters.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredInquiries.map((inq) => (
            <div key={inq.id} className="bg-white/5 border border-white/10 p-6 ares-cut-lg flex flex-col lg:flex-row justify-between gap-6 hover:border-white/20 transition-all shadow-xl">
              
              {/* Inquiry Details */}
              <div className="space-y-4 flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-white font-black text-lg font-heading leading-none">{inq.name}</span>
                  {getTypeBadge(inq.type)}
                  {getStatusBadge(inq.status)}
                  {inq.isDeleted && <span className="px-2 py-0.5 bg-ares-red/15 text-ares-red text-[10px] font-black uppercase tracking-wider border border-ares-red/30">Archived</span>}
                </div>
                
                {/* Contact row */}
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-marble/70 font-semibold">
                  <span className="flex items-center gap-1.5"><Mail size={14} className="text-marble/40" /> {inq.email}</span>
                  {inq.metadata?.phone && <span className="flex items-center gap-1.5"><Phone size={14} className="text-marble/40" /> {inq.metadata.phone}</span>}
                  {inq.metadata?.school && <span className="flex items-center gap-1.5"><School size={14} className="text-marble/40" /> {inq.metadata.school} (Grade {inq.metadata.grade}th)</span>}
                  {inq.metadata?.occupation && <span className="flex items-center gap-1.5"><Briefcase size={14} className="text-marble/40" /> {inq.metadata.occupation}</span>}
                  <span className="flex items-center gap-1.5"><Clock size={14} className="text-marble/40" /> {new Date(inq.createdAt).toLocaleDateString()} at {new Date(inq.createdAt).toLocaleTimeString()}</span>
                </div>

                {/* Subteam/Interests */}
                {inq.metadata?.interests && inq.metadata.interests.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap text-[10px] font-black text-marble/60">
                    <span className="uppercase tracking-widest text-ares-gold">Interests:</span>
                    {inq.metadata.interests.map((int: string) => (
                      <span key={int} className="bg-white/5 border border-white/10 px-2 py-0.5 ares-cut-sm">{int}</span>
                    ))}
                  </div>
                )}

                {/* Additional text payload */}
                {inq.metadata?.additional && (
                  <div className="bg-obsidian/60 border border-white/5 p-4 ares-cut-sm text-xs text-marble/85 leading-relaxed font-medium">
                    <p className="text-[10px] font-black uppercase tracking-widest text-marble/40 mb-1 leading-none">Additional details</p>
                    {inq.metadata.additional}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-row lg:flex-col gap-2 shrink-0 self-end lg:self-center font-bold">
                {!inq.isDeleted && inq.status === "pending" && (
                  <>
                    {(inq.type === "student" || inq.type === "mentor") && (
                      <button
                        onClick={() => setPendingAction({ kind: "approve", inquiry: inq })}
                        disabled={isProcessingId !== null}
                        className="flex items-center gap-1.5 px-4 py-2 bg-ares-gold text-black text-xs font-black uppercase tracking-wider ares-cut-sm hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <UserPlus size={14} /> Create Account
                      </button>
                    )}
                    <button
                      onClick={() => handleUpdateStatus(inq.id, "resolved")}
                      className="flex items-center gap-1.5 px-4 py-2 bg-ares-cyan text-black text-xs font-black uppercase tracking-wider ares-cut-sm hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                    >
                      <Check size={14} /> Resolve
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(inq.id, "rejected")}
                      className="flex items-center gap-1.5 px-4 py-2 bg-ares-red/10 border border-ares-red/35 text-ares-red text-xs font-black uppercase tracking-wider ares-cut-sm hover:bg-ares-red/20 active:scale-95 transition-all cursor-pointer"
                    >
                      <X size={14} /> Reject
                    </button>
                  </>
                )}
                {!inq.isDeleted && inq.status !== "pending" && (
                  <button
                    onClick={() => handleUpdateStatus(inq.id, "pending")}
                    className="flex items-center gap-1.5 px-4 py-2 bg-white/5 border border-white/10 text-marble text-xs font-black uppercase tracking-wider ares-cut-sm hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                  >
                    Reopen
                  </button>
                )}
                {inq.isDeleted ? (
                  <button
                    onClick={() => void handleRestoreInquiry(inq.id)}
                    disabled={isProcessingId === inq.id}
                    className="flex items-center justify-center px-3 py-2 bg-ares-cyan/10 border border-ares-cyan/30 text-ares-cyan ares-cut-sm transition-all cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                  >
                    Restore
                  </button>
                ) : (
                  <button
                    onClick={() => setPendingAction({ kind: "archive", inquiry: inq })}
                    aria-label={`Archive inquiry from ${inq.name}`}
                    className="flex items-center justify-center p-2.5 bg-white/5 hover:bg-ares-red/25 border border-white/10 hover:border-ares-red/30 text-marble/60 hover:text-ares-red-light ares-cut-sm transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                  >
                    <Trash2 aria-hidden="true" size={14} />
                  </button>
                )}
              </div>

            </div>
          ))}
          {hasMore && nextCursor && (
            <button
              type="button"
              onClick={() => void fetchInquiries(nextCursor)}
              disabled={isLoadingMore}
              className="mx-auto rounded border border-ares-gold/40 bg-ares-gold/10 px-5 py-3 text-xs font-black uppercase tracking-wider text-ares-gold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              {isLoadingMore ? "Loading more inquiries…" : "Load more inquiries"}
            </button>
          )}
        </div>
      )}

      <Dialog.Root open={pendingAction !== null} onOpenChange={(open) => !open && setPendingAction(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/15 bg-obsidian p-6 shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">
            <Dialog.Title className="font-heading text-xl font-black uppercase text-white">
              {pendingAction?.kind === "approve" ? "Create this team account?" : "Archive this inquiry?"}
            </Dialog.Title>
            <Dialog.Description className="mt-3 text-sm leading-relaxed text-marble/80">
              {pendingAction?.kind === "approve"
                ? "This will pre-authorize the applicant with a private-by-default profile and mark the inquiry resolved."
                : "The inquiry will leave the active queue but remain available under Archived for recovery and audit history."}
            </Dialog.Description>
            <div className="mt-6 flex justify-end gap-3">
              <Dialog.Close asChild><button type="button" className="rounded border border-white/15 px-4 py-2 text-xs font-black uppercase text-marble focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">Cancel</button></Dialog.Close>
              <button
                type="button"
                disabled={!pendingAction || isProcessingId !== null}
                onClick={() => pendingAction && void (pendingAction.kind === "approve" ? handleApproveAccount(pendingAction.inquiry.id) : handleDeleteInquiry(pendingAction.inquiry.id))}
                className="rounded bg-ares-red px-4 py-2 text-xs font-black uppercase text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                {pendingAction?.kind === "approve" ? "Create account" : "Archive inquiry"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
