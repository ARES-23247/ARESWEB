import React, { useState, useMemo } from "react";
import { X, Printer, Download, Award, FileSpreadsheet, CheckCircle2, Users, Clock, Calendar, MapPin } from "lucide-react";
import { OutreachLog } from "./OutreachLogsList";

interface OutreachPortfolioExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: OutreachLog[];
}

export default function OutreachPortfolioExportModal({
  isOpen,
  onClose,
  logs,
}: OutreachPortfolioExportModalProps) {
  const [activeTab, setActiveTab] = useState<"portfolio" | "csv" | "certificate">("portfolio");
  const [studentName, setStudentName] = useState("");
  const [certifiedHours, setCertifiedHours] = useState("");

  const activeLogs = useMemo(() => {
    return logs.filter((log) => log.isDeleted !== 1);
  }, [logs]);

  const stats = useMemo(() => {
    const totalHours = activeLogs.reduce((acc, log) => acc + (Number(log.hours) || 0), 0);
    const totalReached = activeLogs.reduce((acc, log) => acc + (Number(log.peopleReached) || 0), 0);
    const totalEvents = activeLogs.length;
    const avgReach = totalEvents > 0 ? Math.round(totalReached / totalEvents) : 0;

    return { totalHours, totalReached, totalEvents, avgReach };
  }, [activeLogs]);

  const handleDownloadCsv = () => {
    const headers = ["Title", "Date", "Location", "Volunteer Hours", "People Reached", "Impact Summary"];
    const rows = activeLogs.map((log) => [
      `"${(log.title || "").replace(/"/g, '""')}"`,
      `"${log.date || ""}"`,
      `"${(log.location || "").replace(/"/g, '""')}"`,
      log.hours || 0,
      log.peopleReached || 0,
      `"${(log.impactSummary || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ARES-23247-Outreach-Portfolio-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="portfolio-export-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
    >
      <div className="bg-obsidian border border-white/15 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden print:border-none print:shadow-none print:max-w-none print:w-full print:bg-white print:text-black">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-zinc-900/60 print:hidden">
          <div className="flex items-center gap-2.5">
            <Award className="text-ares-gold" size={20} />
            <h3 id="portfolio-export-title" className="text-base font-bold text-white uppercase tracking-wider">
              FIRST Award &amp; Outreach Impact Portfolio
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-marble/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
              aria-label="Close export dialog"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 py-2 border-b border-white/10 bg-black/30 flex items-center gap-4 print:hidden">
          <button
            type="button"
            onClick={() => setActiveTab("portfolio")}
            className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1.5 transition-all ${
              activeTab === "portfolio"
                ? "bg-ares-gold/20 text-ares-gold border border-ares-gold/40"
                : "text-marble/60 hover:text-white"
            }`}
          >
            <Award size={14} />
            <span>Judge Portfolio Sheet</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("csv")}
            className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1.5 transition-all ${
              activeTab === "csv"
                ? "bg-ares-cyan/20 text-ares-cyan border border-ares-cyan/40"
                : "text-marble/60 hover:text-white"
            }`}
          >
            <FileSpreadsheet size={14} />
            <span>CSV Data Export</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("certificate")}
            className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1.5 transition-all ${
              activeTab === "certificate"
                ? "bg-ares-success/20 text-ares-success border border-ares-success/40"
                : "text-marble/60 hover:text-white"
            }`}
          >
            <CheckCircle2 size={14} />
            <span>Volunteer Certificate</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 print:p-0 print:space-y-4">
          {activeTab === "portfolio" && (
            <div className="space-y-6 print:text-black">
              {/* Printable Header */}
              <div className="border-b border-white/10 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:border-black/20">
                <div>
                  <span className="text-xs font-extrabold text-ares-gold uppercase tracking-widest block print:text-amber-700">
                    FIRST® Tech Challenge Team 23247
                  </span>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tight print:text-black">
                    Outreach &amp; Community Impact Portfolio
                  </h2>
                  <p className="text-xs text-marble/60 print:text-gray-600 mt-0.5">
                    Appalachian Robotics &amp; Engineering Society • Morgantown, West Virginia
                  </p>
                </div>
                <div className="text-right text-xs font-mono text-marble/50 print:text-gray-500">
                  <span>Season 2025–2026</span>
                  <br />
                  <span>Report Date: {new Date().toLocaleDateString()}</span>
                </div>
              </div>

              {/* High-Level Impact Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:grid-cols-4">
                <div className="p-4 rounded-lg bg-white/5 border border-white/10 print:border-gray-300 print:bg-gray-50 text-center">
                  <Clock className="mx-auto text-ares-gold mb-1 print:text-amber-700" size={18} />
                  <span className="text-2xl font-black text-white print:text-black block">{stats.totalHours}</span>
                  <span className="text-[10px] text-marble/60 print:text-gray-600 uppercase tracking-wider font-bold">Total Volunteer Hours</span>
                </div>

                <div className="p-4 rounded-lg bg-white/5 border border-white/10 print:border-gray-300 print:bg-gray-50 text-center">
                  <Users className="mx-auto text-ares-cyan mb-1 print:text-cyan-700" size={18} />
                  <span className="text-2xl font-black text-white print:text-black block">{stats.totalReached.toLocaleString()}</span>
                  <span className="text-[10px] text-marble/60 print:text-gray-600 uppercase tracking-wider font-bold">Direct Audience Reach</span>
                </div>

                <div className="p-4 rounded-lg bg-white/5 border border-white/10 print:border-gray-300 print:bg-gray-50 text-center">
                  <Calendar className="mx-auto text-ares-gold mb-1 print:text-amber-700" size={18} />
                  <span className="text-2xl font-black text-white print:text-black block">{stats.totalEvents}</span>
                  <span className="text-[10px] text-marble/60 print:text-gray-600 uppercase tracking-wider font-bold">Community Events</span>
                </div>

                <div className="p-4 rounded-lg bg-white/5 border border-white/10 print:border-gray-300 print:bg-gray-50 text-center">
                  <Award className="mx-auto text-ares-success mb-1 print:text-emerald-700" size={18} />
                  <span className="text-2xl font-black text-white print:text-black block">{stats.avgReach}</span>
                  <span className="text-[10px] text-marble/60 print:text-gray-600 uppercase tracking-wider font-bold">Avg Reach / Event</span>
                </div>
              </div>

              {/* Event Logs List */}
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3 print:text-black">
                  Documented Outreach Events ({activeLogs.length})
                </h4>
                <div className="space-y-3">
                  {activeLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3.5 rounded-lg bg-black/30 border border-white/10 print:border-gray-300 print:bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <strong className="text-white print:text-black font-bold text-sm">{log.title}</strong>
                          <span className="text-[10px] text-ares-gold font-mono print:text-amber-700">{log.date}</span>
                        </div>
                        {log.location && (
                          <span className="text-marble/60 print:text-gray-600 flex items-center gap-1 text-[11px]">
                            <MapPin size={11} /> {log.location}
                          </span>
                        )}
                        {log.impactSummary && (
                          <p className="text-marble/80 print:text-gray-700 text-xs italic mt-1 leading-relaxed">
                            &quot;{log.impactSummary}&quot;
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-4 shrink-0 font-mono text-[11px]">
                        <span className="text-marble/80 print:text-gray-700"><strong>{log.hours}</strong> hrs</span>
                        <span className="text-ares-cyan print:text-cyan-800"><strong>{log.peopleReached}</strong> reached</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "csv" && (
            <div className="space-y-4">
              <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Spreadsheet Export</h4>
                <p className="text-xs text-marble/60 mb-4">
                  Export all {activeLogs.length} verified outreach logs in standard CSV format for the FIRST Impact Award binder and spreadsheet archiving.
                </p>
                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  className="px-5 py-2.5 bg-ares-cyan/20 hover:bg-ares-cyan/30 border border-ares-cyan/50 text-ares-cyan rounded text-xs font-bold uppercase ares-cut-sm flex items-center gap-2 transition-all cursor-pointer shadow-[0_0_15px_rgba(0,240,255,0.15)]"
                >
                  <Download size={15} />
                  <span>Download CSV ({activeLogs.length} records)</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === "certificate" && (
            <div className="space-y-6">
              <div className="p-4 bg-white/5 border border-white/10 rounded-lg space-y-4 print:hidden">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">Volunteer Hour Verification</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-marble/70 uppercase mb-1">Student Name</label>
                    <input
                      type="text"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      placeholder="e.g. Alex Morgan"
                      className="w-full px-3 py-2 bg-black/40 border border-white/15 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-ares-gold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-marble/70 uppercase mb-1">Verified Hours</label>
                    <input
                      type="number"
                      value={certifiedHours}
                      onChange={(e) => setCertifiedHours(e.target.value)}
                      placeholder={`Total available: ${stats.totalHours}`}
                      className="w-full px-3 py-2 bg-black/40 border border-white/15 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-ares-gold"
                    />
                  </div>
                </div>
              </div>

              {/* Certificate Template */}
              <div className="p-8 rounded-xl border-2 border-ares-gold/60 bg-gradient-to-b from-black/50 to-zinc-950/80 print:border-black print:bg-white print:text-black text-center space-y-4">
                <div className="w-10 h-10 rounded-full border-2 border-ares-gold flex items-center justify-center mx-auto text-ares-gold font-bold">
                  <Award size={20} />
                </div>
                <span className="text-xs font-black uppercase tracking-widest text-ares-gold block print:text-amber-800">
                  Certificate of STEM Community Service
                </span>
                <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white print:text-black">
                  Appalachian Robotics &amp; Engineering Society
                </h3>
                <p className="text-xs text-marble/80 print:text-gray-700 max-w-lg mx-auto leading-relaxed">
                  This certifies that <strong className="text-white print:text-black text-sm">{studentName || "[Student Name]"}</strong> has completed{" "}
                  <strong className="text-ares-gold print:text-black text-sm">{certifiedHours || stats.totalHours} verified volunteer hours</strong> in FIRST® Tech Challenge robotics outreach, Morgantown STEM workshops, and community education during the 2025–2026 season.
                </p>
                <div className="pt-6 border-t border-white/10 print:border-black/20 flex items-center justify-between text-[11px] text-marble/60 print:text-gray-600 max-w-md mx-auto">
                  <span>Authorized Lead Mentor Signature</span>
                  <span>Date: {new Date().toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3 border-t border-white/10 flex items-center justify-between bg-zinc-900/60 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded text-marble/80 hover:text-white hover:bg-white/10 text-xs font-bold uppercase ares-cut-sm transition-all"
          >
            Close
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2 bg-ares-gold/20 hover:bg-ares-gold/30 border border-ares-gold/50 text-ares-gold rounded text-xs font-bold uppercase ares-cut-sm flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(229,168,35,0.2)] cursor-pointer"
          >
            <Printer size={14} />
            <span>Print / Save PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
}
