import React from 'react';
import { useQuery } from '@tanstack/react-query';

interface Contributor {
  id: number;
  user_id: string;
  user_name: string;
  user_avatar: string | null;
}

interface ContributorStackProps {
  roomId: string;
  max?: number;
}

export function ContributorStack({ roomId, max = 5 }: ContributorStackProps) {
  const { data: contributors = [], isLoading } = useQuery<Contributor[]>({
    queryKey: ['contributors', roomId],
    queryFn: async () => {
      const res = await fetch(`/api/liveblocks/contributors/${roomId}`);
      if (!res.ok) throw new Error('Failed to fetch contributors');
      const data = await res.json() as { contributors?: Contributor[] };
      return data.contributors || [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  if (isLoading || contributors.length === 0) return null;

  const displayContributors = contributors.slice(0, max);
  const extraCount = Math.max(0, contributors.length - max);

  return (
    <div className="flex items-center -space-x-2">
      {displayContributors.map((c, i) => (
        <div 
          key={c.id}
          className="relative group inline-block rounded-full border-2 border-obsidian hover:z-20 transition-transform hover:scale-110"
          style={{ zIndex: 10 - i }}
        >
          {c.user_avatar ? (
            <img 
              src={c.user_avatar} 
              alt={c.user_name} 
              className="w-8 h-8 rounded-full object-cover bg-obsidian"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-ares-red/80 flex items-center justify-center text-xs font-bold text-white uppercase shadow-inner">
              {c.user_name.substring(0, 2)}
            </div>
          )}
          {/* Tooltip */}
          <div className="absolute top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-[10px] font-bold px-2 py-1 rounded ares-cut-sm pointer-events-none whitespace-nowrap z-50">
            {c.user_name}
          </div>
        </div>
      ))}

      {extraCount > 0 && (
        <div 
          className="relative group inline-flex items-center justify-center w-8 h-8 rounded-full border-2 border-obsidian bg-white/10 text-white text-xs font-bold hover:z-20 transition-transform hover:scale-110"
          style={{ zIndex: 0 }}
        >
          +{extraCount}
          <div className="absolute top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-[10px] font-bold px-2 py-1 rounded ares-cut-sm pointer-events-none whitespace-nowrap z-50">
            {extraCount} more
          </div>
        </div>
      )}
    </div>
  );
}
