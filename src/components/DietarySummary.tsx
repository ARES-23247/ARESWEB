/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import { Utensils, Shirt, RefreshCw, AlertCircle, Users, Mail, Copy, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../api/client";

interface LogisticsData {
  dietary: Record<string, number>;
  tshirts: Record<string, number>;
  totalCount: number;
}

import DashboardPageHeader from "./dashboard/DashboardPageHeader";
import DashboardEmptyState from "./dashboard/DashboardEmptyState";

export default function DietarySummary() {
  const [data, setData] = useState<LogisticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportedEmails, setExportedEmails] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const handleExportEmails = async () => {
    setExporting(true);
    try {
      const res = await api.logistics.exportEmails.query();
      if (res.status === 200) {
        setExportedEmails((res.body as any).emails.join(", "));
        setShowExportModal(true);
      } else {
        alert("Failed to export emails");
      }
    } catch {
      alert("Error exporting emails");
    } finally {
      setExporting(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(exportedEmails);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    api.logistics.getSummary.query()
      .then((res: any) => {
        if (res.status === 200) {
           
          setData(res.body as any);
        } else {
           
          setError((res.body as any)?.error || "Failed to load logistics summary");
        }
        setLoading(false);
      })
      .catch((err: any) => {
        console.error("Logistics fetch error:", err);
        setError(err.message || "Failed to load logistics summary");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <RefreshCw className="animate-spin text-ares-red" size={32} />
        <p className="text-ares-gray text-sm font-bold animate-pulse">Aggregating Team Data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 p-6 bg-ares-red text-white border border-ares-red/20 ares-cut font-bold shadow-lg shadow-ares-red/20">
        <AlertCircle size={24} />
        <div>
          <h4 className="font-bold">Summary Unavailable</h4>
          <p className="text-sm opacity-80">{error}</p>
        </div>
      </div>
    );
  }

  if (!data || data.totalCount === 0) {
    return (
      <DashboardEmptyState
        className="text-center py-12 border-2 border-dashed border-white/10 ares-cut-lg"
        icon={<Users size={48} />}
        message="No member profile data found yet."
      />
    );
  }

  return (
    <div className="space-y-6">
      <DashboardPageHeader 
        title="Team Logistics Summary" 
        subtitle="Aggregated dietary data for event planning and team management."
        icon={<Utensils className="text-ares-gold" />}
        action={
          <button
            onClick={handleExportEmails}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-obsidian border border-white/10 hover:border-ares-red/50 hover:bg-ares-red/10 text-white font-bold ares-cut-sm transition-colors text-sm uppercase tracking-widest disabled:opacity-50"
          >
            {exporting ? <RefreshCw size={16} className="animate-spin" /> : <Mail size={16} />}
            {exporting ? "Exporting..." : "Export Roster Emails"}
          </button>
        }
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Dietary Panel */}
      <div className="bg-obsidian/50 border border-ares-gray-dark ares-cut p-6 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity pointer-events-none">
          <Utensils size={120} />
        </div>
        <h3 className="text-ares-red font-black uppercase tracking-wider text-sm flex items-center gap-2 mb-6">
          <Utensils size={18} /> Dietary Summary
        </h3>
        
        <div className="space-y-4 relative z-10">
          {Object.keys(data.dietary).length === 0 ? (
            <p className="text-ares-gray text-sm italic">No restrictions reported.</p>
          ) : (
            Object.entries(data.dietary)
              .sort((a,b) => b[1] - a[1])
              .map(([label, count]) => (
                <div key={label} className="space-y-1.5">
                  <div className="flex justify-between text-sm font-bold">
                    <span className="text-white">{label}</span>
                    <span className="text-ares-red">{count}</span>
                  </div>
                  <div className="h-1.5 w-full bg-ares-gray-dark rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(count / data.totalCount) * 100}%` }}
                      className="h-full bg-ares-red shadow-[0_0_10px_rgba(220,38,38,0.5)]"
                    />
                  </div>
                </div>
              ))
          )}
        </div>
      </div>

      {/* Apparel Panel */}
      <div className="bg-obsidian/50 border border-ares-gray-dark ares-cut p-6 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity pointer-events-none">
          <Shirt size={120} />
        </div>
        <h3 className="text-ares-gold font-black uppercase tracking-wider text-sm flex items-center gap-2 mb-6">
          <Shirt size={18} /> Gear Sizes
        </h3>
        
        <div className="space-y-4 relative z-10">
          {Object.keys(data.tshirts).length === 0 ? (
            <p className="text-ares-gray text-sm italic">No sizes reported.</p>
          ) : (
            Object.entries(data.tshirts)
              .sort((a, b) => {
                const order = ["Youth Medium", "Youth Large", "Adult Small", "Adult Medium", "Adult Large", "Adult XL", "Adult 2XL", "Adult 3XL"];
                return order.indexOf(a[0]) - order.indexOf(b[0]);
              })
              .map(([label, count]) => (
                <div key={label} className="space-y-1.5">
                  <div className="flex justify-between text-sm font-bold">
                    <span className="text-white">{label}</span>
                    <span className="text-ares-gold">{count}</span>
                  </div>
                  <div className="h-1.5 w-full bg-ares-gray-dark rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(count / data.totalCount) * 100}%` }}
                      className="h-full bg-ares-gold shadow-[0_0_10px_rgba(192,152,0,0.5)]"
                    />
                  </div>
                </div>
              ))
          )}
        </div>
      </div>

      <div className="md:col-span-2 flex justify-center pt-2">
        <div className="px-4 py-1.5 bg-white/5 border border-white/10 ares-cut-sm text-xs font-bold text-ares-gray uppercase tracking-widest">
          Based on {data.totalCount} active member profiles
        </div>
      </div>
    </div>

    {/* Export Modal */}
    <AnimatePresence>
      {showExportModal && (
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <motion.div 
            initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
            className="bg-obsidian border border-white/10 p-6 max-w-2xl w-full ares-cut-lg relative shadow-2xl"
          >
            <button 
              onClick={() => setShowExportModal(false)}
              className="absolute top-4 right-4 text-marble/50 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
            <h2 className="text-xl font-black text-white flex items-center gap-2 uppercase tracking-widest mb-2">
              <Mail className="text-ares-red" size={20} /> Active Roster Emails
            </h2>
            <p className="text-sm text-marble/70 mb-6">Comma-separated list ready to paste into BCC.</p>
            
            <div className="relative mb-6">
              <textarea 
                readOnly
                value={exportedEmails}
                className="w-full h-48 bg-black/50 border border-white/10 p-4 font-mono text-sm text-white resize-none focus:outline-none focus:border-ares-red/50 ares-cut-sm"
              />
              <button
                onClick={handleCopy}
                className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1.5 bg-ares-red hover:bg-red-600 text-white font-bold text-xs uppercase tracking-widest ares-cut-sm transition-colors"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            
            <div className="flex justify-end">
              <button 
                onClick={() => setShowExportModal(false)}
                className="px-6 py-2 border border-white/20 hover:bg-white/5 text-white font-bold ares-cut-sm transition-colors uppercase tracking-widest text-sm"
              >
                Done
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    </div>
  );
}
