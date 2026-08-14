import { useMemo, useState } from "react";
import { Calendar, Clock, Download, FileSpreadsheet, MapPin, Printer, Users, X } from "lucide-react";
import AccessibleTabs, { tabElementId, tabPanelId } from "@/components/AccessibleTabs";
import { useFocusTrap } from "@/lib/useFocusTrap";
import {
  buildOutreachCsv,
  computeOutreachStats,
  currentSeasonLabel,
  outreachMetricValue,
} from "@/lib/outreachExport";
import type { OutreachLog } from "./OutreachLogsList";

interface OutreachPortfolioExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: OutreachLog[];
}

type ExportTab = "report" | "csv";
const EXPORT_TABS = [
  { value: "report", label: "Impact report" },
  { value: "csv", label: "CSV data export" },
] as const;

export default function OutreachPortfolioExportModal({
  isOpen,
  onClose,
  logs,
}: OutreachPortfolioExportModalProps) {
  const [activeTab, setActiveTab] = useState<ExportTab>("report");
  const dialogRef = useFocusTrap(isOpen, onClose);
  const stats = useMemo(() => computeOutreachStats(logs), [logs]);
  const reportDate = new Date();

  const handleDownloadCsv = () => {
    const blob = new Blob([buildOutreachCsv(logs)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ARES-23247-Outreach-Report-${reportDate.toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="outreach-report-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="outreach-report-print flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-white/15 bg-obsidian shadow-2xl print:max-h-none print:max-w-none print:border-none print:bg-white print:text-black print:shadow-none"
      >
        <header className="flex items-center justify-between gap-3 border-b border-white/10 bg-zinc-900/60 px-4 py-4 sm:px-6 print:hidden">
          <div>
            <h2 id="outreach-report-title" className="text-base font-bold uppercase tracking-wider text-white">
              Outreach impact report
            </h2>
            <p className="mt-1 text-xs text-marble/60">Review or export the currently recorded outreach data.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-marble/70 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close outreach report"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <AccessibleTabs
          id="outreach-export"
          label="Outreach export format"
          tabs={EXPORT_TABS}
          activeTab={activeTab}
          onChange={setActiveTab}
          className="flex gap-2 border-b border-white/10 bg-black/30 px-4 py-2 sm:px-6 print:hidden"
          tabClassName={(_tab, active) => `rounded px-3 py-2 text-xs font-bold transition-colors ${
            active
              ? "border border-ares-gold/40 bg-ares-gold/20 text-ares-gold"
              : "text-marble/70 hover:bg-white/5 hover:text-white"
          }`}
        />

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 print:overflow-visible print:p-0">
          {activeTab === "report" ? (
            <section
              id={tabPanelId("outreach-export", "report")}
              role="tabpanel"
              aria-labelledby={tabElementId("outreach-export", "report")}
              className="space-y-6 print:text-black"
            >
              <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-4 sm:flex-row sm:items-center print:border-black/20">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-widest text-ares-gold print:text-amber-700">
                    FIRST® Tech Challenge Team 23247
                  </p>
                  <h3 className="text-2xl font-black uppercase tracking-tight text-white print:text-black">
                    Outreach &amp; community impact report
                  </h3>
                  <p className="mt-1 text-xs text-marble/60 print:text-gray-600">
                    Appalachian Robotics &amp; Engineering Society • Morgantown, West Virginia
                  </p>
                </div>
                <p className="text-xs text-marble/60 sm:text-right print:text-gray-600">
                  Season {currentSeasonLabel(reportDate)}<br />Report date: {reportDate.toLocaleDateString()}
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 print:grid-cols-4">
                {[
                  { label: "Recorded volunteer hours", value: stats.totalHours, icon: Clock },
                  { label: "Recorded audience reach", value: stats.totalReached.toLocaleString(), icon: Users },
                  { label: "Active outreach events", value: stats.totalEvents, icon: Calendar },
                  { label: "Average reach per event", value: stats.averageReach, icon: Users },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="flex flex-col rounded-lg border border-white/10 bg-white/5 p-4 text-center print:border-gray-300 print:bg-gray-50">
                    <Icon className="mx-auto mb-1 text-ares-gold print:text-amber-700" size={18} aria-hidden="true" />
                    <dt className="order-2 text-[10px] font-bold uppercase tracking-wider text-marble/65 print:text-gray-600">{label}</dt>
                    <dd className="order-1 text-2xl font-black text-white print:text-black">{value}</dd>
                  </div>
                ))}
              </dl>

              <div>
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-white print:text-black">
                  Recorded outreach events ({stats.activeLogs.length})
                </h4>
                {stats.activeLogs.length === 0 ? (
                  <p className="rounded border border-white/10 p-4 text-sm text-marble/70 print:text-gray-700">
                    No active outreach records are available for this report.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {stats.activeLogs.map((log) => (
                      <article key={log.id} className="rounded-lg border border-white/10 bg-black/30 p-4 print:border-gray-300 print:bg-white">
                        <div className="flex flex-col justify-between gap-2 sm:flex-row">
                          <div>
                            <h5 className="font-bold text-white print:text-black">{log.title}</h5>
                            <p className="mt-1 flex flex-wrap gap-3 text-xs text-marble/65 print:text-gray-600">
                              <span>{log.date}</span>
                              {log.location && <span className="inline-flex items-center gap-1"><MapPin size={12} aria-hidden="true" />{log.location}</span>}
                            </p>
                          </div>
                          <p className="text-xs text-marble/80 print:text-gray-700">
                            {outreachMetricValue(log.hours)} hours • {outreachMetricValue(log.peopleReached)} reached
                          </p>
                        </div>
                        {log.impactSummary && <p className="mt-2 text-xs text-marble/80 print:text-gray-700">{log.impactSummary}</p>}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ) : (
            <section
              id={tabPanelId("outreach-export", "csv")}
              role="tabpanel"
              aria-labelledby={tabElementId("outreach-export", "csv")}
              className="rounded-lg border border-white/10 bg-white/5 p-5"
            >
              <FileSpreadsheet className="mb-3 text-ares-cyan" aria-hidden="true" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">Spreadsheet export</h3>
              <p className="mb-4 mt-2 text-xs text-marble/65">
                Download {stats.activeLogs.length} active outreach records as a formula-safe CSV file.
              </p>
              <button
                type="button"
                onClick={handleDownloadCsv}
                className="inline-flex items-center gap-2 rounded border border-ares-cyan/50 bg-ares-cyan/20 px-5 py-2.5 text-xs font-bold uppercase text-ares-cyan transition-colors hover:bg-ares-cyan/30"
              >
                <Download size={15} aria-hidden="true" />
                Download CSV
              </button>
            </section>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-white/10 bg-zinc-900/60 px-4 py-3 sm:px-6 print:hidden">
          <button type="button" onClick={onClose} className="rounded border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase text-marble/80 hover:bg-white/10 hover:text-white">
            Close
          </button>
          {activeTab === "report" && (
            <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded border border-ares-gold/50 bg-ares-gold/20 px-5 py-2 text-xs font-bold uppercase text-ares-gold hover:bg-ares-gold/30">
              <Printer size={14} aria-hidden="true" />
              Print / Save PDF
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
