import { Link } from "react-router-dom";
import { ArrowLeft, BookOpen, ShieldCheck } from "lucide-react";
import SEO from "@/components/SEO";

const publicEndpoints = [
  ["GET", "/api/calendar/events", "Published calendar events"],
  ["GET", "/api/calendar/events/:id", "One published event"],
  ["GET", "/api/calendar/feed", "Public iCalendar feed"],
  ["GET", "/api/photos/public", "Published gallery photos"],
  ["GET", "/api/videos/public", "Published videos"],
  ["GET", "/api/robots", "Published robot records"],
  ["GET", "/api/sponsors", "Published sponsors"],
  ["GET", "/api/outreach", "Published outreach summaries"],
] as const;

export default function DeveloperApiPage() {
  return (
    <main className="min-h-screen bg-obsidian px-4 pb-16 pt-24 text-white">
      <SEO title="API Reference" description="A limited reference for supported ARESWEB public endpoints." noindex />
      <div className="mx-auto max-w-5xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-ares-gold focus-visible:ring-2 focus-visible:ring-ares-cyan">
          <ArrowLeft aria-hidden="true" size={16} /> Back to the website
        </Link>
        <h1 className="mt-6 font-heading text-4xl font-black uppercase">API Reference</h1>
        <p className="mt-3 max-w-3xl leading-relaxed text-marble/80">
          ARESWEB does not offer personal access tokens or a public interactive explorer. Team-only endpoints accept Firebase ID tokens from the signed-in portal and enforce roles on the server.
        </p>

        <section className="mt-10 border border-white/10 bg-white/5 p-6" aria-labelledby="public-api-heading">
          <h2 id="public-api-heading" className="flex items-center gap-2 text-2xl font-bold"><BookOpen aria-hidden="true" className="text-ares-gold" /> Supported public reads</h2>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b border-white/15 text-marble/60"><th className="p-3">Method</th><th className="p-3">Path</th><th className="p-3">Purpose</th></tr></thead>
              <tbody>{publicEndpoints.map(([method, path, purpose]) => <tr key={path} className="border-b border-white/10"><td className="p-3 font-mono text-ares-gold">{method}</td><td className="p-3 font-mono">{path}</td><td className="p-3 text-marble/80">{purpose}</td></tr>)}</tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 border border-ares-gold/30 bg-ares-gold/10 p-6">
          <h2 className="flex items-center gap-2 text-xl font-bold"><ShieldCheck aria-hidden="true" className="text-ares-gold" /> Integration expectations</h2>
          <p className="mt-3 text-sm leading-relaxed text-marble/85">Responses are bounded and may use cursor pagination. Clients must handle non-2xx responses and rate limits. Contact the team before building a production dependency because this is not a versioned public platform.</p>
        </section>
      </div>
    </main>
  );
}
