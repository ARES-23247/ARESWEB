import { createFileRoute, Link } from '@tanstack/react-router';
import { useGetTournaments } from '../api/tournaments';
import { Trophy, Calendar } from 'lucide-react';

export const Route = createFileRoute('/tournaments')({
  component: TournamentsPage,
});

function TournamentsPage() {
  const { data: tournamentsData, isLoading } = useGetTournaments();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-obsidian flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-ares-red/20 border-t-ares-red animate-spin rounded-full mb-4"></div>
        <div className="text-xs font-black uppercase tracking-[0.2em] text-marble/40">Fetching Tournament Records...</div>
      </div>
    );
  }

  const tournaments = tournamentsData?.tournaments || [];

  return (
    <div className="min-h-screen bg-obsidian text-white pt-32 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <div className="inline-block bg-ares-gold/10 text-ares-gold px-4 py-1.5 ares-cut-sm font-black uppercase tracking-widest text-[10px] mb-6 border border-ares-gold/20">
            ARES 23247 Competition
          </div>
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-6 uppercase">
            The <span className="text-transparent bg-clip-text bg-gradient-to-r from-ares-red to-orange-500">Arena</span>
          </h1>
          <p className="text-lg text-marble/50 max-w-2xl mx-auto font-medium leading-relaxed">
            A comprehensive archive of ARES Robotics tournament performances, match data, and awards.
          </p>
        </div>

        {tournaments.length === 0 ? (
          <div className="text-center text-marble/30 p-20 bg-black/40 ares-cut-lg border border-white/5 backdrop-blur-sm">
            <Trophy size={48} className="mx-auto mb-6 opacity-20" />
            <div className="text-xl font-bold uppercase tracking-widest">No Records Found</div>
            <div className="text-sm mt-2">The competition logs are currently being synchronized.</div>
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
                className="group bg-black/40 border border-white/5 ares-cut-lg p-8 hover:border-ares-red/50 transition-all duration-500 shadow-2xl flex flex-col h-full backdrop-blur-sm relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-ares-red/5 rounded-full blur-3xl group-hover:bg-ares-red/10 transition-colors"></div>
                
                <div className="flex items-start justify-between mb-8 relative z-10">
                  <div className="bg-white/5 p-4 ares-cut-sm border border-white/5 group-hover:bg-ares-red/10 group-hover:border-ares-red/20 transition-all duration-500">
                    <Trophy size={28} className="text-ares-gold group-hover:scale-110 transition-transform" />
                  </div>
                  {tournament.rank && (
                    <div className="bg-ares-gold text-black text-[10px] font-black uppercase tracking-[0.2em] py-2 px-3 ares-cut-sm shadow-xl">
                      Rank {tournament.rank}
                    </div>
                  )}
                </div>
                
                <h2 className="text-3xl font-black mb-3 group-hover:text-ares-red transition-colors tracking-tight uppercase relative z-10 leading-tight">
                  {tournament.name}
                </h2>
                <div className="flex items-center gap-2 text-marble/40 text-[10px] font-black uppercase tracking-widest mb-10 relative z-10">
                  <Calendar size={12} className="text-ares-cyan" /> Season {tournament.seasonId}
                </div>
                
                <div className="mt-auto grid grid-cols-2 gap-4 relative z-10">
                  {tournament.allianceRole && (
                    <div className="bg-white/5 p-3 ares-cut-sm border border-white/5 text-center">
                      <span className="block text-[8px] uppercase font-black text-marble/30 mb-1 tracking-widest">Alliance</span>
                      <span className="font-bold text-sm text-white">{tournament.allianceRole}</span>
                    </div>
                  )}
                  {tournament.opr != null && (
                    <div className="bg-white/5 p-3 ares-cut-sm border border-white/5 text-center">
                      <span className="block text-[8px] uppercase font-black text-marble/30 mb-1 tracking-widest">OPR Rating</span>
                      <span className="font-bold text-sm text-ares-cyan">{tournament.opr}</span>
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
