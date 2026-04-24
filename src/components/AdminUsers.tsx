import { useState, useMemo, useRef, useCallback } from "react";
import { RefreshCw, Shield, Trash2, ChevronDown, Edit3, X, Search, ChevronUp } from "lucide-react";
import ProfileEditor from "./ProfileEditor";
import { api } from "../api/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useQueryState } from "nuqs";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from "@tanstack/react-table";

const ROLES = ["unverified", "user", "author", "admin"];
const MEMBER_TYPES = ["student", "alumni", "parent", "coach", "mentor", "sponsor"];

type User = {
  id: string;
  name: string;
  image: string | null;
  role: string;
  createdAt: number;
  nickname?: string;
  member_type?: string;
  email?: string;
};

export default function AdminUsers() {
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useQueryState("q", { defaultValue: "" });
  const parentRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = api.users.getUsers.useQuery(["admin_users"], {});

  const users = (data?.body?.users || []) as User[];

  const patchMutation = api.users.patchUser.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
      toast.success("User updated");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Update failed");
    }
  });

  const changeRole = useCallback((userId: string, newRole: string) => {
    patchMutation.mutate({ params: { id: userId }, body: { role: newRole } });
  }, [patchMutation]);

  const removeUser = (userId: string, name: string) => {
    if (!confirm(`Remove ${name}? This cannot be undone.`)) return;
    toast.info("Delete functionality to be implemented in contract fully");
  };

  const columnHelper = useMemo(() => createColumnHelper<User>(), []);

  const columns = useMemo(() => [
    columnHelper.accessor("name", {
      header: "User",
      cell: info => (
        <a href={`/profile/${info.row.original.id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <img src={info.row.original.image || `https://api.dicebear.com/9.x/bottts/svg?seed=${info.row.original.id}`}
            alt="" className="w-8 h-8 ares-cut-sm bg-obsidian" />
          <div>
            <span className="text-sm font-bold text-white block hover:text-ares-red">{info.row.original.nickname || info.getValue() || "ARES Member"}</span>
            <span className="text-[10px] text-white/40 font-mono">{info.row.original.id.slice(0, 8)}</span>
          </div>
        </a>
      ),
    }),
    columnHelper.accessor("email", {
      header: "Email",
      cell: info => <span className="text-sm text-white/60">{info.getValue() || "—"}</span>,
    }),
    columnHelper.accessor("role", {
      header: "Role",
      cell: info => (
        <div className="relative inline-block">
          <select
            value={info.getValue() || "user"}
            onChange={e => changeRole(info.row.original.id, e.target.value)}
            title="Change user role"
            className={`appearance-none bg-transparent border ares-cut-sm px-3 py-1 pr-7 text-xs font-bold cursor-pointer focus:outline-none ${
              info.getValue() === "admin" ? "border-ares-red/50 text-ares-red" :
              info.getValue() === "author" ? "border-ares-gold/50 text-ares-gold" :
              "border-white/20 text-white/60"
            }`}
          >
            {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-white/60" />
        </div>
      ),
    }),
    columnHelper.accessor("member_type", {
      header: "Type",
      cell: info => (
        <div className="relative inline-block">
          <select
            value={info.getValue() || "student"}
            title="Change member type"
            className={`appearance-none bg-transparent border ares-cut-sm px-3 py-1 pr-7 text-xs font-bold cursor-pointer focus:outline-none capitalize ${
              info.getValue() === "alumni" ? "border-ares-gold/50 text-ares-gold" :
              ["parent", "coach", "mentor", "sponsor"].includes(info.getValue() || "") ? "border-ares-gold/30 text-ares-gold/70" :
              "border-white/20 text-white/60"
            }`}
          >
            {MEMBER_TYPES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-white/60" />
        </div>
      ),
    }),
    columnHelper.accessor("createdAt", {
      header: "Joined",
      cell: info => <span className="text-xs text-white/60">{info.getValue() ? new Date(info.getValue()).toLocaleDateString() : "—"}</span>,
    }),
    columnHelper.display({
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: info => (
        <div className="text-right">
          <button onClick={() => setEditUserId(info.row.original.id)}
            title="Edit user profile"
            aria-label={`Edit profile for ${info.row.original.name}`}
            className="p-2 mr-1 text-white/60 hover:text-ares-gold transition-all ares-cut-sm hover:bg-ares-gold/10">
            <Edit3 size={18} />
          </button>
          <button onClick={() => removeUser(info.row.original.id, info.row.original.nickname || info.row.original.name || "user")}
            title="Remove user"
            aria-label={`Remove user ${info.row.original.name}`}
            className="p-2 text-white/60 hover:text-ares-red transition-all ares-cut-sm hover:bg-ares-red/10">
            <Trash2 size={18} />
          </button>
        </div>
      ),
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [patchMutation, columnHelper, changeRole]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: users,
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

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 10,
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><RefreshCw className="animate-spin text-ares-red" size={32} /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
          <Shield size={20} className="text-ares-red" /> User Management
        </h2>
        <div className="flex items-center gap-4">
           <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
              <input
                type="text"
                value={globalFilter}
                onChange={e => setGlobalFilter(e.target.value)}
                placeholder="Search users..."
                className="bg-white/5 border border-white/10 ares-cut-sm pl-10 pr-4 py-2 text-sm text-white focus:border-ares-red outline-none transition-all w-64"
              />
           </div>
           <span className="text-white/60 text-sm font-bold whitespace-nowrap">{users.length} registered</span>
        </div>
      </div>

      {isError && (
        <div className="bg-ares-red/10 border border-ares-red/30 p-4 ares-cut-sm text-ares-red text-xs font-bold mb-6 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-ares-red animate-pulse" />
          TELEMETRY FAULT: Failed to synchronize user authority records.
        </div>
      )}

      <div className="overflow-x-auto bg-black/40 border border-white/5 ares-cut-lg">
        <div ref={parentRef} className="max-h-[600px] overflow-y-auto relative scrollbar-thin scrollbar-thumb-white/10">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-20 bg-ares-gray-deep/95 backdrop-blur-md">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id} className="border-b border-white/10 bg-white/5">
                  {headerGroup.headers.map(header => (
                    <th 
                      key={header.id} 
                      className="px-4 py-4 text-xs font-black uppercase tracking-widest text-white/40 cursor-pointer hover:text-white transition-colors"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-2">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {{
                          asc: <ChevronUp size={14} />,
                          desc: <ChevronDown size={14} />,
                        }[header.column.getIsSorted() as string] ?? null}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody 
              className="relative"
              style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
            >
              {rowVirtualizer.getVirtualItems().map(virtualRow => {
                const row = rows[virtualRow.index];
                if (!row) return null;
                return (
                  <tr 
                    key={row.id} 
                    className="hover:bg-white/[0.03] transition-colors group absolute w-full flex border-b border-white/5"
                    style={{ 
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`
                    }}
                  >
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-4 py-2 flex items-center flex-1 overflow-hidden">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

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
    </div>
  );
}
