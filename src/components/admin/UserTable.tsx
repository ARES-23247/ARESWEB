import { flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel, useReactTable, createColumnHelper, SortingState } from '@tanstack/react-table';
import { MessageSquare, Zap, Edit3, Trash2, ChevronDown } from 'lucide-react';
import { memo } from 'react';
import { ROLES, MEMBER_TYPES } from './adminConstants';

const ROLE_COLORS: Record<string, string> = {
  admin: 'border-ares-red text-ares-red',
  author: 'border-ares-gold text-ares-gold',
  user: 'border-white/20 text-white/60',
  unverified: 'border-white/20 text-white/60',
};

const MEMBER_TYPE_COLORS: Record<string, string> = {
  alumni: 'border-ares-gold/50 text-ares-gold',
  student: 'border-white/20 text-white/60',
  parent: 'border-ares-gold/30 text-ares-gold/70',
  coach: 'border-ares-gold/30 text-ares-gold/70',
  mentor: 'border-ares-gold/30 text-ares-gold/70',
  sponsor: 'border-ares-gold/30 text-ares-gold/70',
};

interface User {
  id: string;
  name: string | null;
  image?: string | null;
  role: string;
  createdAt: number;
  nickname?: string | null;
  member_type?: string | null;
  email?: string | null;
}

interface UserTableProps {
  users: User[];
  sorting: SortingState;
  onSortingChange: (updater: import('@tanstack/table-core').Updater<SortingState>) => void;
  globalFilter: string;
  onGlobalFilterChange: (value: string) => void;
  onRoleChange: (userId: string, newRole: string) => void;
  onMemberTypeChange: (userId: string, newType: string) => void;
  onEditUser: (userId: string) => void;
  onManagePoints: (userId: string) => void;
  onDeleteUser: (userId: string, name: string) => void;
}

export const UserTable = memo(function UserTable({
  users,
  sorting,
  onSortingChange,
  globalFilter,
  onGlobalFilterChange,
  onRoleChange,
  onMemberTypeChange,
  onEditUser,
  onManagePoints,
  onDeleteUser,
}: UserTableProps) {
  const columnHelper = createColumnHelper<User>();

  const columns = [
    columnHelper.accessor('name', {
      header: 'User',
      cell: info => (
        <a href={`/profile/${info.row.original.id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <img src={info.row.original.image || `https://api.dicebear.com/9.x/bottts/svg?seed=${info.row.original.id}`}
            alt={`${info.row.original.nickname || info.row.original.name || "User"}'s avatar`} className="w-8 h-8 ares-cut-sm bg-obsidian" />
          <div>
            <span className="text-sm font-bold text-white block hover:text-ares-red">{info.row.original.nickname || info.getValue() || "ARES Member"}</span>
            <span className="text-[10px] text-white/40 font-mono">{info.row.original.id.slice(0, 8)}</span>
          </div>
        </a>
      ),
    }),
    columnHelper.accessor('email', {
      header: 'Email',
      cell: info => <span className="text-sm text-white/60">{info.getValue() || '—'}</span>,
    }),
    columnHelper.accessor('role', {
      header: 'Role',
      cell: info => (
        <div className="relative inline-block">
          <select
            value={info.getValue() || 'user'}
            onChange={e => onRoleChange(info.row.original.id, e.target.value)}
            title="Change user role"
            className={`appearance-none bg-transparent border ares-cut-sm px-3 py-1 pr-7 text-xs font-bold cursor-pointer focus:outline-none ${ROLE_COLORS[info.getValue() || 'user']}`}
          >
            {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-white/60" />
        </div>
      ),
    }),
    columnHelper.accessor('member_type', {
      header: 'Type',
      cell: info => (
        <div className="relative inline-block">
          <select
            value={info.getValue() || 'student'}
            onChange={e => onMemberTypeChange(info.row.original.id, e.target.value)}
            title="Change member type"
            className={`appearance-none bg-transparent border ares-cut-sm px-3 py-1 pr-7 text-xs font-bold cursor-pointer focus:outline-none capitalize ${MEMBER_TYPE_COLORS[info.getValue() || 'student']}`}
          >
            {MEMBER_TYPES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-white/60" />
        </div>
      ),
    }),
    columnHelper.accessor('createdAt', {
      header: 'Joined',
      cell: info => <span className="text-xs text-white/60">{info.getValue() ? new Date(info.getValue()).toLocaleDateString() : '—'}</span>,
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <div className="text-right">Actions</div>,
      cell: info => (
        <div className="text-right">
          {info.row.original.email && (
            <a href={`https://aresfirst.zulipchat.com/#narrow/pm-with/${info.row.original.email}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Message on Zulip"
              aria-label={`Message ${info.row.original.name} on Zulip`}
              className="inline-block p-2 mr-1 text-white/60 hover:text-ares-cyan transition-all ares-cut-sm hover:bg-ares-cyan/10">
              <MessageSquare size={18} />
            </a>
          )}
          <button onClick={() => onManagePoints(info.row.original.id)}
            title="Manage points"
            aria-label={`Manage points for ${info.row.original.name}`}
            className="p-2 mr-1 text-white/60 hover:text-ares-cyan transition-all ares-cut-sm hover:bg-ares-cyan/10">
            <Zap size={18} />
          </button>
          <button onClick={() => onEditUser(info.row.original.id)}
            title="Edit user profile"
            aria-label={`Edit profile for ${info.row.original.name}`}
            className="p-2 mr-1 text-white/60 hover:text-ares-gold transition-all ares-cut-sm hover:bg-ares-gold/10">
            <Edit3 size={18} />
          </button>
          <button onClick={() => onDeleteUser(info.row.original.id, info.row.original.nickname || info.row.original.name || 'user')}
            title="Remove user"
            aria-label={`Remove user ${info.row.original.name}`}
            className="p-2 text-white/60 hover:text-ares-red transition-all ares-cut-sm hover:bg-ares-red/10">
            <Trash2 size={18} />
          </button>
        </div>
      ),
    }),
  ];

  const table = useReactTable({
    data: users,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: onSortingChange,
    onGlobalFilterChange: onGlobalFilterChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const { rows } = table.getRowModel();

  return (
    <div className="overflow-x-auto bg-black/40 border border-white/5 ares-cut-lg">
      <table className="w-full text-left border-collapse">
        <thead className="sticky top-0 z-20 bg-ares-gray-deep/95 backdrop-blur-md shadow-sm">
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
                    {header.column.getIsSorted() === 'asc' && <ChevronDown size={14} />}
                    {header.column.getIsSorted() === 'desc' && <ChevronDown size={14} className="rotate-180" />}
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
              className="hover:bg-white/[0.03] transition-colors group"
            >
              {row.getVisibleCells().map(cell => (
                <td key={cell.id} className="px-4 py-2">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
