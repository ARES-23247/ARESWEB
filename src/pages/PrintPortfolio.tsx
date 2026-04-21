import { useState, useEffect } from "react";
import { ShieldCheck, Calendar } from "lucide-react";
import { format } from "date-fns";
import DocsMarkdownRenderer from "../components/docs/DocsMarkdownRenderer";

interface PortfolioData {
  portfolioDocs: Array<{
    title: string;
    slug: string;
    category: string;
    is_executive_summary: number;
    description: string;
    content: string;
  }>;
  awards: Array<{
    title: string;
    award_name: string;
    date: string;
    event_name: string;
  }>;
  outreach: Array<{
    date: string;
    event_name: string;
    location: string;
    students_count: number;
    hours_logged: number;
    reach_count: number;
    description: string;
  }>;
  sponsors: Array<{
    name: string;
    tier: string;
  }>;
}

export default function PrintPortfolio() {
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [readyToPrint, setReadyToPrint] = useState(false);
  const code = typeof window !== "undefined" ? localStorage.getItem("ares_judge_code") : null;
  const [error, setError] = useState<string | null>(!code ? "Unauthorized. Please login through the Judges Hub first." : null);

  useEffect(() => {
    if (!code) return;

    const fetchPortfolio = async () => {
      try {
        const res = await fetch("/api/judges/portfolio", {
          headers: { "X-Judge-Code": code }
        });
        
        if (!res.ok) {
          setError("Failed to verify access code.");
          return;
        }

        const data = await res.json() as PortfolioData;
        
        // Wait, the API returns portfolioDocs, but let's check what we destructured
        setPortfolio(data);
        
        // Wait for rendering to complete before triggering print dialog
        setTimeout(() => {
          setReadyToPrint(true);
        }, 1500); 

      } catch {
        setError("Network error fetching portfolio.");
      }
    };

    fetchPortfolio();
  }, [code]);

  useEffect(() => {
    if (readyToPrint) {
      // Trigger native print dialog
      window.print();
    }
  }, [readyToPrint]);

  if (error) {
    return (
      <div className="p-8 text-red-600 font-bold text-center">
        <h1>Print Failed</h1>
        <p>{error}</p>
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="p-20 text-center font-mono">
        Loading Engineering Portfolio Data for Print Generation...
      </div>
    );
  }

  const execDocs = portfolio.portfolioDocs?.filter(d => d.is_executive_summary) || [];
  const techDocs = portfolio.portfolioDocs?.filter(d => !d.is_executive_summary) || [];

  return (
    <div className="print-layout bg-white text-black min-h-screen">
      {/* ── COVER PAGE ─────────────────────────────────────────────────── */}
      <div className="print-cover flex flex-col items-center justify-center h-screen border-[12px] border-[#C00000] p-12 text-center page-break-after">
        <div className="w-32 h-32 mb-8 bg-black rounded-lg flex items-center justify-center p-4">
           {/* Fallback to text logo for print reliability */}
           <ShieldCheck size={80} className="text-[#C00000]" />
        </div>
        <h1 className="text-6xl font-black uppercase tracking-tighter mb-4 text-black">ARES Robotics</h1>
        <h2 className="text-4xl text-[#C00000] font-bold uppercase tracking-widest mb-12">Team 23247</h2>
        <div className="h-1 w-32 bg-black mb-12" />
        <h3 className="text-3xl font-bold text-gray-800 uppercase tracking-widest mb-4">Official Engineering Portfolio</h3>
        <p className="text-xl text-gray-500 font-mono">{format(new Date(), "MMMM do, yyyy")}</p>
        
        <div className="mt-auto mb-10 w-full text-center">
          <p className="uppercase text-sm tracking-[0.2em] font-bold text-gray-400">Generated automatically via the ARES Portal Edge Architecture</p>
        </div>
      </div>

      {/* ── EXECUTIVE SUMMARIES ────────────────────────────────────────── */}
      {execDocs.length > 0 && (
        <div className="print-section">
          <div className="print-section-header">
            <h2 className="text-3xl font-black uppercase tracking-tight text-[#C00000] border-b-4 border-black pb-4 mb-8">Executive Summaries</h2>
          </div>
          
          {execDocs.map(doc => (
            <div key={doc.slug} className="mb-12 page-break-inside-avoid">
              <h3 className="text-2xl font-bold uppercase tracking-tight mb-2">{doc.title}</h3>
              <p className="text-gray-500 italic mb-6">{doc.description}</p>
              <div className="print-prosemirror">
                <DocsMarkdownRenderer content={doc.content} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── TECHNICAL PORTFOLIO ────────────────────────────────────────── */}
      {techDocs.length > 0 && (
        <div className="print-section page-break-before">
          <div className="print-section-header flex items-center gap-4 border-b-4 border-black pb-4 mb-8">
            <h2 className="text-3xl font-black uppercase tracking-tight text-blue-800">Technical Documentation</h2>
          </div>

          <div className="space-y-12">
            {techDocs.map((doc, idx) => (
              <div key={doc.slug} className={`print-doc ${idx > 0 ? "pt-12 border-t-2 border-gray-200" : ""}`}>
                <div className="mb-6">
                  <div className="text-xs font-bold uppercase tracking-widest text-blue-800 mb-1">{doc.category}</div>
                  <h3 className="text-2xl font-bold tracking-tight mb-2">{doc.title}</h3>
                  <p className="text-gray-600 mb-4">{doc.description}</p>
                </div>
                <div className="print-prosemirror">
                  <DocsMarkdownRenderer content={doc.content} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── OUTREACH & IMPACT ──────────────────────────────────────────── */}
      {portfolio.outreach && portfolio.outreach.length > 0 && (
        <div className="print-section page-break-before">
          <div className="print-section-header border-b-4 border-black pb-4 mb-8">
            <h2 className="text-3xl font-black uppercase tracking-tight text-green-700">Community Impact & Outreach</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-6 mb-10">
            <div className="bg-gray-100 p-6 rounded-lg text-center border border-gray-300">
               <div className="text-4xl font-black text-black">
                 {portfolio.outreach.reduce((acc, curr) => acc + (curr.hours_logged || 0), 0)}
               </div>
               <div className="text-sm font-bold uppercase tracking-widest text-gray-500 mt-2">Total Outreach Hours</div>
            </div>
            <div className="bg-gray-100 p-6 rounded-lg text-center border border-gray-300">
               <div className="text-4xl font-black text-green-700">
                 {portfolio.outreach.reduce((acc, curr) => acc + ((curr.hours_logged || 0) * 5), 0).toLocaleString()}
               </div>
               <div className="text-sm font-bold uppercase tracking-widest text-gray-500 mt-2">Estimated People Impacted</div>
            </div>
          </div>

          <table className="w-full text-left border-collapse border border-black text-sm">
            <thead>
              <tr className="bg-black text-white">
                <th className="p-3 border border-gray-600">Event</th>
                <th className="p-3 border border-gray-600">Location</th>
                <th className="p-3 border border-gray-600">Date</th>
                <th className="p-3 border border-gray-600 text-center">Hours</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.outreach.map((event, i) => (
                <tr key={i} className="even:bg-gray-50">
                  <td className="p-3 border border-black font-bold">{event.event_name}</td>
                  <td className="p-3 border border-black">{event.location}</td>
                  <td className="p-3 border border-black">{format(new Date(event.date), "MMM d, yyyy")}</td>
                  <td className="p-3 border border-black text-center font-bold text-green-700">{event.hours_logged}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── AWARDS ─────────────────────────────────────────────────────── */}
      {portfolio.awards && portfolio.awards.length > 0 && (
        <div className="print-section page-break-before">
          <div className="print-section-header border-b-4 border-black pb-4 mb-8">
            <h2 className="text-3xl font-black uppercase tracking-tight text-orange-600">Official Awards</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-6">
            {portfolio.awards.map((award, i) => (
              <div key={i} className="border-l-4 border-orange-600 pl-4 py-2 mb-6 page-break-inside-avoid">
                <h4 className="text-lg font-black uppercase">{award.award_name}</h4>
                <div className="text-sm font-bold text-gray-600 mt-1">{award.title}</div>
                <div className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                  <Calendar size={14} /> {format(new Date(award.date), "MMMM yyyy")} &bull; {award.event_name}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
