import * as Dialog from "@radix-ui/react-dialog";
import { AlertCircle, CheckCircle, Search, UserCheck } from "lucide-react";

interface UserDirectoryNoticesProps {
  success: string | null;
  error: string | null;
  zulipWarning: string | null;
  pendingCount: number;
  onViewPending: () => void;
}

export function UserDirectoryNotices({ success, error, zulipWarning, pendingCount, onViewPending }: UserDirectoryNoticesProps) {
  return (
    <>
      {success && (
        <div role="status" className="p-4 bg-ares-gold/10 border border-ares-gold/30 text-white rounded flex items-center gap-3 text-sm font-semibold">
          <CheckCircle aria-hidden="true" size={18} className="text-ares-gold shrink-0" />
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div role="alert" className="p-4 bg-ares-red/10 border border-ares-red/30 text-white rounded flex items-center gap-3 text-sm font-semibold">
          <AlertCircle aria-hidden="true" size={18} className="text-ares-red shrink-0" />
          <span className="font-mono">{error}</span>
        </div>
      )}
      {zulipWarning && (
        <div role="status" className="p-4 bg-ares-gold/10 border border-ares-gold/30 text-white rounded flex items-center gap-3 text-sm font-semibold">
          <AlertCircle aria-hidden="true" size={18} className="text-ares-gold shrink-0" />
          <div className="flex-1">
            <span className="font-bold text-ares-gold uppercase tracking-wider text-xs block mb-1">Zulip API Notice</span>
            <span className="text-marble/80 text-xs font-mono">{zulipWarning}</span>
          </div>
        </div>
      )}
      {pendingCount > 0 && (
        <div className="p-4 bg-ares-gold/15 border border-ares-gold/40 text-white rounded flex items-center justify-between gap-3 text-sm font-semibold animate-fade-in shadow-xl">
          <div className="flex items-center gap-3">
            <UserCheck aria-hidden="true" size={22} className="text-ares-gold animate-pulse shrink-0" />
            <div>
              <span className="font-bold text-ares-gold uppercase tracking-wider text-xs block">{pendingCount} User(s) Pending Role Verification</span>
              <span className="text-marble/80 text-xs">Newly registered team members are awaiting role assignment (Admin, Mentor, or Member).</span>
            </div>
          </div>
          <button type="button" onClick={onViewPending} className="px-3 py-1.5 bg-ares-gold/20 hover:bg-ares-gold text-ares-gold hover:text-black border border-ares-gold/50 rounded text-xs font-black uppercase tracking-wider transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">
            View Pending ({pendingCount})
          </button>
        </div>
      )}
    </>
  );
}

interface UserDirectoryFiltersProps {
  searchQuery: string;
  roleFilter: string;
  statusFilter: string;
  sortBy: string;
  onSearchChange: (value: string) => void;
  onRoleChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onSortChange: (value: string) => void;
}

export function UserDirectoryFilters({ searchQuery, roleFilter, statusFilter, sortBy, onSearchChange, onRoleChange, onStatusChange, onSortChange }: UserDirectoryFiltersProps) {
  return (
    <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white/5 p-4 ares-cut border border-white/5">
      <div className="relative w-full md:w-56">
        <label htmlFor="user-search" className="sr-only">Search users</label>
        <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-marble/40" size={14} />
        <input id="user-search" type="text" placeholder="Search users..." value={searchQuery} onChange={(event) => onSearchChange(event.target.value)} className="w-full bg-obsidian border border-white/10 ares-cut-sm pl-9 pr-4 py-2 text-xs text-white placeholder-marble/30 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/10 transition-all font-semibold" />
      </div>
      <div className="flex flex-wrap md:flex-nowrap gap-3 w-full md:w-auto">
        <select aria-label="Filter users by portal role" value={roleFilter} onChange={(event) => onRoleChange(event.target.value)} className="bg-obsidian border border-white/10 ares-cut-sm px-3 py-2 text-xs text-white cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan font-bold">
          <option value="all">All Roles</option><option value="admin">Admin / Coach</option><option value="mentor">Mentor / Lead</option><option value="member">Member</option><option value="unverified">Unverified</option>
        </select>
        <select aria-label="Filter users by registration status" value={statusFilter} onChange={(event) => onStatusChange(event.target.value)} className="bg-obsidian border border-white/10 ares-cut-sm px-3 py-2 text-xs text-white cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan font-bold">
          <option value="all">All Statuses</option><option value="registered">Registered Profile</option><option value="invited">Invited / Legacy</option><option value="unlinked_zulip">Unlinked Zulip</option>
        </select>
        <select aria-label="Sort users" value={sortBy} onChange={(event) => onSortChange(event.target.value)} className="bg-obsidian border border-ares-gold/30 text-ares-gold ares-cut-sm px-3 py-2 text-xs cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan font-black uppercase tracking-wider">
          <option value="name_asc">Sort: Name (A-Z)</option><option value="name_desc">Sort: Name (Z-A)</option><option value="role">Sort: Role Hierarchy</option><option value="status">Sort: Registration</option><option value="newest">Sort: Newest Joined</option><option value="oldest">Sort: Oldest Joined</option>
        </select>
      </div>
    </div>
  );
}

interface RevocationTarget {
  name: string;
  email: string;
}

interface UserRevocationDialogProps {
  target: RevocationTarget | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function UserRevocationDialog({ target, onOpenChange, onConfirm }: UserRevocationDialogProps) {
  return (
    <Dialog.Root open={target !== null} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-ares-red/40 bg-obsidian p-6 shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">
          <Dialog.Title className="font-heading text-xl font-black uppercase text-white">Revoke roster access?</Dialog.Title>
          <Dialog.Description className="mt-3 text-sm leading-relaxed text-marble/80">
            {target ? `${target.name || target.email} will be signed out of team tools. Their profile and audit history will be archived, not deleted, and an administrator can restore access later.` : "The account will be archived."}
          </Dialog.Description>
          <div className="mt-6 flex justify-end gap-3">
            <Dialog.Close asChild><button type="button" className="rounded border border-white/15 px-4 py-2 text-xs font-black uppercase text-marble hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">Cancel</button></Dialog.Close>
            <button type="button" onClick={onConfirm} className="rounded bg-ares-red px-4 py-2 text-xs font-black uppercase text-white hover:bg-ares-red/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">Revoke access</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
