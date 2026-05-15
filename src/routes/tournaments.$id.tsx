import { createFileRoute, Link } from '@tanstack/react-router';
import { useGetTournament } from '../api/tournaments';
import TiptapRenderer from '../components/TiptapRenderer';
import { Trophy, ChevronLeft, Calendar, Video, Award, XCircle } from 'lucide-react';
import AlbumDetail from '../pages/AlbumDetail';

export const Route = createFileRoute('/tournaments/$id')({
  component: TournamentDetailPage,
});

function TournamentDetailPage() {
  const { id } = Route.useParams();
  const { data, isLoading } = useGetTournament(id);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-obsidian flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-ares-red/20 border-t-ares-red animate-spin rounded-full mb-4"></div>
        <div className="text-xs font-black uppercase tracking-[0.2em] text-marble/40">Opening Archive...</div>
      </div>
    );
  }

  const tournament = data?.tournament;
  const matches = data?.matches || [];
  const awards = data?.awards || [];

  if (!tournament) {
    return (
      <div className="min-h-screen bg-obsidian flex flex-col items-center justify-center text-white p-4 text-center">
        <div className="text-ares-red mb-6">
          <XCircle size={64} />
        </div>
        <h1 className="text-4xl font-black mb-4 uppercase tracking-tighter">Tournament Not Found</h1>
        <p className="text-marble/60 mb-8 max-w-md">This tournament does not exist or has been removed from the archives.</p>
        <Link to="/tournaments" className="clipped-button-sm bg-ares-red text-white gap-2">
          <ChevronLeft size={16} /> Back to Tournaments
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian text-white pt-32 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-16">
        
        {/* Header Section */}
        <div>
          <Link to="/tournaments" className="inline-flex items-center gap-2 text-marble/40 hover:text-ares-red transition-colors mb-8 font-black uppercase tracking-[0.2em] text-[10px]">
            <ChevronLeft size={14} /> Back to Tournaments
          </Link>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-10">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 bg-ares-gold/10 text-ares-gold px-3 py-1 ares-cut-sm text-[10px] font-black uppercase tracking-[0.2em] mb-6 border border-ares-gold/20">
                <Calendar size={12} /> Season {tournament.seasonId}
              </div>
              <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-ares-red to-orange-500 uppercase leading-none">
                {tournament.name}
              </h1>
            </div>
            
            <div className="flex gap-6">
              {tournament.rank && (
                <div className="bg-black/40 border border-white/10 px-8 py-5 ares-cut-lg text-center shadow-2xl backdrop-blur-sm group hover:border-ares-gold/30 transition-colors">
                  <span className="block text-[10px] uppercase font-black text-marble/30 mb-2 tracking-widest">Final Rank</span>
                  <span className="text-4xl font-black text-ares-gold">{tournament.rank}</span>
                </div>
              )}
              {tournament.opr != null && (
                <div className="bg-black/40 border border-white/10 px-8 py-5 ares-cut-lg text-center shadow-2xl backdrop-blur-sm group hover:border-ares-cyan/30 transition-colors">
                  <span className="block text-[10px] uppercase font-black text-marble/30 mb-2 tracking-widest">OPR Rating</span>
                  <span className="text-4xl font-black text-ares-cyan">{tournament.opr}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content & Matches Split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          
          {/* Main Recap */}
          <div className="lg:col-span-2 space-y-12">
            {tournament.ast ? (
              <div className="bg-black/40 p-10 ares-cut-lg border border-white/5 backdrop-blur-sm shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-ares-red/5 rounded-full blur-[100px] pointer-events-none"></div>
                <div className="prose prose-invert prose-ares max-w-none relative z-10">
                  <TiptapRenderer node={JSON.parse(tournament.ast)} />
                </div>
              </div>
            ) : (
              <div className="bg-black/40 p-10 ares-cut-lg border border-white/5 text-marble/30 italic text-center uppercase tracking-widest text-xs">
                Recap pending synchronization...
              </div>
            )}

            {/* Awards Section */}
            {awards.length > 0 && (
              <div className="bg-gradient-to-br from-ares-gold/10 to-transparent border border-ares-gold/20 p-10 ares-cut-lg shadow-2xl">
                <h3 className="text-3xl font-black mb-8 flex items-center gap-4 text-ares-gold uppercase tracking-tighter">
                  <Award size={32} /> Honors & Awards
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {awards.map((award: {
                    id: string;
                    name: string;
                    placement?: string | null;
                  }) => (
                    <div key={award.id} className="bg-black/40 border border-white/10 p-5 ares-cut-lg flex items-start gap-5 group hover:border-ares-gold/50 transition-all duration-500">
                      <div className="bg-ares-gold/10 p-3 ares-cut-sm text-ares-gold border border-ares-gold/20 group-hover:bg-ares-gold/20 transition-all">
                        <Trophy size={24} />
                      </div>
                      <div>
                        <h4 className="font-black text-white leading-tight uppercase tracking-tight mb-1">{award.name}</h4>
                        <span className="text-[10px] font-black text-ares-gold uppercase tracking-[0.2em]">{award.placement || "Winner"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Match Schedule Sidebar */}
          <div className="lg:col-span-1">
            {(matches.length > 0 || Boolean((tournament as Record<string, unknown>)?.ftcEventKey)) && (
              <div className="bg-obsidian border border-white/10 ares-cut-lg p-8 shadow-2xl overflow-hidden h-fit sticky top-32 group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-ares-red/5 rounded-full blur-3xl group-hover:bg-ares-red/10 transition-colors" />
                <h3 className="text-xl font-black text-white uppercase tracking-[0.2em] mb-8 flex items-center gap-4">
                  <Video size={24} className="text-ares-red" /> Match Data
                </h3>

                {matches.length === 0 ? (
                  <div className="text-center py-12 text-marble/20 border-2 border-dashed border-white/5 ares-cut-lg">
                    <p className="text-[10px] font-black uppercase tracking-widest">No telemetry synchronized</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {matches.map((m: {
                      id: string;
                      matchType: string;
                      redScore?: number | null;
                      blueScore?: number | null;
                      youtubeVideoId?: string | null;
                    }) => (
                      <div key={m.id} className="p-5 bg-white/5 ares-cut-sm border border-white/5 hover:border-white/20 transition-all group/match">
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-[10px] font-black uppercase tracking-widest bg-white/10 px-2 py-1 ares-cut-sm text-marble/60">{m.matchType}</span>
                          {m.youtubeVideoId && (
                            <a href={`https://youtube.com/watch?v=${m.youtubeVideoId}`} target="_blank" rel="noreferrer" className="text-ares-red hover:text-white flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-colors">
                              <Video size={14} /> Watch
                            </a>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-center">
                          <div className={`py-3 ares-cut-sm font-black text-2xl ${(m.redScore ?? 0) > (m.blueScore ?? 0) ? 'bg-ares-red/20 text-ares-red border border-ares-red/30' : 'bg-black/40 text-marble/20 border border-white/5'}`}>
                            {m.redScore}
                          </div>
                          <div className={`py-3 ares-cut-sm font-black text-2xl ${(m.blueScore ?? 0) > (m.redScore ?? 0) ? 'bg-ares-cyan/20 text-ares-cyan border border-ares-cyan/30' : 'bg-black/40 text-marble/20 border border-white/5'}`}>
                            {m.blueScore}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="mt-8 pt-8 border-t border-white/5 text-center">
                  <div className="text-[8px] font-black uppercase tracking-[0.4em] text-marble/20">ARES Match Telemetry // V2.0</div>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Gallery Section */}
        {tournament.albumId && (
          <div className="pt-20 border-t border-white/5">
            <h2 className="text-4xl font-black mb-12 uppercase tracking-tighter">Event <span className="text-ares-red">Gallery</span></h2>
            <div className="bg-black/40 p-8 ares-cut-lg border border-white/5 shadow-2xl backdrop-blur-sm">
              <AlbumDetail id={tournament.albumId} />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
