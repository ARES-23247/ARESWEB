// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Trophy, History, MapPin, Cpu, ExternalLink } from "lucide-react";
import SEO from "../components/SEO";
import { api } from "../api/client";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface Season {
  start_year: number;
  end_year: number;
  challenge_name: string;
  robot_name: string | null;
  robot_image: string | null;
  summary: string | null;
  robot_cad_url: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface Award {
  id: string;
  title: string;
  year: number;
  event_name: string | null;
  image_url: string | null;
  description: string | null;
}

export default function Seasons() {
  const { data: seasonsRes, isLoading: isLoadingSeasons } = api.seasons.list.useQuery(["public-seasons"], {});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawBody = (seasonsRes as any)?.body;
  const seasons = seasonsRes?.status === 200 ? (Array.isArray(rawBody) ? rawBody : (Array.isArray(rawBody?.seasons) ? rawBody.seasons : [])) : [];

  const { data: awardsRes, isLoading: isLoadingAwards } = api.awards.getAwards.useQuery(["public-awards"], {});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const awards = (awardsRes?.body as any)?.awards || [];



  return (
    <div className="flex flex-col w-full bg-ares-gray-deep min-h-screen text-marble relative overflow-hidden">
      <SEO title="Team Legacy" description="A chronicle of ARES 23247's journey through FIRST Robotics. Explore our seasonal achievements, awards, and growth." />
      
      <section className="py-32 px-6 relative z-10 text-center bg-ares-gray-deep">
        <motion.div
           initial={{ opacity: 0, scale: 0.9 }}
           animate={{ opacity: 1, scale: 1 }}
           className="inline-flex items-center gap-2 px-4 py-2 ares-cut-sm bg-white/5 border border-white/10 text-ares-gold text-xs font-bold uppercase tracking-widest mb-8"
        >
          <History size={14} />
          Establishing Excellence Since 2025
        </motion.div>
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-6xl md:text-8xl font-black text-white mb-8 tracking-tighter italic"
        >
          Our <span className="bg-ares-red px-6 py-2 ares-cut shadow-xl mt-2 inline-block text-white">Legacy</span>.
        </motion.h1>
        <p className="text-marble text-xl max-w-2xl mx-auto leading-relaxed font-medium">
          The story of ARES 23247 is told through the banners we hang and the challenges we overcome. We document our history to inspire our future.
        </p>
      </section>

      {/* Seasonal Timeline */}
      <section className="py-32 px-6 bg-ares-gray-dark/50 relative z-10 border-y border-white/5">
        <div className="max-w-6xl mx-auto">
          <header className="mb-20 text-center">
            <h2 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter mb-4">Journey Through Time</h2>
            <p className="text-marble font-medium italic uppercase tracking-widest text-xs">Our evolution from a rookie build to a championship contender.</p>
          </header>

          <div className="space-y-32 relative">
             <div className="absolute left-0 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-ares-red via-ares-gold to-ares-cyan md:-translate-x-1/2 opacity-20" />
             
             {isLoadingSeasons ? (
               <div className="flex justify-center py-20">
                 <div className="w-10 h-10 border-2 border-white/10 border-t-ares-red rounded-full animate-spin" />
               </div>
             ) : seasons.length > 0 ? (
               // eslint-disable-next-line @typescript-eslint/no-explicit-any
               seasons.map((season: any, idx: number) => {
                 const isEven = idx % 2 === 0;
                 return (
                   <motion.div 
                     key={season.start_year}
                     initial={{ opacity: 0, x: isEven ? -50 : 50 }}
                     whileInView={{ opacity: 1, x: 0 }}
                     className="relative pl-8 md:pl-0"
                   >
                      <div className="absolute left-[-5px] md:left-1/2 md:-translate-x-1/2 top-0 w-3 h-3 rounded-full bg-ares-red shadow-[0_0_15px_rgba(192,0,0,0.8)] z-20" />
                      
                      <div className={`flex flex-col md:flex-row items-start gap-8 md:gap-16 ${isEven ? 'md:flex-row' : 'md:flex-row-reverse'}`}>
                        <div className={`md:w-1/2 ${isEven ? 'md:text-right' : 'md:text-left'}`}>
                           <div className={`mb-3 flex ${isEven ? 'md:justify-end' : 'md:justify-start'}`}>
                             <span className="bg-ares-red text-white text-xs font-black uppercase tracking-widest px-3 py-1 ares-cut-sm shadow-md">
                               {season.start_year}-{season.end_year}
                             </span>
                           </div>
                           <h3 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter mb-4 uppercase leading-none">
                             {season.challenge_name}
                           </h3>
                           {season.summary && (
                             <p className="text-marble text-lg leading-relaxed mb-6 font-medium">
                               {season.summary}
                             </p>
                           )}
                           
                           {season.robot_name && (
                             <div className={`flex items-center gap-3 mb-6 p-4 bg-white/5 border border-white/10 ares-cut-sm ${isEven ? 'md:justify-end' : 'md:justify-start'}`}>
                               <Cpu size={20} className="text-ares-gold" />
                               <div className={isEven ? 'md:text-right' : 'md:text-left'}>
                                 <span className="block text-xs font-black text-ares-gold uppercase tracking-widest">Designated Asset</span>
                                 <span className="text-white font-bold">{season.robot_name}</span>
                               </div>
                             </div>
                           )}

                           <div className={`flex flex-wrap gap-2 ${isEven ? 'md:justify-end' : 'md:justify-start'}`}>
                              {season.robot_cad_url && (
                                <a 
                                  href={season.robot_cad_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="px-4 py-2 bg-white/5 border border-white/10 text-marble hover:text-white hover:bg-white/10 ares-cut-sm text-xs font-black tracking-widest transition-all flex items-center gap-2"
                                >
                                  CAD REPOSITORY <ExternalLink size={12} />
                                </a>
                              )}
                           </div>
                        </div>

                        {season.robot_image && (
                          <div className="md:w-1/2 flex justify-center">
                            <div className="w-full max-w-md aspect-video ares-cut overflow-hidden border border-white/10 shadow-2xl group">
                              <img 
                                src={season.robot_image} 
                                alt={season.robot_name || season.challenge_name} 
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                              />
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

      {/* Trophy Case Section */}
      <section className="py-32 px-6 relative z-10 bg-ares-gray-deep">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-16">
            <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase">Digital Trophy Case</h2>
            <div className="h-px flex-1 bg-gradient-to-r from-ares-gold/50 to-transparent" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {isLoadingAwards ? (
              [1,2,3].map(i => <div key={i} className="h-64 bg-white/5 ares-cut animate-pulse" />)
            ) : awards.length > 0 ? (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              awards.map((award: any, idx: number) => (
                <motion.div
                  key={award.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-ares-gray-dark border border-white/5 p-8 ares-cut group hover:border-ares-gold/40 transition-all relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-ares-gold/5 blur-3xl rounded-full pointer-events-none" />
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-16 h-16 ares-cut bg-ares-red flex items-center justify-center shadow-lg shadow-ares-red/20">
                       <Trophy className="text-white" size={32} />
                    </div>
                    <span className="text-2xl font-black text-white/20 italic">{award.year}</span>
                  </div>
                  <h3 className="text-2xl font-black text-white mb-2 italic tracking-tighter group-hover:text-ares-gold transition-colors">{award.title}</h3>
                  <div className="text-xs font-bold uppercase tracking-widest text-marble mb-4 flex items-center gap-2">
                    <MapPin size={10} className="text-ares-red" /> {award.event_name}
                  </div>
                  <p className="text-marble text-sm leading-relaxed line-clamp-3">{award.description}</p>
                </motion.div>
              ))
            ) : (
              <div className="col-span-full py-32 text-center border-2 border-dashed border-white/5 ares-cut-lg">
                 <div className="w-20 h-20 bg-ares-red ares-cut flex items-center justify-center mx-auto mb-6 text-white shadow-lg shadow-ares-red/20">
                    <Trophy size={40} />
                 </div>
                 <h3 className="text-2xl font-bold text-white mb-2 uppercase tracking-tighter">The Case is Open.</h3>
                 <p className="text-marble">We are currently cataloging our rookie season achievements.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Footer Support */}
      <section className="py-32 px-6">
         <div className="max-w-4xl mx-auto p-12 ares-cut bg-obsidian border border-white/10 text-center shadow-2xl relative overflow-hidden">
            <Trophy className="text-white mx-auto mb-8 relative z-10" size={64} strokeWidth={1} />
            <h2 className="text-4xl font-black text-white mb-6 italic tracking-tighter relative z-10">SUPPORT THE LEGACY.</h2>
            <p className="text-white text-lg mb-10 max-w-xl mx-auto relative z-10 font-medium">Our history is written by the mentors, students, and sponsors who invest in our success. Join us in building the future.</p>
            <div className="flex flex-wrap justify-center gap-4 relative z-10">
               <a href="/sponsors" className="px-8 py-4 bg-white text-ares-red font-black ares-cut-sm hover:scale-105 transition-all shadow-lg">SPONSOR ARES</a>
               <a href="/contact" className="px-8 py-4 bg-ares-gray-dark text-white font-black ares-cut-sm hover:bg-white/10 transition-all border border-white/10">JOIN THE TEAM</a>
            </div>
         </div>
      </section>
    </div>
  );
}
