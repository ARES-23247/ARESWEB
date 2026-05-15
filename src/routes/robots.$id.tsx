import { createFileRoute } from '@tanstack/react-router';
import { useGetRobot } from '../api/robots';
import { useGetSeasons } from '../api/seasons';
import TiptapRenderer from '../components/TiptapRenderer';
import { Cpu, Scale, Code, Wrench, Video, Link as LinkIcon, ChevronLeft } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import AlbumDetail from '../pages/AlbumDetail';

export const Route = createFileRoute('/robots/$id')({
  component: RobotDetailPage,
});

function RobotDetailPage() {
  const { id } = Route.useParams();
  const { data, isLoading } = useGetRobot(id);
  const { data: seasonsData } = useGetSeasons();

  if (isLoading) {
    return <div className="min-h-screen bg-obsidian flex items-center justify-center text-white">Loading...</div>;
  }

  const robot = data?.robot;
  if (!robot) {
    return (
      <div className="min-h-screen bg-obsidian flex flex-col items-center justify-center text-white p-4 text-center">
        <h1 className="text-4xl font-black mb-4">Robot Not Found</h1>
        <p className="text-marble mb-8">This robot does not exist or has been removed from the archives.</p>
        <Link to="/robots" className="text-ares-red hover:underline flex items-center gap-2">
          <ChevronLeft size={16} /> Back to Archives
        </Link>
      </div>
    );
  }

  const season = seasonsData?.seasons?.find(s => s.startYear === robot.seasonId);

  return (
    <div className="min-h-screen bg-obsidian text-white pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-12">
        
        {/* Header Section */}
        <div>
          <Link to="/robots" className="inline-flex items-center gap-2 text-marble/60 hover:text-ares-red transition-colors mb-6 font-medium text-sm">
            <ChevronLeft size={16} /> Back to Fleet
          </Link>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              {season && (
                <div className="inline-block bg-white/10 text-marble px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-white/5">
                  {season.startYear}-{season.endYear} • {season.challengeName}
                </div>
              )}
              <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-ares-red to-orange-500">
                {robot.name}
              </h1>
            </div>
            
            {(robot.onshapeUrl || robot.revealVideoId) && (
              <div className="flex flex-wrap gap-3">
                {robot.revealVideoId && (
                  <a href={`https://youtube.com/watch?v=${robot.revealVideoId}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-bold shadow-lg shadow-red-900/50 transition-all">
                    <Video size={18} /> Watch Reveal
                  </a>
                )}
                {robot.onshapeUrl && (
                  <a href={robot.onshapeUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-[#1b5e20] hover:bg-[#2e7d32] text-white px-4 py-2 rounded font-bold shadow-lg shadow-[#1b5e20]/50 transition-all">
                    <LinkIcon size={18} /> View CAD
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Media & Specs Split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Media (Video or CAD or Album) */}
          <div className="lg:col-span-2 space-y-8">
            {robot.revealVideoId && (
              <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-white/10">
                <iframe
                  className="w-full h-full"
                  src={`https://www.youtube.com/embed/${robot.revealVideoId}`}
                  title="Reveal Video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
            )}
            
            {!robot.revealVideoId && robot.cadViewerUrl && (
               <div className="aspect-video bg-white/5 rounded-xl overflow-hidden shadow-2xl border border-white/10">
                 <iframe
                    src={robot.cadViewerUrl}
                    className="w-full h-full"
                    title="CAD Viewer"
                 ></iframe>
               </div>
            )}

            {robot.ast && (
              <div className="prose prose-invert prose-ares max-w-none bg-slate-900/50 p-8 rounded-2xl border border-white/5">
                <TiptapRenderer node={JSON.parse(robot.ast)} />
              </div>
            )}
          </div>

          {/* Specs Sidebar (Pokemon Card style) */}
          <div className="lg:col-span-1">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-white/10 shadow-2xl overflow-hidden sticky top-24">
              <div className="bg-gradient-to-r from-ares-red to-red-900 p-4 border-b border-red-500/30">
                <h3 className="text-xl font-black uppercase tracking-widest text-white flex items-center gap-2">
                  <Cpu size={20} /> Tech Specs
                </h3>
              </div>
              <div className="p-6 space-y-6">
                
                {robot.weightLbs && (
                  <div>
                    <span className="text-xs font-black uppercase tracking-widest text-marble/50 block mb-1">Weight</span>
                    <div className="flex items-center gap-3 text-lg font-bold text-white">
                      <Scale size={20} className="text-ares-cyan" /> {robot.weightLbs} lbs
                    </div>
                  </div>
                )}
                
                {robot.drivetrainType && (
                  <div>
                    <span className="text-xs font-black uppercase tracking-widest text-marble/50 block mb-1">Drivetrain</span>
                    <div className="flex items-center gap-3 text-lg font-bold text-white">
                      <Cpu size={20} className="text-ares-red" /> {robot.drivetrainType}
                    </div>
                  </div>
                )}

                {robot.primaryMechanism && (
                  <div>
                    <span className="text-xs font-black uppercase tracking-widest text-marble/50 block mb-1">Primary Mechanism</span>
                    <div className="flex items-center gap-3 text-lg font-bold text-white">
                      <Wrench size={20} className="text-ares-gold" /> {robot.primaryMechanism}
                    </div>
                  </div>
                )}

                {robot.programmingLanguage && (
                  <div>
                    <span className="text-xs font-black uppercase tracking-widest text-marble/50 block mb-1">Language</span>
                    <div className="flex items-center gap-3 text-lg font-bold text-white">
                      <Code size={20} className="text-green-400" /> {robot.programmingLanguage}
                    </div>
                  </div>
                )}

              </div>
              <div className="bg-black/50 p-4 text-center text-xs text-marble/40 border-t border-white/5">
                ARES 23247 Engineering Archives
              </div>
            </div>
          </div>

        </div>

        {/* Gallery Section */}
        {robot.albumId && (
          <div className="pt-12 border-t border-white/10">
            <h2 className="text-3xl font-black mb-8 text-white">Build Gallery</h2>
            <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5">
              <AlbumDetail id={robot.albumId} />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
