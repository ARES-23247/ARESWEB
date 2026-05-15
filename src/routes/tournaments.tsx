import { createFileRoute, Link } from '@tanstack/react-router';
import { useGetTournaments } from '../api/tournaments';
import { Trophy, Calendar } from 'lucide-react';

export const Route = createFileRoute('/tournaments')({
  component: TournamentsPage,
});

function TournamentsPage() {
  const { data: tournamentsData, isLoading } = useGetTournaments();

  if (isLoading) {
    return <div className="min-h-screen bg-obsidian flex items-center justify-center text-white">Loading...</div>;
  }

  const tournaments = tournamentsData?.tournaments || [];

  return (
    <div className="min-h-screen bg-obsidian text-white pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-black tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-ares-red to-orange-500">
            Competition History
          </h1>
          <p className="text-xl text-marble/80 max-w-2xl mx-auto">
            A comprehensive archive of ARES Robotics tournament performances, match data, and awards.
          </p>
        </div>

        {tournaments.length === 0 ? (
          <div className="text-center text-marble/60 p-12 bg-white/5 rounded-2xl border border-white/10">
            No tournament records found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {tournaments.map((tournament: {
              id: string;
              name: string;
              seasonId?: number | null;
              rank?: number | null;
              allianceRole?: string | null;
              opr?: number | null;
            }) => (
              <Link
                key={tournament.id}
                to="/tournaments/$id"
                params={{ id: tournament.id }}
                className="group bg-slate-900 border border-white/10 rounded-2xl p-6 hover:border-ares-red/50 transition-all shadow-xl hover:shadow-[0_0_30px_rgba(192,0,0,0.15)] flex flex-col h-full"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="bg-white/5 p-3 rounded-xl group-hover:bg-ares-red/20 transition-colors">
                    <Trophy size={24} className="text-ares-gold" />
                  </div>
                  {tournament.rank && (
                    <div className="bg-ares-gold text-black text-xs font-black uppercase tracking-widest py-1 px-2 rounded shadow-lg">
                      Rank {tournament.rank}
                    </div>
                  )}
                </div>
                
                <h2 className="text-2xl font-bold mb-2 group-hover:text-ares-red transition-colors">{tournament.name}</h2>
                <div className="flex items-center gap-2 text-marble/50 text-sm mb-6">
                  <Calendar size={14} /> Season {tournament.seasonId}
                </div>
                
                <div className="mt-auto grid grid-cols-2 gap-4 text-sm text-marble/70">
                  {tournament.allianceRole && (
                    <div className="bg-white/5 p-2 rounded truncate text-center">
                      <span className="block text-[10px] uppercase font-black text-marble/50 mb-1">Alliance</span>
                      <span className="font-bold text-white">{tournament.allianceRole}</span>
                    </div>
                  )}
                  {tournament.opr != null && (
                    <div className="bg-white/5 p-2 rounded truncate text-center">
                      <span className="block text-[10px] uppercase font-black text-marble/50 mb-1">OPR</span>
                      <span className="font-bold text-white">{tournament.opr}</span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
