import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, MessageSquare, Mail, CheckSquare, Clock, Search, ChevronUp, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { adminApi } from "../api/adminApi";
import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from "@tanstack/react-table";

type Inquiry = {
  id: string;
  type: string;
  name: string;
  email: string;
  metadata: string;
  status: string;
  created_at: string;
};

import DashboardPageHeader from "./dashboard/DashboardPageHeader";
import DashboardEmptyState from "./dashboard/DashboardEmptyState";
import DashboardLoadingGrid from "./dashboard/DashboardLoadingGrid";

export default function AdminInquiries() {
  const queryClient = useQueryClient();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const { data: inquiries = [], isLoading, isError } = useQuery({
    queryKey: ["admin-inquiries"],
    queryFn: async () => {
      const d = await adminApi.get<{ inquiries?: Inquiry[] }>("/api/inquiries");
      return d.inquiries || [];
    }
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await adminApi.updateInquiryStatus(id, status);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-inquiries"] })
  });

  const deleteInquiry = useMutation({
    mutationFn: async (id: string) => {
      await adminApi.deleteInquiry(id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-inquiries"] })
  });

  const columnHelper = createColumnHelper<Inquiry>();

  const columns = useMemo(() => [
    columnHelper.accessor("created_at", {
      header: "Date",
      cell: info => format(new Date(info.getValue()), "MMM d, yyyy"),
      sortingFn: "datetime",
    }),
    columnHelper.accessor("type", {
      header: "Type",
      cell: info => (
        <span className={`px-2 py-0.5 ares-cut-xs text-[10px] font-black uppercase ${
          info.getValue() === "student" ? "bg-ares-red text-white" : 
          info.getValue() === "mentor" ? "bg-ares-gold text-black" : "bg-ares-cyan text-black"
        }`}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor("name", {
      header: "Sender",
      cell: info => (
        <div className="flex flex-col">
          <span className="font-bold text-white">{info.getValue()}</span>
          <span className="text-xs text-marble/40 flex items-center gap-1"><Mail size={10} /> {info.row.original.email}</span>
        </div>
      ),
    }),
    columnHelper.accessor("status", {
      header: "Status",
      cell: info => (
        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
          info.getValue() === 'pending' ? 'bg-ares-gold/20 text-ares-gold border border-ares-gold/30' : 'bg-ares-cyan/20 text-ares-cyan border border-ares-cyan/30'
        }`}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      cell: info => (
        <div className="flex items-center gap-2">
          {info.row.original.status === 'pending' ? (
            <button onClick={() => updateStatus.mutate({ id: info.row.original.id, status: 'resolved' })} 
              className="p-2 bg-white/5 hover:bg-ares-cyan/20 text-marble/40 hover:text-ares-cyan transition-all ares-cut-xs" 
              title="Mark Resolved"
            >
              <CheckSquare size={14} />
            </button>
          ) : (
            <button onClick={() => updateStatus.mutate({ id: info.row.original.id, status: 'pending' })} 
              className="p-2 bg-white/5 hover:bg-ares-gold/20 text-marble/40 hover:text-ares-gold transition-all ares-cut-xs" 
              title="Mark Pending"
            >
              <Clock size={14} />
            </button>
          )}
          <button onClick={() => { if(confirm("Delete inquiry?")) deleteInquiry.mutate(info.row.original.id); }} 
            className="p-2 bg-white/5 hover:bg-ares-red/20 text-marble/40 hover:text-ares-red transition-all ares-cut-xs" 
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    }),
  ], [updateStatus, deleteInquiry, columnHelper]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: inquiries,
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

      <div className="flex flex-col md:flex-row gap-4 mb-6">
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
      </div>

      <div className="bg-black/40 border border-white/5 ares-cut-lg overflow-hidden">
        {isLoading ? (
          <DashboardLoadingGrid count={5} heightClass="h-12" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id} className="border-b border-white/5 bg-white/5">
                    {headerGroup.headers.map(header => (
                      <th 
                        key={header.id} 
                        className="px-6 py-4 text-xs font-black uppercase tracking-widest text-marble/40 cursor-pointer hover:text-white transition-colors"
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
              <tbody className="divide-y divide-white/5">
                {table.getRowModel().rows.map(row => (
                  <tr key={row.id} className="hover:bg-white/5 transition-colors group">
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-6 py-4 text-sm text-marble/80">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {inquiries.length === 0 && !isLoading && (
          <DashboardEmptyState
            className="py-16 text-center"
            icon={<MessageSquare size={32} />}
            message="No active inquiries or applications."
          />
        )}
      </div>
    </div>
  );
}
