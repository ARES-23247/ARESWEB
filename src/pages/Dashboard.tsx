import BlogEditor from "@/components/BlogEditor";

export default function Dashboard() {
  return (
    <div className="w-full max-w-5xl mx-auto px-6 py-12 md:py-24">
      <div className="mb-12">
        <h3 className="text-ares-cyan font-bold uppercase tracking-widest text-sm mb-2">Internal Systems</h3>
        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter shadow-sm mb-4">
          Publisher <span className="text-ares-red">Dashboard</span>
        </h1>
        <p className="text-white/60 max-w-2xl text-balance">
          Draft and commit new engineering and outreach blog posts directly to the ARES 23247 D1 Database. All content is stored natively at the Edge.
        </p>
      </div>

      <div className="glass-card rounded-2xl p-6 md:p-8 border border-white/10">
        <BlogEditor />
      </div>
    </div>
  );
}
