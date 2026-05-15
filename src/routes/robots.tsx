import { createFileRoute, Link } from '@tanstack/react-router';
import { useGetRobots } from '../api/robots';
import { useGetSeasons } from '../api/seasons';
import { Cpu, Scale, Code } from 'lucide-react';

export const Route = createFileRoute('/robots')({
  component: RobotsPage,
});

function RobotsPage() {
  const { data: robotsData, isLoading: isLoadingRobots } = useGetRobots();
  const { data: seasonsData } = useGetSeasons();

  if (isLoadingRobots) {
    return (
      <div className="min-h-screen bg-obsidian flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-ares-red/20 border-t-ares-red animate-spin rounded-full mb-4"></div>
        <div className="text-xs font-black uppercase tracking-[0.2em] text-marble/40">Accessing Fleet Data...</div>
      </div>
    );
  }

  const robots = robotsData?.robots || [];
  const seasons = seasonsData?.seasons || [];

  return (
    <div className="min-h-screen bg-obsidian text-white pt-32 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <div className="inline-block bg-ares-red/10 text-ares-red px-4 py-1.5 ares-cut-sm font-black uppercase tracking-widest text-[10px] mb-6 border border-ares-red/20">
            ARES 23247 Engineering
          </div>
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-6 uppercase">
            The <span className="text-transparent bg-clip-text bg-gradient-to-r from-ares-red to-orange-500">Fleet</span>
          </h1>
          <p className="text-lg text-marble/50 max-w-2xl mx-auto font-medium leading-relaxed">
            Archive of championship-caliber robotics systems engineered for the FIRST Tech Challenge.
          </p>
        </div>

        {robots.length === 0 ? (
          <div className="text-center text-marble/30 p-20 bg-black/40 ares-cut-lg border border-white/5 backdrop-blur-sm">
            <Cpu size={48} className="mx-auto mb-6 opacity-20" />
            <div className="text-xl font-bold uppercase tracking-widest">No Records Found</div>
            <div className="text-sm mt-2">The archives are currently being compiled.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {robots.map((robot: {
              id: string;
              name: string;
              seasonId?: number | null;
              weightLbs?: number | null;
              drivetrainType?: string | null;
              programmingLanguage?: string | null;
              revealVideoId?: string | null;
            }) => {
              const season = seasons.find((s: { startYear: number }) => s.startYear === robot.seasonId);
              
              return (
                <Link
                  key={robot.id}
                  to="/robots/$id"
                  params={{ id: robot.id }}
                  className="group bg-black/40 border border-white/5 ares-cut-lg overflow-hidden hover:border-ares-red/50 transition-all duration-500 shadow-2xl flex flex-col h-full backdrop-blur-sm"
                >
                  <div className="aspect-video bg-black relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent z-10 opacity-60"></div>
                    <div className="absolute inset-0 flex items-center justify-center opacity-40 group-hover:opacity-60 group-hover:scale-110 transition-all duration-700 grayscale group-hover:grayscale-0">
                       {robot.revealVideoId ? (
                         <img src={`https://img.youtube.com/vi/${robot.revealVideoId}/hqdefault.jpg`} className="w-full h-full object-cover" alt={robot.name} />
                       ) : (
                         <Cpu size={64} className="text-white/10" />
                       )}
                    </div>
                  </div>
                  
                  <div className="p-8 flex-1 flex flex-col relative z-20 -mt-12">
                    <div className="bg-ares-red text-white text-[10px] font-black uppercase tracking-[0.2em] py-2 px-4 ares-cut-sm self-start shadow-xl mb-6">
                      {season ? `${season.startYear}-${season.endYear}` : 'Legacy'}
                    </div>
                    
                    <h2 className="text-3xl font-black mb-6 group-hover:text-ares-red transition-colors tracking-tight uppercase">{robot.name}</h2>
                    
                    <div className="mt-auto space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        {robot.weightLbs && (
                          <div className="flex items-center gap-3 bg-white/5 p-3 ares-cut-sm border border-white/5">
                            <Scale size={14} className="text-ares-cyan" />
                            <span className="text-xs font-bold text-marble/80">{robot.weightLbs} lbs</span>
                          </div>
                        )}
                        {robot.programmingLanguage && (
                          <div className="flex items-center gap-3 bg-white/5 p-3 ares-cut-sm border border-white/5">
                            <Code size={14} className="text-ares-gold" />
                            <span className="text-xs font-bold text-marble/80">{robot.programmingLanguage}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 bg-white/5 p-3 ares-cut-sm border border-white/5">
                        <Cpu size={14} className="text-ares-red shrink-0" />
                        <span className="text-xs font-bold text-marble/80 truncate">{robot.drivetrainType || 'Custom Drive'}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
