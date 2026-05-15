import React, { useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
  ExpandedState,
  getExpandedRowModel
} from "@tanstack/react-table";
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronRight, ChevronDown } from "lucide-react";
import type { TaskNode } from "../TaskBoardPage";
import { statusConfig, priorityBadge } from "../command/ProjectBoardKanban";

interface TaskTableViewProps {
  tasks: TaskNode[];
  onRowClick?: (task: TaskNode) => void;
}

const columnHelper = createColumnHelper<TaskNode>();

const columns = [
  columnHelper.accessor("id", {
    header: "SECTOR_ID",
    cell: info => <span className="text-marble/20 font-mono text-[10px] tracking-widest uppercase">{info.getValue().split("-")[0]}</span>,
    enableSorting: false,
  }),
  columnHelper.accessor("title", {
    header: "OBJECTIVE_TITLE",
    cell: info => {
      const row = info.row;
      return (
        <div 
          className="flex items-center gap-3 font-black text-white text-[11px] uppercase tracking-wider max-w-xs md:max-w-md truncate" 
          title={info.getValue()}
          style={{ paddingLeft: `${row.depth * 1.5}rem` }}
        >
          {row.getCanExpand() ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                row.toggleExpanded();
              }}
              className="p-1 hover:bg-white/10 ares-cut-sm flex-shrink-0 text-ares-cyan border border-transparent hover:border-white/10"
            >
              {row.getIsExpanded() ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span className="w-6 inline-block flex-shrink-0" />
          )}
          <span className="truncate">{info.getValue()}</span>
        </div>
      );
    },
  }),
  columnHelper.accessor("status", {
    header: "DEPLOYMENT_STATUS",
    cell: info => {
      const s = info.getValue() || "todo";
      const config = statusConfig[s as keyof typeof statusConfig] || { bg: "bg-white/5", text: "text-marble/20", border: "border-white/5", label: s };
      return (
        <span className={`px-3 py-1 ares-cut-sm text-[9px] font-black uppercase tracking-[0.15em] border whitespace-nowrap ${config.bg} ${config.text} ${config.border}`}>
          {config.label}
        </span>
      );
    },
  }),
  columnHelper.accessor("priority", {
    header: "THREAT_LEVEL",
    cell: info => {
      const p = info.getValue() || "normal";
      const bClass = priorityBadge[p as keyof typeof priorityBadge] || priorityBadge["normal"];
      return (
        <span className={`px-2.5 py-1 ares-cut-sm text-[9px] font-black uppercase tracking-[0.2em] border ${bClass}`}>
          {p}
        </span>
      );
    },
  }),
  columnHelper.accessor("subteam", {
    header: "ASSIGNED_SECTOR",
    cell: info => info.getValue() ? <span className="text-[10px] font-black uppercase tracking-widest text-ares-cyan">{info.getValue()}</span> : <span className="text-marble/10">-</span>,
  }),
  columnHelper.accessor("assignees", {
    header: "OPERATIONAL_ASSETS",
    cell: info => {
      const assignees = info.getValue();
      if (!assignees || assignees.length === 0) return <span className="text-[10px] font-black uppercase tracking-tighter text-marble/10">UNASSIGNED</span>;
      return (
        <div className="flex -space-x-2">
          {assignees.map(a => (
            <div key={a.id} className="w-7 h-7 ares-cut-sm bg-black border border-white/10 flex items-center justify-center text-[10px] font-black text-ares-cyan shadow-lg" title={a.nickname || 'Unknown'}>
              {a.nickname ? a.nickname.substring(0, 1).toUpperCase() : '?'}
            </div>
          ))}
        </div>
      );
    },
    enableSorting: false,
  }),
  columnHelper.accessor("dueDate", {
    header: "TERMINATION_DATE",
    cell: info => info.getValue() ? <span className="text-[10px] font-mono text-marble/60 uppercase tracking-tighter">{info.getValue()}</span> : <span className="text-marble/10">-</span>,
  }),
  columnHelper.accessor("timeSpentSeconds", {
    header: "MISSION_CLOCK",
    cell: info => {
      const seconds = info.getValue() || 0;
      if (seconds === 0) return <span className="text-marble/10">-</span>;
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      return <span className="text-[10px] font-black text-ares-gold uppercase tracking-widest">{h}H {m}M</span>;
    },
  }),
];

export function TaskTableView({ tasks, onRowClick }: TaskTableViewProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [expanded, setExpanded] = useState<ExpandedState>({});

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table API is not yet React Compiler compatible
  const table = useReactTable({
    data: tasks,
    columns,
    state: {
      sorting,
      expanded,
    },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSubRows: row => row.subRows,
  });

  return (
    <div className="w-full h-full overflow-auto bg-obsidian custom-scrollbar rounded-lg border border-white/5">
      <table className="w-full text-left text-sm whitespace-nowrap">
        <thead className="sticky top-0 bg-black z-10 shadow-sm border-b border-white/10">
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => {
                const canSort = header.column.getCanSort();
                return (
                  <th
                    key={header.id}
                    className={`px-5 py-4 font-black text-marble/20 uppercase tracking-[0.3em] text-[10px] bg-black/40 ${canSort ? "cursor-pointer select-none hover:text-white hover:bg-white/5 transition-all" : ""}`}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-2">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort && (
                        <span className="text-ares-gray/50">
                          {{
                            asc: <ArrowUp size={12} className="text-ares-cyan" />,
                            desc: <ArrowDown size={12} className="text-ares-cyan" />,
                          }[header.column.getIsSorted() as string] ?? (
                            <ArrowUpDown size={12} />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-white/5">
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-ares-gray">
                No tasks match your current filters.
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map(row => (
              <tr 
                key={row.id} 
                className={`hover:bg-white/5 transition-colors ${onRowClick ? "cursor-pointer" : ""}`}
                onClick={() => onRowClick && onRowClick(row.original)}
              >
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-4 py-3 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
