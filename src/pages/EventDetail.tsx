import { useParams, Link } from "react-router-dom";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useQuery } from "@tanstack/react-query";
import { format, isBefore } from "date-fns";
import { motion } from "framer-motion";
import TiptapRenderer, { type ASTNode } from "../components/TiptapRenderer";
import EventSignups from "../components/EventSignups";
import ZulipThreadViewer from "../components/events/ZulipThreadViewer";
import { DEFAULT_COVER_IMAGE } from "../utils/constants";
import { api } from "../api/client";
import SEO from "../components/SEO";
import { extractTextFromAst } from "../utils/content";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface EventRow {
  id: string;
  title: string;
  date_start: string;
  date_end: string | null;
  location: string | null;
  description: string;
  cover_image: string | null;
  is_potluck: number | null;
  is_volunteer: number | null;
  meeting_notes?: string | null;
}

import { Calendar, Edit2 } from "lucide-react";
import { GreekMeander } from "../components/GreekMeander";
import { useSession } from "../utils/auth-client";
import { downloadICS } from "../utils/calendar";

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();

  const userRole = (session?.user as Record<string, unknown>)?.role || "user";
  const isEditor = userRole === "admin" || userRole === "author";

  const { data: eventRes, isLoading, isError } = api.events.getEvent.useQuery(["event", id], {
    params: { id: id || "" },
  }, {
    enabled: !!id,
    retry: false,
  });

  const event = eventRes?.status === 200 ? eventRes.body.event : null;

  if (isLoading) return <div className="w-full min-h-[50vh] flex items-center justify-center text-ares-gold animate-pulse font-heading tracking-widest">Consulting the Oracle...</div>;
  if (isError || !event) return <div className="w-full max-w-4xl mx-auto px-6 py-24 text-white font-mono text-center">Event Record Erased or Unfound.</div>;

  const isPast = isBefore(new Date(event.date_start), new Date());
  
  const handleSaveToCalendar = () => {
    if (event) {
      downloadICS(event);
    }
  };

  // Try to parse description as Tiptap AST. If it fails, treat as a legacy plain-text description.
  let parsedAst: ASTNode | null;
  try {
    parsedAst = JSON.parse(event.description);
    if (!parsedAst || parsedAst.type !== "doc") parsedAst = null;
  } catch {
    parsedAst = null;
  }

  let parsedNotesAst: ASTNode | null = null;
  if (event.meeting_notes) {
    try {
      parsedNotesAst = JSON.parse(event.meeting_notes);
      if (!parsedNotesAst || parsedNotesAst.type !== "doc") parsedNotesAst = null;
    } catch {
      parsedNotesAst = null;
    }
  }

  const startDate = new Date(event.date_start);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full min-h-screen bg-obsidian text-marble"
    >
      <SEO 
        title={event.title} 
        description={parsedAst ? extractTextFromAst(parsedAst).slice(0, 160) + "..." : event.description.slice(0, 160) + "..."} 
        image={event.cover_image || undefined}
        type="event"
      />
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
            <span className={`w-fit px-4 py-1.5 ares-cut-sm text-xs font-bold uppercase tracking-widest ${isPast ? "bg-obsidian text-white/60" : "bg-ares-red/20 text-ares-red border border-ares-red/50 shadow-[0_0_15px_rgba(192,0,0,0.4)]"}`}>
              {isPast ? "Historical Record" : "Upcoming Event"}
            </span>
            
            {!isPast && (
              <button 
                onClick={handleSaveToCalendar}
                className="w-fit flex items-center gap-2 px-4 py-1.5 ares-cut-sm text-xs font-bold uppercase tracking-widest bg-obsidian/80 hover:bg-ares-gold text-white hover:text-black border border-white/10 hover:border-ares-gold transition-all shadow-lg backdrop-blur-sm"
              >
                <Calendar size={14} /> Add to Calendar
              </button>
            )}
            {isEditor && (
              <Link 
                to={`/dashboard/event/${event.id}`}
                className="w-fit flex items-center gap-2 px-4 py-1.5 ares-cut-sm text-xs font-bold uppercase tracking-widest bg-ares-cyan/10 hover:bg-ares-cyan text-ares-cyan hover:text-black border border-ares-cyan/30 transition-all shadow-lg backdrop-blur-sm"
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
              <span className="text-white">Date:</span> {format(startDate, 'EEEE, MMMM do, yyyy')}
            </p>
            {event.location && (
              <p className="flex items-center gap-2">
                <span className="text-white">Location:</span> {event.location}
              </p>
            )}
          </div>
        </motion.div>
      </section>

      {/* ─── EVENT CONTENT BODY ─── */}
      <section className="relative w-full max-w-5xl mx-auto px-6 py-16 flex flex-col md:flex-row gap-12">
        {/* Motif: Ionic Pillar Divider on Desktop */}
        <div className="hidden md:flex flex-col items-center shrink-0 w-8 opacity-20" aria-hidden="true">
          <div className="w-8 h-4 border-b-2 border-ares-gold mb-2"></div>
          <div className="w-2 flex-1 bg-gradient-to-b from-ares-gold to-ares-bronze/10 rounded-full"></div>
          <div className="w-8 h-4 border-t-2 border-ares-bronze/10 mt-2"></div>
        </div>

        <motion.article 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="prose prose-invert lg:prose-lg max-w-none w-full prose-headings:text-white prose-headings:font-heading prose-headings:uppercase prose-p:text-white prose-a:text-ares-gold prose-img:ares-cut prose-img:border prose-img:border-white/10"
        >
          {parsedAst ? (
            <TiptapRenderer node={parsedAst} />
          ) : (
            <p className="whitespace-pre-wrap text-xl leading-relaxed">{event.description}</p>
          )}

          {event.meeting_notes && (
            <div className="mt-12 bg-ares-red/10 border border-ares-red/30 ares-cut-sm p-8">
              <h2 className="text-2xl font-bold text-ares-red flex items-center gap-2 mb-6 border-b border-ares-red/20 pb-4 !mt-0">
                <span>🔒 Private Meeting Notes</span>
              </h2>
              <div className="prose prose-invert lg:prose-lg max-w-none prose-headings:text-ares-gold prose-a:text-ares-gold">
                {parsedNotesAst ? (
                  <TiptapRenderer node={parsedNotesAst} />
                ) : (
                  <p className="whitespace-pre-wrap">{event.meeting_notes}</p>
                )}
              </div>
            </div>
          )}

          {/* Sign-Up Sheet */}
          {id && <EventSignups eventId={id} isPotluck={event.is_potluck === 1} isVolunteer={event.is_volunteer === 1} />}
          
          {/* Zulip Discussion Thread */}
          {session && (
            <div className="mt-12">
              <ZulipThreadViewer stream="events" topic={`Event: ${event.title}`} label="Event Discussion" />
            </div>
          )}
        </motion.article>
      </section>
    </motion.div>
  );
}
