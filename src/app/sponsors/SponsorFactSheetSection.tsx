"use client";

import { useState } from "react";
import { AlertCircle, FileText, Printer } from "lucide-react";
import { siteConfig } from "@/lib/site-config";
import { encodeQrMatrix, qrMatrixToSvgPath } from "@/lib/qrSvg";

interface SponsorFactSheetSectionProps {
  publishedPartnerCount: number;
}

interface LiveImpactSummary {
  outreachEvents: number;
  outreachHours: number;
  peopleReached: number;
  publishedSeasons: number;
  publishedAwards: number;
}

export default function SponsorFactSheetSection({
  publishedPartnerCount,
}: SponsorFactSheetSectionProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [impact, setImpact] = useState<LiveImpactSummary | null>(null);

  const qrMatrix = encodeQrMatrix("https://aresfirst.org/sponsors");
  const qrSize = qrMatrix.size + 4;
  const qrPath = qrMatrixToSvgPath(qrMatrix, 2);

  const handleToggleSheet = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (impact) return;

    setLoading(true);
    setError(null);
    try {
      const [outreachRes, seasonsRes, awardsRes] = await Promise.all([
        fetch("/api/outreach?limit=100"),
        fetch("/api/seasons"),
        fetch("/api/awards"),
      ]);
      if (!outreachRes.ok || !seasonsRes.ok || !awardsRes.ok) {
        throw new Error("Unable to load live public impact records.");
      }
      const outreachJson = (await outreachRes.json()) as {
        logs?: Array<{ hours?: number; peopleReached?: number }>;
      };
      const seasonsJson = (await seasonsRes.json()) as { seasons?: unknown[] };
      const awardsJson = (await awardsRes.json()) as { awards?: unknown[] };

      const logs = Array.isArray(outreachJson.logs) ? outreachJson.logs : [];
      const outreachHours = logs.reduce(
        (acc, item) => acc + (typeof item.hours === "number" ? item.hours : 0),
        0,
      );
      const peopleReached = logs.reduce(
        (acc, item) =>
          acc + (typeof item.peopleReached === "number" ? item.peopleReached : 0),
        0,
      );

      setImpact({
        outreachEvents: logs.length,
        outreachHours: Math.round(outreachHours * 10) / 10,
        peopleReached,
        publishedSeasons: Array.isArray(seasonsJson.seasons)
          ? seasonsJson.seasons.length
          : 0,
        publishedAwards: Array.isArray(awardsJson.awards)
          ? awardsJson.awards.length
          : 0,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Live impact metrics could not be reached.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-10">
      <div className="flex justify-end print:hidden">
        <button
          type="button"
          onClick={() => void handleToggleSheet()}
          aria-expanded={open}
          className="inline-flex items-center gap-2 rounded border border-ares-gold/40 bg-ares-gold/15 px-4 py-2 text-xs font-black uppercase tracking-wider text-ares-gold hover:bg-ares-gold/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
        >
          <FileText size={14} aria-hidden="true" />
          {open ? "Hide Team & Sponsor Fact Sheet" : "Printable Team & Sponsor Fact Sheet"}
        </button>
      </div>

      {open && (
        <section
          aria-label="Printable Team and Sponsorship Fact Sheet"
          className="mt-4 rounded-2xl border-2 border-ares-gold/40 bg-black/80 p-6 sm:p-8 shadow-2xl print:border-black print:bg-white print:text-black"
        >
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5 mb-5 print:border-black/20">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-ares-gold print:text-black">
                FIRST® Tech Challenge #23247 • Morgantown, West Virginia
              </p>
              <h2 className="mt-1 font-heading text-2xl sm:text-3xl font-black uppercase text-white print:text-black">
                {siteConfig.team.fullName} — Sponsorship Fact Sheet
              </h2>
              <p className="mt-1 text-xs text-marble/75 print:text-black/80 max-w-2xl">
                Student-led competitive robotics, open STEM curriculum (ARES Academy), and
                transparent public financial stewardship.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5 rounded-xl border border-white/15 bg-white p-2 text-black print:border-black">
                <svg
                  role="img"
                  aria-label="QR code for ARES 23247 sponsorship page"
                  viewBox={`0 0 ${qrSize} ${qrSize}`}
                  className="h-14 w-14 shrink-0"
                >
                  <rect width={qrSize} height={qrSize} fill="#ffffff" />
                  <path d={qrPath} fill="#000000" />
                </svg>
                <div className="pr-1 text-left">
                  <span className="block text-[9px] font-black uppercase tracking-wider">
                    Partner Portal
                  </span>
                  <span className="block font-mono text-[10px] font-bold">
                    aresfirst.org/sponsors
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => window.print()}
                className="clipped-button bg-ares-red text-white text-xs uppercase font-black inline-flex items-center gap-2 cursor-pointer print:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                <Printer size={14} aria-hidden="true" /> Print Fact Sheet
              </button>
            </div>
          </div>

          {loading ? (
            <p role="status" className="text-xs font-bold text-ares-gold py-4">
              Loading live verified outreach, season, and award records…
            </p>
          ) : error ? (
            <div
              role="alert"
              className="rounded-lg border border-ares-red/40 bg-ares-red/10 p-3 text-xs text-ares-red-light flex items-center gap-2"
            >
              <AlertCircle size={14} aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : (
            impact && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 print:border-black/25">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-ares-gold print:text-black">
                    Published Partners
                  </span>
                  <span className="mt-1 block font-heading text-xl font-black text-white print:text-black">
                    {publishedPartnerCount}
                  </span>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 print:border-black/25">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-ares-gold print:text-black">
                    Outreach Hours
                  </span>
                  <span className="mt-1 block font-heading text-xl font-black text-white print:text-black">
                    {impact.outreachHours}
                  </span>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 print:border-black/25">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-ares-gold print:text-black">
                    Community Reached
                  </span>
                  <span className="mt-1 block font-heading text-xl font-black text-white print:text-black">
                    {impact.peopleReached}
                  </span>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 print:border-black/25">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-ares-gold print:text-black">
                    Outreach Events
                  </span>
                  <span className="mt-1 block font-heading text-xl font-black text-white print:text-black">
                    {impact.outreachEvents}
                  </span>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 print:border-black/25">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-ares-gold print:text-black">
                    Recorded Awards
                  </span>
                  <span className="mt-1 block font-heading text-xl font-black text-white print:text-black">
                    {impact.publishedAwards}
                  </span>
                </div>
              </div>
            )
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs leading-relaxed text-marble/85 print:text-black">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 print:border-black/25">
              <h3 className="font-black uppercase tracking-wider text-white print:text-black mb-1">
                Where Sponsor Support Goes
              </h3>
              <p>
                100% of team contributions fund CNC/3D-printed robot hardware, REV &amp; goBILDA
                control electronics, tournament registration fees, and free West Virginia youth
                STEM outreach workshops. Public ledger available at{" "}
                <span className="font-mono font-bold">aresfirst.org/finance</span>.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 print:border-black/25">
              <h3 className="font-black uppercase tracking-wider text-white print:text-black mb-1">
                Partner Recognition &amp; Contact
              </h3>
              <p>
                Partners are recognized across competition pit banners, robot chassis plates, team
                apparel, and our public digital showcase. Submit an inquiry on{" "}
                <span className="font-mono font-bold">aresfirst.org/sponsors</span> for current
                fiscal sponsorship and receipt details.
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
