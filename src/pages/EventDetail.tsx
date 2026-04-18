import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import TiptapRenderer, { type ASTNode } from "../components/TiptapRenderer";

interface EventRow {
  id: string;
  title: string;
  date_start: string;
  date_end: string | null;
  location: string | null;
  description: string;
  cover_image: string | null;
}

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/events/${id}`)
      .then((r) => { if (!r.ok) { setNotFound(true); setLoading(false); return null; } return r.json(); })
      .then((data) => { if (data && data.event) { setEvent(data.event); } else { setNotFound(true); } setLoading(false); })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [id]);

  if (loading) return <div className="w-full min-h-[50vh] flex items-center justify-center text-ares-gold animate-pulse font-heading tracking-widest">Consulting the Oracle...</div>;
  if (notFound || !event) return <div className="w-full max-w-4xl mx-auto px-6 py-24 text-white/80 font-mono text-center">Event Record Erased or Unfound.</div>;

  // Try to parse description as Tiptap AST. If it fails, treat as a legacy plain-text description.
  let parsedAst: ASTNode | null = null;
  try {
    parsedAst = JSON.parse(event.description);
    if (!parsedAst || parsedAst.type !== "doc") parsedAst = null; // Basic validation
  } catch {
    parsedAst = null;
  }

  const startDate = new Date(event.date_start);
  const isPast = startDate.getTime() < Date.now();

  return (
    <div className="w-full min-h-screen bg-obsidian text-marble">
      {/* ─── STANDALONE EVENT HERO ─── */}
      <section className="relative w-full h-[50vh] min-h-[400px] flex items-center overflow-hidden bg-obsidian border-b-[8px] border-ares-bronze/40 meander-divider">
        {event.cover_image ? (
          <img src={event.cover_image} alt={event.title} className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-luminosity" />
        ) : (
          <div className="absolute inset-0 w-full h-full bg-gradient-to-tr from-ares-red/40 to-obsidian opacity-80" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/70 to-transparent"></div>
        
        {/* Motif: Glowing shield orb (Aegis) overlay */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vh] h-[80vh] rounded-full border border-ares-gold/10 shadow-[0_0_120px_rgba(192,0,0,0.15)] pointer-events-none mix-blend-screen animate-pulse-slow"></div>
        
        <div className="relative z-10 max-w-5xl mx-auto px-6 w-full mt-16">
          <Link to="/events" className="text-ares-gold hover:text-white uppercase tracking-widest text-xs font-bold transition-all flex items-center gap-2 mb-6">
            <span>&larr;</span> Back to Archive
          </Link>
          <div className="flex items-center gap-4 mb-4">
            <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest ${isPast ? "bg-zinc-800 text-zinc-400" : "bg-ares-red/20 text-ares-red border border-ares-red/50 shadow-[0_0_15px_rgba(192,0,0,0.4)]"}`}>
              {isPast ? "Historical Record" : "Active Campaign"}
            </span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-white leading-tight uppercase font-heading drop-shadow-2xl">
            {event.title}
          </h1>
          <div className="mt-8 flex flex-col md:flex-row gap-6 text-ares-bronze font-medium text-lg lg:text-xl">
            <p className="flex items-center gap-2">
              <span className="text-white/70">Date:</span> {startDate.toLocaleDateString("en-US", { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
            {event.location && (
              <p className="flex items-center gap-2">
                <span className="text-white/70">Location:</span> {event.location}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ─── EVENT CONTENT BODY ─── */}
      <section className="relative w-full max-w-5xl mx-auto px-6 py-16 flex flex-col md:flex-row gap-12">
        {/* Motif: Ionic Pillar Divider on Desktop */}
        <div className="hidden md:flex flex-col items-center shrink-0 w-8 opacity-20">
          <div className="w-8 h-4 border-b-2 border-ares-gold rounded-t-lg mb-2"></div>
          <div className="w-2 flex-1 bg-gradient-to-b from-ares-gold to-ares-bronze/10 rounded-full"></div>
          <div className="w-8 h-4 border-t-2 border-ares-bronze/10 rounded-b-lg mt-2"></div>
        </div>

        <article className="prose prose-invert lg:prose-lg max-w-none w-full prose-headings:text-white prose-headings:font-heading prose-headings:uppercase prose-p:text-white/80 prose-a:text-ares-gold prose-img:rounded-2xl prose-img:border prose-img:border-zinc-800">
          {parsedAst ? (
            <TiptapRenderer node={parsedAst} />
          ) : (
            <p className="whitespace-pre-wrap text-xl leading-relaxed">{event.description}</p>
          )}
        </article>
      </section>
    </div>
  );
}
