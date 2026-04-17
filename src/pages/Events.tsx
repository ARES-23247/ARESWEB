const events = [
  { id: 1, title: "Design Requirements Review", date: "2026-03-02", type: "Team Meeting", description: "Full team review of subsystem requirements before CAD lock.", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { id: 2, title: "STEM Night Outreach", date: "2026-03-08", type: "Outreach", description: "Demonstrating our driver station and chassis at the local middle school.", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  { id: 3, title: "Silicon Valley Regional", date: "2026-03-12", type: "Qualifier", description: "Our first major competition event. Loading out starts Thursday morning.", color: "bg-ares-red/20 text-ares-red border-ares-red/30" },
  { id: 4, title: "Programming Subsystem Testing", date: "2026-03-18", type: "Team Meeting", description: "Testing path planner autonomous routines on the practice field.", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { id: 5, title: "PNW District Championship", date: "2026-04-03", type: "Qualifier", description: "The ultimate showdown. Let's aim for Einstein!", color: "bg-ares-cyan/20 text-ares-cyan border-ares-cyan/30" },
];

export default function Events() {
  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-12 md:py-24">
      <div className="mb-12">
        <h3 className="text-ares-cyan font-bold uppercase tracking-widest text-sm mb-2">Schedule &amp; Planner</h3>
        <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter shadow-sm">
          Upcoming <span className="text-ares-cyan">Events</span>
        </h1>
        <p className="text-white/60 mt-4 max-w-2xl text-balance">
          Keep track of ARES 23247&apos;s upcoming robotic qualifiers, community outreach events, and team engineering workshops.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map((event) => {
          const d = new Date(event.date);
          const month = d.toLocaleString("en-US", { month: "short" });
          const day = d.getDate();
          return (
            <div key={event.id} className="glass-card rounded-2xl p-6 transition-transform duration-300 hover:-translate-y-1 hover:border-white/20 flex flex-col h-full relative overflow-hidden group">
              <div className="mb-4 flex items-center justify-between">
                <div className="bg-black/60 rounded-xl px-4 py-3 border border-white/10 text-center shadow-lg">
                  <p className="text-ares-red text-xs font-black uppercase tracking-widest leading-none mb-1">{month}</p>
                  <p className="text-white text-2xl font-bold leading-none">{day}</p>
                </div>
                <span className={`px-3 py-1 rounded-full border text-xs font-semibold ${event.color}`}>
                  {event.type}
                </span>
              </div>
              <h4 className="text-xl font-bold text-white mb-2">{event.title}</h4>
              <p className="text-sm text-white/60 flex-grow leading-relaxed">{event.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
