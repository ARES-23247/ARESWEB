import { createFileRoute, Link } from '@tanstack/react-router';
import { useGetRobots } from '../api/robots';
import { useGetSeasons } from '../api/seasons';
import { Cpu, Scale, ChevronRight, Code } from 'lucide-react';

export const Route = createFileRoute('/robots')({
  component: RobotsPage,
});

function RobotsPage() {
  const { data: robotsData, isLoading: isLoadingRobots } = useGetRobots();
  const { data: seasonsData } = useGetSeasons();

  if (isLoadingRobots) {
    return <div className="min-h-screen bg-obsidian flex items-center justify-center text-white">Loading...</div>;
  }

  const robots = robotsData?.robots || [];
  const seasons = seasonsData?.seasons || [];

  return (
    <div className="min-h-screen bg-obsidian text-white pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-black tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-ares-red to-orange-500">
            ARES Robotics Fleet
          </h1>
          <p className="text-xl text-marble/80 max-w-2xl mx-auto">
            Explore the history and engineering behind our championship-caliber robots across every FIRST Tech Challenge season.
          </p>
        </div>

        {robots.length === 0 ? (
          <div className="text-center text-marble/60 p-12 bg-white/5 rounded-2xl border border-white/10">
            No robots have been added to the archives yet.
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
              const season = seasons.find((s: any) => s.startYear === robot.seasonId);
              
              return (
                <Link
                  key={robot.id}
                  to="/robots/$id"
                  params={{ id: robot.id }}
                  className="group bg-slate-900 border border-white/10 rounded-2xl overflow-hidden hover:border-ares-red/50 transition-all shadow-xl hover:shadow-[0_0_30px_rgba(192,0,0,0.15)] flex flex-col h-full"
                >
                  <div className="aspect-video bg-black relative overflow-hidden">
                    {/* Placeholder for robot image. Ideally we get the first image of the album if attached. */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent z-10"></div>
                    <div className="absolute inset-0 flex items-center justify-center opacity-50 group-hover:scale-105 transition-transform duration-700">
                       {robot.revealVideoId ? (
                         <img src={`https://img.youtube.com/vi/${robot.revealVideoId}/hqdefault.jpg`} className="w-full h-full object-cover" alt={robot.name} />
                       ) : (
                         <Cpu size={64} className="text-white/20" />
                       )}
                    </div>
                  </div>
                  
                  <div className="p-6 flex-1 flex flex-col relative z-20 -mt-8">
                    <div className="bg-ares-red text-white text-xs font-black uppercase tracking-widest py-1 px-3 rounded-full self-start shadow-lg mb-4">
                      {season ? `${season.startYear}-${season.endYear} ${season.challengeName}` : 'Legacy'}
                    </div>
                    
                    <h2 className="text-2xl font-bold mb-4 group-hover:text-ares-red transition-colors">{robot.name}</h2>
                    
                    <div className="mt-auto grid grid-cols-2 gap-4 text-sm text-marble/70">
                      {robot.weightLbs && (
                        <div className="flex items-center gap-2 bg-white/5 p-2 rounded">
                          <Scale size={16} className="text-ares-cyan" />
                          <span>{robot.weightLbs} lbs</span>
                        </div>
                      )}
                      {robot.programmingLanguage && (
                        <div className="flex items-center gap-2 bg-white/5 p-2 rounded">
                          <Code size={16} className="text-ares-gold" />
                          <span>{robot.programmingLanguage}</span>
                        </div>
                      )}
                      <div className="col-span-2 flex items-center gap-2 bg-white/5 p-2 rounded truncate">
                        <Cpu size={16} className="text-ares-red shrink-0" />
                        <span className="truncate">{robot.drivetrainType || 'Custom Drive'}</span>
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
