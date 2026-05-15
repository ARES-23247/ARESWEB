import { createFileRoute, Link } from '@tanstack/react-router';
import { useGetTournament } from '../api/tournaments';
import TiptapRenderer from '../components/TiptapRenderer';
import { Trophy, ChevronLeft, Calendar, Video, Award } from 'lucide-react';
import AlbumDetail from '../pages/AlbumDetail';

export const Route = createFileRoute('/tournaments/$id')({
  component: TournamentDetailPage,
});

function TournamentDetailPage() {
  const { id } = Route.useParams();
  const { data, isLoading } = useGetTournament(id);

  if (isLoading) {
    return <div className="min-h-screen bg-obsidian flex items-center justify-center text-white">Loading...</div>;
  }

  const tournament = data?.tournament;
  const matches = data?.matches || [];
  const awards = data?.awards || [];

  if (!tournament) {
    return (
      <div className="min-h-screen bg-obsidian flex flex-col items-center justify-center text-white p-4 text-center">
        <h1 className="text-4xl font-black mb-4">Tournament Not Found</h1>
        <p className="text-marble mb-8">This tournament does not exist or has been removed from the archives.</p>
        <Link to="/tournaments" className="text-ares-red hover:underline flex items-center gap-2">
          <ChevronLeft size={16} /> Back to Tournaments
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian text-white pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-12">
        
        {/* Header Section */}
        <div>
          <Link to="/tournaments" className="inline-flex items-center gap-2 text-marble/60 hover:text-ares-red transition-colors mb-6 font-medium text-sm">
            <ChevronLeft size={16} /> Back to Tournaments
          </Link>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/10 text-marble px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-white/5">
                <Calendar size={12} /> Season {tournament.seasonId}
              </div>
              <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-ares-red to-orange-500">
                {tournament.name}
              </h1>
            </div>
            
            <div className="flex gap-4">
              {tournament.rank && (
                <div className="bg-slate-900 border border-white/10 px-6 py-3 rounded-xl text-center shadow-lg">
                  <span className="block text-[10px] uppercase font-black text-marble/50 mb-1">Final Rank</span>
                  <span className="text-2xl font-black text-ares-gold">{tournament.rank}</span>
                </div>
              )}
              {tournament.opr != null && (
                <div className="bg-slate-900 border border-white/10 px-6 py-3 rounded-xl text-center shadow-lg">
                  <span className="block text-[10px] uppercase font-black text-marble/50 mb-1">OPR</span>
                  <span className="text-2xl font-black text-ares-cyan">{tournament.opr}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content & Matches Split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Recap */}
          <div className="lg:col-span-2 space-y-8">
            {tournament.ast ? (
              <div className="prose prose-invert prose-ares max-w-none bg-slate-900/50 p-8 rounded-2xl border border-white/5">
                <TiptapRenderer node={JSON.parse(tournament.ast)} />
              </div>
            ) : (
              <div className="bg-slate-900/50 p-8 rounded-2xl border border-white/5 text-marble/60 italic">
                No recap has been written for this tournament yet.
              </div>
            )}

            {/* Awards Section */}
            {awards.length > 0 && (
              <div className="bg-gradient-to-br from-ares-gold/10 to-transparent border border-ares-gold/20 p-8 rounded-2xl">
                <h3 className="text-2xl font-black mb-6 flex items-center gap-2 text-ares-gold">
                  <Award size={24} /> Honors & Awards
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {awards.map((award: {
                    id: string;
                    name: string;
                    placement?: string | null;
                  }) => (
                    <div key={award.id} className="bg-slate-900 border border-ares-gold/10 p-4 rounded-xl flex items-start gap-4">
                      <div className="bg-ares-gold/20 p-2 rounded-lg text-ares-gold">
                        <Trophy size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-white leading-tight">{award.name}</h4>
                        <span className="text-sm font-black text-ares-gold uppercase tracking-widest">{award.placement || "Winner"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Match Schedule Sidebar */}
          <div className="lg:col-span-1">
            {(matches.length > 0 || Boolean((tournament as any)?.ftcEventKey)) && (
              <div className="bg-black border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden h-fit">
                <div className="absolute top-0 right-0 w-32 h-32 bg-ares-red/10 rounded-full blur-3xl" />
                <h3 className="text-xl font-black text-white uppercase tracking-wider mb-6 flex items-center gap-3">
                  <Video size={24} /> Match Results
                </h3>

                {matches.length === 0 ? (
                  <div className="text-center py-8 text-marble/60">
                    <p>No matches synchronized for this event.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {matches.map((m: {
                      id: string;
                      matchType: string;
                      redScore?: number | null;
                      blueScore?: number | null;
                      youtubeVideoId?: string | null;
                    }) => (
                      <div key={m.id} className="p-4 hover:bg-white/5 transition-colors group">
                        <div className="flex justify-between items-center mb-3">
                          <span className="font-bold text-sm bg-slate-800 px-2 py-0.5 rounded">{m.matchType}</span>
                          {m.youtubeVideoId && (
                            <a href={`https://youtube.com/watch?v=${m.youtubeVideoId}`} target="_blank" rel="noreferrer" className="text-red-500 hover:text-red-400 flex items-center gap-1 text-xs font-bold transition-colors">
                              <Video size={14} /> Watch
                            </a>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-center text-lg font-black">
                          <div className={`p-2 rounded ${(m.redScore ?? 0) > (m.blueScore ?? 0) ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-800/50 text-marble/50'}`}>
                            {m.redScore}
                          </div>
                          <div className={`p-2 rounded ${(m.blueScore ?? 0) > (m.redScore ?? 0) ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-slate-800/50 text-marble/50'}`}>
                            {m.blueScore}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

        {/* Gallery Section */}
        {tournament.albumId && (
          <div className="pt-12 border-t border-white/10">
            <h2 className="text-3xl font-black mb-8 text-white">Event Gallery</h2>
            <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5">
              <AlbumDetail id={tournament.albumId} />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
