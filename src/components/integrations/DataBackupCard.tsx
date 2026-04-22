import { useState } from "react";
import { Database, Download } from "lucide-react";
import { adminApi } from "../../api/adminApi";

export function DataBackupCard() {
  const [isExporting, setIsExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleExport = async () => {
    setIsExporting(true);
    setErrorMsg("");
    try {
      const blob = await adminApi.downloadFile("/api/admin/backup");
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ARES_Backup_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to export database backup.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-ares-black border border-ares-gray-dark p-6 flex flex-col gap-6 relative shadow-xl ares-cut-sm">
      {/* Decorative Brand Accent */}
      <div className="absolute top-0 right-0 w-16 h-1 bg-ares-gold" />
      
      <div className="flex items-start gap-4">
        <div className="p-3 bg-obsidian border border-ares-gray-dark/50 ares-cut-sm shadow-inner group-hover:bg-ares-gray-dark transition-colors shrink-0">
          <Database size={24} className="text-ares-offwhite/70 group-hover:text-ares-gold transition-colors" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white tracking-wide uppercase">Data Management & Backup</h3>
          <p className="text-ares-gray text-sm mt-1 leading-relaxed">
            Generate and download a full JSON snapshot of your Cloudflare D1 database. Protect against critical data loss by exporting regularly.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="text-xs text-ares-red font-mono py-1 px-2 bg-ares-red/10 border border-ares-red/30">
          ! ERROR: {errorMsg}
        </div>
      )}

      <div className="mt-auto flex justify-end gap-3 pt-4 border-t border-white/5">
        <button
          onClick={handleExport}
          disabled={isExporting}
          className={`flex items-center gap-2 px-6 py-2.5 ares-cut-sm font-bold transition-all disabled:opacity-50
              bg-ares-gold/10 text-ares-gold hover:bg-ares-gold hover:text-black hover:scale-105 border border-ares-gold/30 shadow-lg focus:outline-none focus:ring-2 focus:ring-ares-gold`}
        >
          {isExporting ? (
             <div className="w-4 h-4 border-2 border-ares-gold border-t-current rounded-full animate-spin"></div>
          ) : (
             <Download size={18} />
          )}
          {isExporting ? "GENERATING..." : "EXPORT JSON BACKUP"}
        </button>
      </div>
    </div>
  );
}
