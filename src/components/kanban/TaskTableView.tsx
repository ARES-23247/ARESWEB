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
    header: "ID",
    cell: info => <span className="text-ares-gray text-xs">{info.getValue().split("-")[0]}</span>,
    enableSorting: false,
  }),
  columnHelper.accessor("title", {
    header: "Title",
    cell: info => {
      const row = info.row;
      return (
        <div 
          className="flex items-center gap-2 font-medium text-white/90 max-w-xs md:max-w-md truncate" 
          title={info.getValue()}
          style={{ paddingLeft: `${row.depth * 1.5}rem` }}
        >
          {row.getCanExpand() ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                row.toggleExpanded();
              }}
              className="p-0.5 hover:bg-white/10 rounded flex-shrink-0 text-ares-gray"
            >
              {row.getIsExpanded() ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span className="w-[18px] inline-block flex-shrink-0" />
          )}
          <span className="truncate">{info.getValue()}</span>
        </div>
      );
    },
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: info => {
      const s = info.getValue();
      const config = statusConfig[s] || { bg: "bg-ares-gray/20", text: "text-ares-gray" };
      return (
        <span className={`px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${config.bg} ${config.text}`}>
          {config.label || s}
        </span>
      );
    },
  }),
  columnHelper.accessor("priority", {
    header: "Priority",
    cell: info => {
      const p = info.getValue();
      const bClass = priorityBadge[p] || priorityBadge["normal"];
      return (
        <span className={`px-2 py-0.5 rounded text-xs uppercase tracking-wider ${bClass}`}>
          {p}
        </span>
      );
    },
  }),
  columnHelper.accessor("subteam", {
    header: "Subteam",
    cell: info => info.getValue() ? <span className="text-sm text-ares-cyan">{info.getValue()}</span> : <span className="text-ares-gray/50">-</span>,
  }),
  columnHelper.accessor("assignees", {
    header: "Assignee(s)",
    cell: info => {
      const assignees = info.getValue();
      if (!assignees || assignees.length === 0) return <span className="text-ares-gray/50">Unassigned</span>;
      return (
        <div className="flex -space-x-2">
          {assignees.map(a => (
            <div key={a.id} className="w-6 h-6 rounded-full bg-ares-gray-dark border border-obsidian flex items-center justify-center text-[10px] text-white" title={a.nickname || 'Unknown'}>
              {a.nickname ? a.nickname.substring(0, 2).toUpperCase() : '?'}
            </div>
          ))}
        </div>
      );
    },
    enableSorting: false,
  }),
  columnHelper.accessor("dueDate", {
    header: "Due",
    cell: info => info.getValue() ? <span className="text-sm text-white/70">{info.getValue()}</span> : <span className="text-ares-gray/50">-</span>,
  }),
  columnHelper.accessor("timeSpentSeconds", {
    header: "Time Logged",
    cell: info => {
      const seconds = info.getValue() || 0;
      if (seconds === 0) return <span className="text-ares-gray/50">-</span>;
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      return <span className="text-sm text-white/70">{h}h {m}m</span>;
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
                    className={`px-4 py-3 font-semibold text-ares-gray uppercase tracking-wider text-xs ${canSort ? "cursor-pointer select-none hover:text-white transition-colors" : ""}`}
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
