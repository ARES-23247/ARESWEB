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
    return (
      <div className="min-h-screen bg-obsidian flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-ares-red/20 border-t-ares-red animate-spin rounded-full mb-4"></div>
        <div className="text-xs font-black uppercase tracking-[0.2em] text-marble/40">Loading Archive...</div>
      </div>
    );
  }

  const robot = data?.robot;
  if (!robot) {
    return (
      <div className="min-h-screen bg-obsidian flex flex-col items-center justify-center text-white p-4 text-center">
        <div className="text-ares-red mb-6">
          <XCircle size={64} />
        </div>
        <h1 className="text-4xl font-black mb-4 uppercase tracking-tighter">Robot Not Found</h1>
        <p className="text-marble/60 mb-8 max-w-md">This robot does not exist or has been removed from the archives.</p>
        <Link to="/robots" className="clipped-button-sm bg-ares-red text-white gap-2">
          <ChevronLeft size={16} /> Back to Archives
        </Link>
      </div>
    );
  }

  const season = seasonsData?.seasons?.find(s => s.startYear === robot.seasonId);

  return (
    <div className="min-h-screen bg-obsidian text-white pt-32 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-16">
        
        {/* Header Section */}
        <div>
          <Link to="/robots" className="inline-flex items-center gap-2 text-marble/40 hover:text-ares-red transition-colors mb-8 font-black uppercase tracking-[0.2em] text-[10px]">
            <ChevronLeft size={14} /> Back to Fleet
          </Link>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-10">
            <div className="flex-1">
              {season && (
                <div className="inline-block bg-ares-red/10 text-ares-red px-3 py-1 ares-cut-sm text-[10px] font-black uppercase tracking-[0.2em] mb-6 border border-ares-red/20">
                  {season.startYear}-{season.endYear} // {season.challengeName}
                </div>
              )}
              <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-ares-red to-orange-500 uppercase">
                {robot.name}
              </h1>
            </div>
            
            {(robot.onshapeUrl || robot.revealVideoId) && (
              <div className="flex flex-wrap gap-4">
                {robot.revealVideoId && (
                  <a href={`https://youtube.com/watch?v=${robot.revealVideoId}`} target="_blank" rel="noreferrer" className="clipped-button bg-ares-red text-white shadow-xl shadow-ares-red/20 group">
                    <Video size={18} className="mr-2 group-hover:scale-110 transition-transform" /> Watch Reveal
                  </a>
                )}
                {robot.onshapeUrl && (
                  <a href={robot.onshapeUrl} target="_blank" rel="noreferrer" className="clipped-button bg-ares-cyan text-black shadow-xl shadow-ares-cyan/20 group">
                    <LinkIcon size={18} className="mr-2 group-hover:rotate-12 transition-transform" /> View CAD
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Media & Specs Split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          
          {/* Main Media (Video or CAD or Album) */}
          <div className="lg:col-span-2 space-y-10">
            {robot.revealVideoId && (
              <div className="aspect-video bg-black ares-cut-lg overflow-hidden shadow-2xl border border-white/5 relative group">
                <div className="absolute inset-0 border-2 border-ares-red/20 group-hover:border-ares-red/40 transition-colors z-20 pointer-events-none"></div>
                <iframe
                  className="w-full h-full relative z-10"
                  src={`https://www.youtube.com/embed/${robot.revealVideoId}`}
                  title="Reveal Video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
            )}
            
            {!robot.revealVideoId && robot.cadViewerUrl && (
               <div className="aspect-video bg-black/40 ares-cut-lg overflow-hidden shadow-2xl border border-white/5 relative group">
                 <div className="absolute inset-0 border-2 border-ares-cyan/20 group-hover:border-ares-cyan/40 transition-colors z-20 pointer-events-none"></div>
                 <iframe
                    src={robot.cadViewerUrl}
                    className="w-full h-full relative z-10"
                    title="CAD Viewer"
                 ></iframe>
               </div>
            )}

            {robot.ast && (
              <div className="bg-black/40 p-10 ares-cut-lg border border-white/5 backdrop-blur-sm shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-ares-red/5 rounded-full blur-[100px] pointer-events-none"></div>
                <div className="prose prose-invert prose-ares max-w-none relative z-10">
                  <TiptapRenderer node={JSON.parse(robot.ast)} />
                </div>
              </div>
            )}
          </div>

          {/* Specs Sidebar (Pokemon Card style) */}
          <div className="lg:col-span-1">
            <div className="bg-obsidian border border-white/10 ares-cut-lg shadow-2xl overflow-hidden sticky top-32 group">
              <div className="bg-gradient-to-r from-ares-red to-red-900 p-6 border-b border-red-500/30">
                <h3 className="text-xl font-black uppercase tracking-[0.2em] text-white flex items-center gap-3">
                  <Cpu size={20} className="group-hover:rotate-90 transition-transform duration-500" /> Tech Specs
                </h3>
              </div>
              <div className="p-8 space-y-8 bg-black/20">
                
                {robot.weightLbs && (
                  <div className="relative">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-marble/30 block mb-2">Weight Class</span>
                    <div className="flex items-center gap-4 text-xl font-bold text-white">
                      <div className="p-2 bg-ares-cyan/10 ares-cut-sm border border-ares-cyan/20">
                        <Scale size={20} className="text-ares-cyan" />
                      </div>
                      {robot.weightLbs} lbs
                    </div>
                  </div>
                )}
                
                {robot.drivetrainType && (
                  <div className="relative">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-marble/30 block mb-2">Drivetrain Architecture</span>
                    <div className="flex items-center gap-4 text-xl font-bold text-white">
                      <div className="p-2 bg-ares-red/10 ares-cut-sm border border-ares-red/20">
                        <Cpu size={20} className="text-ares-red" />
                      </div>
                      {robot.drivetrainType}
                    </div>
                  </div>
                )}

                {robot.primaryMechanism && (
                  <div className="relative">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-marble/30 block mb-2">Primary Mechanism</span>
                    <div className="flex items-center gap-4 text-xl font-bold text-white">
                      <div className="p-2 bg-ares-gold/10 ares-cut-sm border border-ares-gold/20">
                        <Wrench size={20} className="text-ares-gold" />
                      </div>
                      {robot.primaryMechanism}
                    </div>
                  </div>
                )}

                {robot.programmingLanguage && (
                  <div className="relative">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-marble/30 block mb-2">Control Language</span>
                    <div className="flex items-center gap-4 text-xl font-bold text-white">
                      <div className="p-2 bg-ares-success/10 ares-cut-sm border border-ares-success/20">
                        <Code size={20} className="text-ares-success" />
                      </div>
                      {robot.programmingLanguage}
                    </div>
                  </div>
                )}

              </div>
              <div className="bg-black/40 p-5 text-center text-[10px] font-black uppercase tracking-[0.3em] text-marble/20 border-t border-white/5">
                Engineering Archive // SEC-23247
              </div>
            </div>
          </div>

        </div>

        {/* Gallery Section */}
        {robot.albumId && (
          <div className="pt-20 border-t border-white/5">
            <h2 className="text-4xl font-black mb-12 uppercase tracking-tighter">Build <span className="text-ares-red">Gallery</span></h2>
            <div className="bg-black/40 p-8 ares-cut-lg border border-white/5 shadow-2xl backdrop-blur-sm">
              <AlbumDetail id={robot.albumId} />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
