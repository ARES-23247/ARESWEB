import BlogEditor from "@/components/BlogEditor";
import EventEditor from "@/components/EventEditor";
import ContentManager from "@/components/ContentManager";

export default function Dashboard() {
  return (
    <div className="w-full min-h-screen bg-zinc-950 text-zinc-100 py-8">
      <div className="w-full max-w-5xl mx-auto px-6 py-12 md:py-24">
        <div className="mb-12">
          <h3 className="text-ares-gold font-bold uppercase tracking-widest text-sm mb-2">Internal Systems</h3>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter shadow-sm mb-4">
            Publisher <span className="text-ares-red">Dashboard</span>
          </h1>
          <p className="text-zinc-400 max-w-2xl text-balance">
            Draft and commit new engineering and outreach blog posts directly to the ARES 23247 D1 Database. All content is stored natively at the Edge.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
          <div className="glass-card rounded-3xl p-6 md:p-8 border border-zinc-800 flex flex-col h-full bg-zinc-900 shadow-2xl">
            <BlogEditor />
          </div>
          
          <div className="glass-card rounded-3xl p-6 md:p-8 border border-ares-red/30 flex flex-col h-full bg-zinc-900 relative shadow-2xl">
            <div className="absolute inset-0 bg-ares-red/5 rounded-3xl pointer-events-none mix-blend-screen" />
            <div className="relative z-10 w-full h-full">
              <EventEditor />
            </div>
          </div>
        </div>

        {/* Content Manager Full Width Row */}
        <div className="w-full glass-card rounded-3xl p-6 md:p-8 border border-zinc-800 flex flex-col bg-zinc-900 shadow-2xl mt-8">
          <ContentManager />
        </div>
      </div>
    </div>
  );
}
