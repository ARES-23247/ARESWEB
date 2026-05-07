import { Search } from 'lucide-react';
import { useQueryState } from 'nuqs';

export function UserFilters() {
  const [globalFilter, setGlobalFilter] = useQueryState('q', { defaultValue: '' });

  return (
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
  );
}
