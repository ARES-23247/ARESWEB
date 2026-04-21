import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, isBefore } from "date-fns";
import { motion } from "framer-motion";
import TiptapRenderer, { type ASTNode } from "../components/TiptapRenderer";
import CommentSection from "../components/CommentSection";
import EventSignups from "../components/EventSignups";
import { DEFAULT_COVER_IMAGE } from "../utils/constants";

interface EventRow {
  id: string;
  title: string;
  date_start: string;
  date_end: string | null;
  location: string | null;
  description: string;
  cover_image: string | null;
  is_potluck: number | null;
}

import { Calendar, Edit2 } from "lucide-react";
import { GreekMeander } from "../components/GreekMeander";
import { useSession } from "../utils/auth-client";

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  
  // @ts-expect-error - Better Auth session type overrides
  const userRole = (session?.user?.role as string) || "user";
  const isEditor = userRole === "admin" || userRole === "author";

  const { data: event, isLoading, isError } = useQuery<EventRow>({
    queryKey: ["event", id],
    queryFn: async () => {
      const r = await fetch(`/api/events/${id}`);
      if (!r.ok) throw new Error("Event Record Erased or Unfound.");
      const data = await r.json();
      // @ts-expect-error -- D1 untyped response
      if (!data || !data.event) throw new Error("Event Record Erased or Unfound.");
      // @ts-expect-error -- D1 untyped response
      return data.event;
    },
    enabled: !!id,
    retry: false, // Don't retry 404s
  });

  if (isLoading) return <div className="w-full min-h-[50vh] flex items-center justify-center text-ares-gold animate-pulse font-heading tracking-widest">Consulting the Oracle...</div>;
  if (isError || !event) return <div className="w-full max-w-4xl mx-auto px-6 py-24 text-white/80 font-mono text-center">Event Record Erased or Unfound.</div>;

  const isPast = isBefore(new Date(event.date_start), new Date());
  
  const handleSaveToCalendar = () => {
    if (!event) return;
    const startStr = new Date(event.date_start).toISOString().replace(/-|:|\.\d+/g, '');
    let endStr: string;
    if (event.date_end) {
      endStr = new Date(event.date_end).toISOString().replace(/-|:|\.\d+/g, '');
    } else {
      const end = new Date(event.date_start);
      end.setHours(end.getHours() + 2);
      endStr = end.toISOString().replace(/-|:|\.\d+/g, '');
    }

    const icsData = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      `DTSTART:${startStr}`,
      `DTEND:${endStr}`,
      `SUMMARY:${event.title}`,
      `LOCATION:${event.location || ''}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Try to parse description as Tiptap AST. If it fails, treat as a legacy plain-text description.
  let parsedAst: ASTNode | null;
  try {
    parsedAst = JSON.parse(event.description);
    if (!parsedAst || parsedAst.type !== "doc") parsedAst = null;
  } catch {
    parsedAst = null;
  }

  const startDate = new Date(event.date_start);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full min-h-screen bg-obsidian text-marble"
    >
      {/* ─── STANDALONE EVENT HERO ─── */}
      <section className="relative w-full h-[50vh] min-h-[400px] flex items-center overflow-hidden bg-obsidian border-b-4 border-ares-bronze">
        <GreekMeander variant="thick" opacity="opacity-60" className="absolute bottom-[-1px] left-0 z-10" />
        <img src={event.cover_image || DEFAULT_COVER_IMAGE} alt={event.title} className={`absolute inset-0 w-full h-full opacity-60 mix-blend-luminosity ${event.cover_image ? 'object-cover' : 'object-contain p-16 bg-black/80'}`} />
        <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/70 to-transparent"></div>
        
        {/* Motif: Glowing shield orb (Aegis) overlay */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vh] h-[80vh] rounded-full border border-ares-gold/10 shadow-[0_0_120px_rgba(192,0,0,0.15)] pointer-events-none mix-blend-screen animate-pulse-slow" aria-hidden="true"></div>
        
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="relative z-10 max-w-5xl mx-auto px-6 w-full mt-16"
        >
          <Link to="/events" className="text-ares-gold hover:text-white uppercase tracking-widest text-xs font-bold transition-all flex items-center gap-2 mb-6 w-fit">
            <span>&larr;</span> Back to Archive
          </Link>
          <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
            <span className={`w-fit px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest ${isPast ? "bg-zinc-800 text-zinc-400" : "bg-ares-red/20 text-ares-red border border-ares-red/50 shadow-[0_0_15px_rgba(192,0,0,0.4)]"}`}>
              {isPast ? "Historical Record" : "Upcoming Event"}
            </span>
            
            {!isPast && (
              <button 
                onClick={handleSaveToCalendar}
                className="w-fit flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest bg-zinc-800/80 hover:bg-ares-gold text-zinc-300 hover:text-black border border-zinc-700 hover:border-ares-gold transition-all shadow-lg backdrop-blur-sm"
              >
                <Calendar size={14} /> Add to Calendar
              </button>
            )}
            {isEditor && (
              <Link 
                to={`/dashboard?editEvent=${event.id}`}
                className="w-fit flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest bg-ares-cyan/10 hover:bg-ares-cyan text-ares-cyan hover:text-black border border-ares-cyan/30 transition-all shadow-lg backdrop-blur-sm"
              >
                <Edit2 size={14} /> Edit Event
              </Link>
            )}
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight uppercase font-heading drop-shadow-2xl">
            {event.title}
          </h1>
          <div className="mt-8 flex flex-col md:flex-row gap-6 text-ares-bronze font-medium text-lg lg:text-xl">
            <p className="flex items-center gap-2">
              <span className="text-white/70">Date:</span> {format(startDate, 'EEEE, MMMM do, yyyy')}
            </p>
            {event.location && (
              <p className="flex items-center gap-2">
                <span className="text-white/70">Location:</span> {event.location}
              </p>
            )}
          </div>
        </motion.div>
      </section>

      {/* ─── EVENT CONTENT BODY ─── */}
      <section className="relative w-full max-w-5xl mx-auto px-6 py-16 flex flex-col md:flex-row gap-12">
        {/* Motif: Ionic Pillar Divider on Desktop */}
        <div className="hidden md:flex flex-col items-center shrink-0 w-8 opacity-20" aria-hidden="true">
          <div className="w-8 h-4 border-b-2 border-ares-gold rounded-t-lg mb-2"></div>
          <div className="w-2 flex-1 bg-gradient-to-b from-ares-gold to-ares-bronze/10 rounded-full"></div>
          <div className="w-8 h-4 border-t-2 border-ares-bronze/10 rounded-b-lg mt-2"></div>
        </div>

        <motion.article 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="prose prose-invert lg:prose-lg max-w-none w-full prose-headings:text-white prose-headings:font-heading prose-headings:uppercase prose-p:text-white/80 prose-a:text-ares-gold prose-img:ares-cut prose-img:border prose-img:border-zinc-800"
        >
          {parsedAst ? (
            <TiptapRenderer node={parsedAst} />
          ) : (
            <p className="whitespace-pre-wrap text-xl leading-relaxed">{event.description}</p>
          )}

          {/* Sign-Up Sheet & Comments (auth-gated) */}
          {id && <EventSignups eventId={id} isPotluck={event.is_potluck === 1} isVolunteer={event.is_volunteer === 1} />}
          {id && <CommentSection targetType="event" targetId={id} />}
        </motion.article>
      </section>
    </motion.div>
  );
}
