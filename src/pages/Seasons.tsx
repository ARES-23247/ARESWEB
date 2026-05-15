import { motion } from "framer-motion";
import { Trophy, MapPin, Cpu, ExternalLink } from "lucide-react";
import SEO from "../components/SEO";
import { useGetSeasons, useGetAwards, type Season, type Award } from "../api";

export default function Seasons() {
  const { data: seasonsRes, isLoading: isLoadingSeasons } = useGetSeasons();
  const seasons: Season[] = seasonsRes?.seasons || [];

  const { data: awardsRes, isLoading: isLoadingAwards } = useGetAwards();
  const awards: Award[] = awardsRes?.awards || [];

  return (
    <div className="flex flex-col w-full bg-obsidian min-h-screen text-marble relative overflow-hidden">
      <SEO title="Team Legacy" description="A chronicle of ARES 23247's journey through FIRST® Robotics. Explore our seasonal achievements, awards, and growth." />
      
      <section className="py-40 px-6 relative z-10 text-center">
        <div className="max-w-7xl mx-auto">
          <div className="bg-ares-gold/10 text-ares-gold px-6 py-2 ares-cut-sm font-black uppercase tracking-[0.4em] text-[10px] mb-10 border border-ares-gold/20 inline-block">
             Operational History // Since 2025
          </div>
          <h1 className="text-5xl md:text-[10rem] font-black text-white mb-10 uppercase tracking-tighter leading-[0.8]">
            Our <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-marble/20">Legacy</span>
          </h1>
          <p className="text-marble/40 text-xl max-w-3xl mx-auto leading-relaxed font-medium">
            The story of ARES 23247 is told through the banners we hang and the challenges we overcome. We document our history to inspire our future.
          </p>
        </div>
      </section>
      <section className="py-32 px-6 bg-black/20 relative z-10 border-y border-white/5 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto">
          <header className="mb-32 text-center">
            <div className="inline-block bg-white/5 text-marble/40 px-4 py-1 ares-cut-sm font-black uppercase tracking-widest text-[10px] mb-8 border border-white/10">
              Chrono-Feed // Archives
            </div>
            <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter mb-6 uppercase">Journey Through <span className="text-ares-red">Time</span></h2>
            <p className="text-marble/40 font-medium max-w-2xl mx-auto">Our evolution from a rookie build to a championship contender, documented for the next generation.</p>
          </header>

          <div className="space-y-40 relative">
             <div className="absolute left-0 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-ares-red via-ares-gold to-ares-cyan md:-translate-x-1/2 opacity-10" />
             
             {isLoadingSeasons ? (
               <div className="flex justify-center py-20">
                 <div className="w-10 h-10 border-2 border-white/10 border-t-ares-red rounded-full animate-spin" />
               </div>
             ) : seasons.length > 0 ? (
               seasons.map((season: Season, idx: number) => {
                 const isEven = idx % 2 === 0;
                 return (                    <motion.div 
                      key={season.startYear}
                      initial={{ opacity: 0, y: 50 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      className="relative pl-12 md:pl-0"
                    >
                       <div className="absolute left-0 md:left-1/2 md:-translate-x-1/2 top-0 w-4 h-4 ares-cut bg-ares-red shadow-[0_0_20px_rgba(192,0,0,0.5)] z-20 border-4 border-obsidian" />
                       
                       <div className={`flex flex-col md:flex-row items-stretch gap-10 md:gap-20 ${isEven ? 'md:flex-row' : 'md:flex-row-reverse'}`}>
                         <div className={`md:w-1/2 flex flex-col ${isEven ? 'md:items-end md:text-right' : 'md:items-start md:text-left'}`}>
                            <div className="mb-6">
                              <span className="bg-ares-red/10 text-ares-red text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 ares-cut-sm border border-ares-red/20 inline-block">
                                 {`REV-${season.startYear} // ${season.endYear}`}
                              </span>
                            </div>
                            <h3 className="text-5xl md:text-7xl font-black text-white tracking-tighter mb-8 uppercase leading-[0.9]">
                              {season.challengeName}
                            </h3>
                            {season.summary && (
                              <p className="text-marble/40 text-lg leading-relaxed mb-10 font-medium max-w-xl">
                                {season.summary}
                              </p>
                            )}
                            
                            {season.robotName && (
                              <div className={`flex items-center gap-4 mb-10 p-6 bg-black/40 border border-white/5 ares-cut-lg backdrop-blur-md group hover:border-ares-gold/30 transition-colors ${isEven ? 'md:flex-row-reverse' : ''}`}>
                                <div className="w-12 h-12 ares-cut bg-ares-gold/10 flex items-center justify-center text-ares-gold group-hover:scale-110 transition-transform">
                                  <Cpu size={24} />
                                </div>
                                <div className={isEven ? 'md:text-right' : 'md:text-left'}>
                                  <span className="block text-[10px] font-black text-ares-gold/40 uppercase tracking-[0.2em] mb-1">Assigned Chassis</span>
                                  <span className="text-white font-black text-lg uppercase tracking-tight italic">{season.robotName}</span>
                                </div>
                              </div>
                            )}

                            <div className={`flex flex-wrap gap-4 ${isEven ? 'md:justify-end' : 'md:justify-start'}`}>
                               {season.robotCadUrl && (
                                 <a 
                                   href={season.robotCadUrl} 
                                   target="_blank" 
                                   rel="noopener noreferrer"
                                   className="clipped-button bg-white/5 border border-white/10 text-marble/60 hover:text-white hover:bg-white/10 px-6 py-3 text-[10px] font-black tracking-[0.2em] transition-all flex items-center gap-3 uppercase"
                                 >
                                   CAD REPOSITORY <ExternalLink size={12} className="text-ares-red" />
                                 </a>
                               )}
                            </div>
                         </div>

                         {season.robotImage && (
                           <div className="md:w-1/2 flex items-center justify-center">
                             <div className="w-full aspect-[4/3] ares-cut-lg overflow-hidden border border-white/5 shadow-2xl group relative">
                               <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60 z-10" />
                               <img 
                                 src={season.robotImage} 
                                 alt={season.robotName || season.challengeName} 
                                 className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                               />
                               <div className="absolute inset-0 border-[20px] border-black/10 pointer-events-none z-20" />
                             </div>
                           </div>
                         )}
                       </div>
                    </motion.div>

                 );
               })
             ) : (
               <div className="text-center py-20">
                 <p className="text-marble italic">Legacy records are currently being cataloged...</p>
               </div>
             )}
          </div>
        </div>
      </section>

      <section className="py-32 px-6 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center gap-10 mb-24">
            <div className="bg-ares-gold/10 text-ares-gold px-6 py-2 ares-cut-sm font-black uppercase tracking-[0.4em] text-[10px] border border-ares-gold/20 inline-block">
               Asset Recognition // Awards
            </div>
            <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter uppercase">Digital <span className="text-ares-gold">Trophy Case</span></h2>
            <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent hidden md:block" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {isLoadingAwards ? (
              [1,2,3].map(i => <div key={i} className="h-64 bg-black/40 border border-white/5 ares-cut-lg animate-pulse" />)
            ) : awards.length > 0 ? (
              awards.map((award: Award, idx: number) => (
                <motion.div
                  key={award.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-black/40 border border-white/5 p-10 ares-cut-lg group hover:border-ares-gold/40 transition-all duration-500 relative overflow-hidden backdrop-blur-sm"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-ares-gold/5 blur-3xl rounded-full pointer-events-none group-hover:bg-ares-gold/10 transition-colors" />
                  <div className="flex justify-between items-start mb-8">
                    <div className="w-16 h-16 ares-cut bg-ares-red flex items-center justify-center shadow-lg shadow-ares-red/20 group-hover:scale-110 transition-transform duration-500">
                       <Trophy className="text-white" size={32} />
                    </div>
                    <span className="text-3xl font-black text-white/5 italic group-hover:text-white/10 transition-colors tracking-tighter">{award.year}</span>
                  </div>
                  <h3 className="text-2xl font-black text-white mb-3 uppercase tracking-tighter group-hover:text-ares-gold transition-colors leading-none">{award.title}</h3>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-marble/20 mb-6 flex items-center gap-3">
                    <MapPin size={10} className="text-ares-red" /> {award.eventName}
                  </div>
                  <p className="text-marble/40 text-sm leading-relaxed line-clamp-3 font-medium">{award.description}</p>
                </motion.div>
              ))
            ) : (
              <div className="col-span-full py-40 text-center border border-dashed border-white/10 ares-cut-lg bg-black/20">
                 <div className="w-24 h-24 bg-white/5 ares-cut flex items-center justify-center mx-auto mb-8 text-white/20 border border-white/10">
                    <Trophy size={40} />
                 </div>
                 <h3 className="text-3xl font-black text-white mb-4 uppercase tracking-tighter">The Case is <span className="text-ares-red">Open</span>.</h3>
                 <p className="text-marble/40 font-medium">We are currently cataloging our rookie season achievements.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="py-40 px-6">
         <div className="max-w-5xl mx-auto p-16 ares-cut-lg bg-black/40 border border-white/5 text-center shadow-2xl relative overflow-hidden backdrop-blur-sm group">
            <div className="absolute inset-0 bg-gradient-to-b from-ares-red/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <Trophy className="text-white mx-auto mb-10 relative z-10 group-hover:scale-110 transition-transform duration-700" size={80} strokeWidth={1} />
            <h2 className="text-5xl md:text-7xl font-black text-white mb-8 uppercase tracking-tighter relative z-10 leading-none">Support the <span className="text-ares-red italic">Legacy.</span></h2>
            <p className="text-marble/40 text-xl mb-12 max-w-2xl mx-auto relative z-10 font-medium leading-relaxed">Our history is written by the mentors, students, and sponsors who invest in our success. Join us in building the future of West Virginia engineering.</p>
            <div className="flex flex-wrap justify-center gap-6 relative z-10">
               <a href="/sponsors" className="clipped-button bg-white text-ares-red px-10 py-4 font-black uppercase tracking-widest text-sm hover:bg-black hover:text-white transition-all shadow-2xl">Sponsor ARES</a>
               <a href="/contact" className="clipped-button bg-black/60 text-white px-10 py-4 font-black uppercase tracking-widest text-sm border border-white/10 hover:bg-white/10 transition-all">Join the Team</a>
            </div>
         </div>
      </section>
    </div>
  );
}
