import {
  AlertCircle,
  CheckCircle2,
  Database,
  Shield,
  Terminal,
  UploadCloud,
  XCircle,
  Zap,
} from "lucide-react";

interface DashboardServiceStatusCardProps {
  databaseState: "connecting" | "connected" | "error";
  canUseAi: boolean;
  appCheckActive: boolean;
  isSignedIn: boolean;
}

export default function DashboardServiceStatusCard({
  databaseState,
  canUseAi,
  appCheckActive,
  isSignedIn,
}: DashboardServiceStatusCardProps) {
  return (
    <div className="glass-card p-6 border border-white/10">
      <h3 className="text-base font-bold border-b border-white/5 pb-3 text-ares-gold flex items-center gap-2 font-heading uppercase tracking-tight mb-4">
        <Terminal size={16} /> Portal Service Configuration
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="flex items-center justify-between p-3 bg-black/25 border border-white/5 rounded-xl">
          <div className="flex items-center gap-2.5">
            <Database size={14} className="text-ares-cyan" />
            <span className="font-semibold text-marble">
              Firestore Synchronization
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-bold uppercase text-[10px]">
            {databaseState === "connected" ? (
              <>
                <CheckCircle2 size={12} className="text-ares-success" />
                <span className="text-ares-success">Connected</span>
              </>
            ) : databaseState === "error" ? (
              <>
                <XCircle size={12} className="text-ares-danger" />
                <span className="text-ares-danger">Unavailable</span>
              </>
            ) : (
              <>
                <AlertCircle
                  size={12}
                  className="text-ares-gold animate-pulse"
                />
                <span className="text-ares-gold">Syncing...</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between p-3 bg-black/25 border border-white/5 rounded-xl">
          <div className="flex items-center gap-2.5">
            <Zap size={14} className="text-ares-gold" />
            <span className="font-semibold text-marble">
              Gemini AI Copilot
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-bold uppercase text-[10px]">
            {canUseAi ? (
              <>
                <CheckCircle2 size={12} className="text-ares-success" />
                <span className="text-ares-success">Role eligible</span>
              </>
            ) : (
              <>
                <XCircle size={12} className="text-marble/40" />
                <span className="text-marble/40">Role restricted</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between p-3 bg-black/25 border border-white/5 rounded-xl">
          <div className="flex items-center gap-2.5">
            <Shield size={14} className="text-ares-red" />
            <span className="font-semibold text-marble">
              App Check Protection
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-bold uppercase text-[10px]">
            {appCheckActive ? (
              <>
                <CheckCircle2 size={12} className="text-ares-success" />
                <span className="text-ares-success">Configured</span>
              </>
            ) : (
              <>
                <AlertCircle
                  size={12}
                  className="text-ares-gold animate-pulse"
                />
                <span className="text-ares-gold">Not configured</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between p-3 bg-black/25 border border-white/5 rounded-xl">
          <div className="flex items-center gap-2.5">
            <UploadCloud size={14} className="text-ares-success" />
            <span className="font-semibold text-marble">
              Authenticated Session
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-bold uppercase text-[10px]">
            {isSignedIn ? (
              <>
                <CheckCircle2 size={12} className="text-ares-success" />
                <span className="text-ares-success">Signed in</span>
              </>
            ) : (
              <>
                <XCircle size={12} className="text-ares-danger" />
                <span className="text-ares-danger">Signed out</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
