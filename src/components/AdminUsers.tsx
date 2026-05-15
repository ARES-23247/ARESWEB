import { useState, useMemo, useCallback, useEffect } from "react";
import { RefreshCw, Shield, Trash2, ChevronDown, Edit3, X, Search, ChevronUp, MessageSquare, Zap, Users, Mail, Download } from "lucide-react";
import ProfileEditor from "./ProfileEditor";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAwardPoints } from "../api/points";
import { useGetUsers, usePatchUser, useDeleteUser, type UserRole, type UserMemberType, type User } from "../api/users";
import { useAuditMissingUsers, useInviteUsers } from "../api/zulip";
import { toast } from "sonner";
import { toastApiError } from "../api/honoClient";
import { useQueryState } from "nuqs";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from "@tanstack/react-table";

// Use the exact enum values from the backend
const ROLES: readonly UserRole[] = ["unverified", "user", "author", "admin"] as const;
const MEMBER_TYPES: readonly UserMemberType[] = ["student", "mentor", "coach", "parent", "alumnus", "alumni", "sponsor", "other"] as const;

export default function AdminUsers() {
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [pointsUserId, setPointsUserId] = useState<string | null>(null);
  const [pointsDelta, setPointsDelta] = useState<string>("");
  const [pointsReason, setPointsReason] = useState<string>("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useQueryState("q", { defaultValue: "" });
  const [showZulipAudit, setShowZulipAudit] = useState(false);
  const [auditResult, setAuditResult] = useState<string[] | null>(null);
  const queryClient = useQueryClient();

  const [cursor, setCursor] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  const { data: rawBody, isLoading, isError, isFetching } = useGetUsers(
    { limit: 100, cursor: cursor || undefined }
  );

  const nextCursor = rawBody?.nextCursor || null;
  const rawUsers = rawBody?.users;

  const users = useMemo(() => rawUsers || [], [rawUsers]);

  useEffect(() => {
    if (users.length > 0) {
      if (cursor) {
        setAllUsers(prev => {
          const newIds = new Set(users.map(u => u.id));
          const filtered = prev.filter(u => !newIds.has(u.id));
          return [...filtered, ...users];
        });
      } else {
        setAllUsers(users);
      }
    }
  }, [users, cursor]);

  const patchMutation = usePatchUser({
    onSuccess: () => {
      toast.success("User updated");
    },
    onError: (err: unknown) => {
      toastApiError(err, "Update failed");
    }
  });

  const deleteMutation = useDeleteUser({
    onSuccess: () => {
      toast.success("User removed successfully");
    },
    onError: (err: unknown) => {
      toastApiError(err, "Failed to remove user");
    }
  });

  const changeRole = useCallback((userId: string, newRole: string) => {
    // Validate that newRole is a valid UserRole before mutation
    const validRole: UserRole = ROLES.includes(newRole as UserRole) ? (newRole as UserRole) : "unverified";
    patchMutation.mutate({ id: userId, role: validRole });
  }, [patchMutation]);

  const changeMemberType = useCallback((userId: string, newType: string) => {
    // Validate that newType is a valid UserMemberType before mutation
    const validType: UserMemberType = MEMBER_TYPES.includes(newType as UserMemberType) ? (newType as UserMemberType) : "student";
    patchMutation.mutate({ id: userId, memberType: validType });
  }, [patchMutation]);

  const removeUser = (userId: string, name: string) => {
    if (!confirm(`Remove ${name}? This cannot be undone.`)) return;
    deleteMutation.mutate(userId);
  };

  const columnHelper = useMemo(() => createColumnHelper<User>(), []);

  const pointsMutation = useAwardPoints();

  const handleAwardPoints = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pointsUserId || !pointsDelta || !pointsReason) return;
    const delta = parseInt(pointsDelta, 10);
    if (isNaN(delta)) return toastApiError("Invalid points amount");
    pointsMutation.mutate({
      userId: pointsUserId,
      pointsDelta: delta,
      reason: pointsReason
    }, {
      onSuccess: () => {
        toast.success("Points awarded successfully");
        setPointsUserId(null);
        setPointsDelta("");
        setPointsReason("");
        queryClient.invalidateQueries({ queryKey: ["users"] });
      }
    });
  };

  const { data: _auditData, refetch: auditZulip } = useAuditMissingUsers({ enabled: false });

  const auditMutation = useMutation({
    mutationFn: async () => {
      const result = await auditZulip();
      return result;
    },
    onSuccess: (data) => {
      setAuditResult(data?.data?.missingEmails || []);
      setShowZulipAudit(true);
    },
    onError: (err: unknown) => {
      toastApiError(err, "Audit failed");
    }
  });

  const inviteMutation = useInviteUsers({
    onSuccess: (data) => {
      toast.success(`Successfully invited ${data.invitedCount} users!`);
      setShowZulipAudit(false);
      setAuditResult(null);
    },
    onError: (err: unknown) => {
      toastApiError(err, "Invite failed");
    }
  });

  const columns = useMemo(() => [
    columnHelper.accessor("name", {
      header: "OPERATIVE",
      cell: info => (
        <a href={`/profile/${info.row.original.id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 hover:opacity-80 transition-opacity group/user">
          <div className="relative">
            <img src={info.row.original.image || `https://api.dicebear.com/9.x/bottts/svg?seed=${info.row.original.id}`}
              alt={`${info.row.original.nickname || info.row.original.name || "User"}'s avatar`} className="w-10 h-10 ares-cut-sm bg-obsidian border border-white/10 group-hover/user:border-ares-red/50 transition-all" />
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-ares-cyan rounded-full border-2 border-obsidian"></div>
          </div>
          <div>
            <span className="text-sm font-black text-white block uppercase tracking-wider group-hover/user:text-ares-red transition-colors">{info.row.original.nickname || info.getValue() || "ARES_OPERATIVE"}</span>
            <span className="text-[10px] text-marble/20 font-black uppercase tracking-widest">{`${info.row.original.id.slice(0, 8)} // NODE_ID`}</span>
          </div>
        </a>
      ),
    }),
    columnHelper.accessor("email", {
      header: "COMMS_CHANNEL",
      cell: info => <span className="text-xs font-black uppercase tracking-widest text-marble/40">{info.getValue() || "—"}</span>,
    }),
    columnHelper.accessor("role", {
      header: "AUTHORITY_LEVEL",
      cell: info => (
        <div className="relative inline-block">
          <select
            value={info.getValue() || "user"}
            onChange={e => changeRole(info.row.original.id, e.target.value)}
            title="Change user role"
            className={`appearance-none bg-black/40 border ares-cut-sm px-4 py-1.5 pr-8 text-[10px] font-black uppercase tracking-[0.2em] cursor-pointer focus:outline-none transition-all ${
              info.getValue() === "admin" ? "border-ares-red text-ares-red bg-ares-red/5" :
              info.getValue() === "author" ? "border-ares-gold text-ares-gold bg-ares-gold/5" :
              "border-white/10 text-marble/40 hover:border-white/20"
            }`}
          >
            {ROLES.map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-white/40" />
        </div>
      ),
    }),
    columnHelper.accessor("memberType", {
      header: "UNIT_CLASSIFICATION",
      cell: info => (
        <div className="relative inline-block">
          <select
            value={info.getValue() || "student"}
            onChange={e => changeMemberType(info.row.original.id, e.target.value)}
            title="Change member type"
            className={`appearance-none bg-black/40 border ares-cut-sm px-4 py-1.5 pr-8 text-[10px] font-black uppercase tracking-[0.2em] cursor-pointer focus:outline-none transition-all ${
              info.getValue() === "alumni" || info.getValue() === "alumnus" ? "border-ares-gold/50 text-ares-gold bg-ares-gold/5" :
              ["parent", "coach", "mentor", "sponsor"].includes(info.getValue() || "") ? "border-ares-gold/20 text-ares-gold/60" :
              "border-white/10 text-marble/40 hover:border-white/20"
            }`}
          >
            {MEMBER_TYPES.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-white/40" />
        </div>
      ),
    }),
    columnHelper.accessor("createdAt", {
      header: "COMMISSION_DATE",
      cell: info => <span className="text-[10px] font-black uppercase tracking-widest text-marble/40">{info.getValue() ? new Date(info.getValue() as string | number | Date).toLocaleDateString() : "—"}</span>,
    }),
    columnHelper.display({
      id: "actions",
      header: () => <div className="text-right">COMMAND_OVERRIDE</div>,
      cell: info => (
        <div className="flex items-center justify-end gap-2">
          {info.row.original.email && (
            <a href={`https://aresfirst.zulipchat.com/#narrow/pm-with/${info.row.original.email}`}
              target="_blank" rel="noopener noreferrer"
              title="Message on Zulip"
              aria-label={`Message ${info.row.original.name} on Zulip`}
              className="p-2.5 text-marble/20 hover:text-ares-cyan transition-all ares-cut-sm bg-white/5 hover:bg-ares-cyan/10 border border-white/5 hover:border-ares-cyan/20">
              <MessageSquare size={16} />
            </a>
          )}
          <button onClick={() => setPointsUserId(info.row.original.id)}
            title="Manage points"
            aria-label={`Manage points for ${info.row.original.name}`}
            className="p-2.5 text-marble/20 hover:text-ares-cyan transition-all ares-cut-sm bg-white/5 hover:bg-ares-cyan/10 border border-white/5 hover:border-ares-cyan/20">
            <Zap size={16} />
          </button>
          <button onClick={() => setEditUserId(info.row.original.id)}
            title="Edit user profile"
            aria-label={`Edit profile for ${info.row.original.name}`}
            className="p-2.5 text-marble/20 hover:text-ares-gold transition-all ares-cut-sm bg-white/5 hover:bg-ares-gold/10 border border-white/5 hover:border-ares-gold/20">
            <Edit3 size={16} />
          </button>
          <button onClick={() => removeUser(info.row.original.id, info.row.original.nickname || info.row.original.name || "user")}
            title="Remove user"
            aria-label={`Remove user ${info.row.original.name}`}
            className="p-2.5 text-marble/20 hover:text-ares-red transition-all ares-cut-sm bg-white/5 hover:bg-ares-red/10 border border-white/5 hover:border-ares-red/20">
            <Trash2 size={16} />
          </button>
        </div>
      ),
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [patchMutation, columnHelper, changeRole, changeMemberType]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: allUsers,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const { rows } = table.getRowModel();

  const exportToCSV = useCallback(() => {
    if (!allUsers || allUsers.length === 0) return;
    const headers = ["Name", "Email", "Role", "Member Type", "Joined"];
    const csvRows = [headers.join(",")];
    
    allUsers.forEach(u => {
      const row = [
        `"${(u.nickname || u.name || "").replace(/"/g, '""')}"`,
        `"${(u.email || "").replace(/"/g, '""')}"`,
        `"${u.role || ""}"`,
        `"${u.memberType || ""}"`,
        `"${u.createdAt ? new Date(u.createdAt as string | number | Date).toLocaleDateString() : ""}"`
      ];
      csvRows.push(row.join(","));
    });
    
    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `aresweb_users_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [allUsers]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><RefreshCw className="animate-spin text-ares-red" size={32} /></div>;
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-8 bg-black/40 border border-white/5 p-10 ares-cut-lg backdrop-blur-sm relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-1 h-0 bg-ares-red group-hover:h-full transition-all duration-700"></div>
        <div className="relative z-10">
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter leading-none flex items-center gap-4">
            <Shield size={32} className="text-ares-red" /> OPERATIVE_REGISTRY
          </h2>
          <p className="text-marble/20 text-[10px] font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2">
            <span className="w-6 h-px bg-white/10"></span>
            MANAGE_UNIT_AUTHORITY_AND_MERIT_RECORDS
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 relative z-10">
           <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
              <input
                type="text"
                value={globalFilter}
                onChange={e => setGlobalFilter(e.target.value)}
                placeholder="FILTER_OPERATIVES..."
                className="bg-black/40 border border-white/10 ares-cut-sm pl-12 pr-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white focus:border-ares-red outline-none transition-all w-full md:w-72 placeholder:text-white/5 shadow-inner"
              />
           </div>
           
           <button
             onClick={exportToCSV}
             className="flex items-center gap-3 bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-[0.2em] py-3 px-6 ares-cut-sm transition-all border border-white/10 text-[10px] shadow-lg shadow-black/20"
             title="Export users to CSV"
           >
             <Download size={16} />
             <span className="hidden sm:inline">EXPORT_DATA</span>
           </button>
           
           <button
             onClick={() => auditMutation.mutate()}
             disabled={auditMutation.isPending}
             className="flex items-center gap-3 bg-ares-red/10 hover:bg-ares-red text-white font-black uppercase tracking-[0.2em] py-3 px-6 ares-cut-sm transition-all border border-ares-red/30 text-[10px] disabled:opacity-50 shadow-lg shadow-ares-red/5"
             title="Audit missing Zulip users"
           >
             {auditMutation.isPending ? <RefreshCw size={16} className="animate-spin" /> : <Users size={16} />}
             <span className="hidden sm:inline">AUDIT_COMMS</span>
           </button>
           
           <div className="bg-ares-red/5 px-4 py-3 ares-cut-sm border border-ares-red/20 hidden lg:flex items-center gap-3">
             <div className="w-2 h-2 rounded-full bg-ares-red animate-pulse"></div>
             <span className="text-white/60 text-[10px] font-black uppercase tracking-[0.2em]">{allUsers.length} REGISTERED_NODES</span>
           </div>
        </div>
      </div>

      {isError && (
        <div className="bg-ares-red/10 border border-ares-red/30 p-6 ares-cut-lg text-ares-red text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-4 animate-pulse">
          <RefreshCw className="animate-spin" size={20} />
          TELEMETRY_FAULT: FAILED_TO_SYNCHRONIZE_USER_AUTHORITY_RECORDS
        </div>
      )}

      <div className="bg-black/40 border border-white/5 ares-cut-lg overflow-hidden backdrop-blur-sm shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-black/60 border-b border-white/10">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th 
                      key={header.id} 
                      className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.3em] text-marble/40 cursor-pointer hover:text-white transition-colors relative"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-3">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {{
                          asc: <ChevronUp size={14} className="text-ares-red" />,
                          desc: <ChevronDown size={14} className="text-ares-red" />,
                        }[header.column.getIsSorted() as string] ?? null}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map(row => (
                <tr 
                  key={row.id} 
                  className="hover:bg-white/[0.04] transition-all group"
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-8 py-5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {nextCursor && (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => setCursor(nextCursor)}
            disabled={isFetching}
            className="px-6 py-2 bg-obsidian border border-white/10 text-marble/60 hover:text-white hover:border-ares-red ares-cut transition-all disabled:opacity-50"
          >
            {isFetching ? "Loading..." : "Load More Users"}
          </button>
        </div>
      )}

      {editUserId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-center items-center p-4 sm:p-8 overflow-y-auto">
          <div className="bg-obsidian border border-white/10 ares-cut w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative">
            <div className="sticky top-0 right-0 z-10 flex justify-end p-4 pointer-events-none">
              <button 
                onClick={() => setEditUserId(null)} 
                title="Close editor"
                className="p-2 bg-obsidian border border-white/10 ares-cut-sm text-white/60 hover:text-white pointer-events-auto shadow-xl"
              >
                <X size={20} />
              </button>
            </div>
            <div className="px-6 pb-6 pt-2">
              <div className="mb-4 pb-4 border-b border-white/10">
                <h3 className="text-xl font-black text-ares-red flex items-center gap-2">
                  <Shield size={20} />
                  Admin Override: Managing Profile
                </h3>
                <p className="text-white/60 text-sm">You are editing another user&apos;s personal profile data.</p>
              </div>
              <ProfileEditor adminEditUserId={editUserId} />
            </div>
          </div>
        </div>
      )}

      {pointsUserId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-center items-center p-4 animate-in fade-in duration-300">
          <div className="bg-obsidian border border-white/10 ares-cut-lg w-full max-w-md shadow-2xl relative p-10 group overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-0 bg-ares-cyan group-hover:h-full transition-all duration-700"></div>
            <div className="flex justify-between items-start mb-8 pb-8 border-b border-white/5 relative z-10">
              <div>
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                  <Zap size={24} className="text-ares-cyan" /> MERIT_LOG
                </h3>
                <p className="text-marble/20 text-[10px] font-black uppercase tracking-[0.4em] mt-2">Award or deduct ARES points for this member.</p>
              </div>
              <button 
                onClick={() => setPointsUserId(null)} 
                title="Close"
                className="p-3 bg-white/5 border border-white/10 ares-cut-sm text-marble/40 hover:text-white hover:bg-white/10 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAwardPoints} className="space-y-8 relative z-10">
              <div className="space-y-2">
                <label htmlFor="pointsDeltaInput" className="text-[10px] font-black text-marble/40 uppercase tracking-[0.2em] block pl-1">QUANTUM_DELTA (+ / -)</label>
                <input
                  type="number"
                  value={pointsDelta}
                  onChange={(e) => setPointsDelta(e.target.value)}
                  placeholder="E.G. 50 OR -10"
                  className="w-full bg-black/40 border border-white/10 ares-cut-sm px-5 py-4 text-xs font-black uppercase tracking-widest text-white placeholder:text-white/5 focus:outline-none focus:border-ares-cyan transition-all"
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="pointsReasonInput" className="text-[10px] font-black text-marble/40 uppercase tracking-[0.2em] block pl-1">AUTHORIZATION_REASON</label>
                <input
                  type="text"
                  value={pointsReason}
                  onChange={(e) => setPointsReason(e.target.value)}
                  placeholder="E.G. OUTREACH_EVENT_ATTENDANCE"
                  className="w-full bg-black/40 border border-white/10 ares-cut-sm px-5 py-4 text-xs font-black uppercase tracking-widest text-white placeholder:text-white/5 focus:outline-none focus:border-ares-cyan transition-all"
                  required
                />
              </div>
              
              <button
                type="submit"
                disabled={pointsMutation.isPending}
                className="w-full mt-6 flex items-center justify-center gap-3 py-4 font-black uppercase tracking-[0.3em] text-[10px] bg-ares-cyan/10 text-ares-cyan border border-ares-cyan/30 hover:bg-ares-cyan hover:text-black ares-cut-sm transition-all duration-300 disabled:opacity-50 shadow-lg shadow-ares-cyan/5"
              >
                {pointsMutation.isPending ? <RefreshCw className="animate-spin" size={18} /> : <Zap size={18} />}
                {pointsMutation.isPending ? "SYNCHRONIZING..." : "COMMIT_TRANSACTION"}
              </button>
            </form>
          </div>
        </div>
      )}

      {showZulipAudit && auditResult && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-center items-center p-4 animate-in fade-in duration-300">
          <div className="bg-obsidian border border-white/10 ares-cut-lg w-full max-w-lg shadow-2xl relative p-10 group overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-0 bg-ares-cyan group-hover:h-full transition-all duration-700"></div>
            <div className="flex justify-between items-start mb-8 pb-8 border-b border-white/5 relative z-10">
              <div>
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                  <Mail size={24} className="text-ares-cyan" /> COMMS_AUDIT
                </h3>
                <p className="text-marble/20 text-[10px] font-black uppercase tracking-[0.4em] mt-2">Found {auditResult.length} ARESWEB users missing from Zulip.</p>
              </div>
              <button 
                onClick={() => { setShowZulipAudit(false); setAuditResult(null); }} 
                title="Close"
                className="p-3 bg-white/5 border border-white/10 ares-cut-sm text-marble/40 hover:text-white hover:bg-white/10 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6 relative z-10">
              <div className="bg-black/60 border border-white/10 ares-cut-sm p-6 max-h-64 overflow-y-auto shadow-inner">
                {auditResult.length === 0 ? (
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-marble/40 italic text-center py-8">
                    [ STATUS: ALL_SYSTEMS_NOMINAL ]<br/>
                    ALL_ARESWEB_USERS_ARE_ALREADY_IN_ZULIP
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {auditResult.map(email => (
                      <li key={email} className="text-[10px] font-black uppercase tracking-widest text-marble bg-white/5 px-4 py-3 border border-white/5 flex items-center gap-3">
                        <div className="w-1.5 h-1.5 bg-ares-cyan"></div>
                        {email}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              
              {auditResult.length > 0 && (
                <button
                  onClick={() => inviteMutation.mutate({ emails: auditResult })}
                  disabled={inviteMutation.isPending}
                  className="w-full flex items-center justify-center gap-3 py-4 font-black uppercase tracking-[0.3em] text-[10px] bg-ares-cyan/10 text-ares-cyan border border-ares-cyan/30 hover:bg-ares-cyan hover:text-black ares-cut-sm transition-all duration-300 disabled:opacity-50 shadow-lg shadow-ares-cyan/5"
                >
                  {inviteMutation.isPending ? <RefreshCw className="animate-spin" size={18} /> : <Mail size={18} />}
                  {inviteMutation.isPending ? "DISPATCHING_INVITES..." : `INITIALIZE_${auditResult.length}_INVITES`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


