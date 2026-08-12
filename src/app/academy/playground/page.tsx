import SEO from "@/components/SEO";
import SimulationPlayground from "@/components/SimulationPlayground";

export default function AcademyPlaygroundPage() {
  return (
    <div className="min-h-screen bg-obsidian px-4 pb-8 pt-24 text-white">
      <SEO title="Simulation Playground" description="Open, run, and share ARES robotics simulations in the browser." noindex />
      <header className="mx-auto mb-4 max-w-7xl">
        <h1 className="font-heading text-3xl font-black uppercase">Simulation Playground</h1>
        <p className="mt-2 text-sm text-marble/70">Shared links open here without depending on a Firestore lesson record.</p>
      </header>
      <div className="mx-auto h-[82vh] max-w-7xl overflow-hidden border border-white/10 bg-black/10">
        <SimulationPlayground />
      </div>
    </div>
  );
}
