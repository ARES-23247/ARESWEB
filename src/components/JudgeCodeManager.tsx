
import { useState } from "react";
import { Plus, ShieldCheck, Trash2, RefreshCw, Calendar, Copy, ExternalLink } from "lucide-react";
import { useGetJudgeCodes, useCreateJudgeCode, useDeleteJudgeCode, type JudgeCode } from "../api";
import DashboardPageHeader from "./dashboard/DashboardPageHeader";
import { toast } from "sonner";
import { toastApiError } from "../api/honoClient";

interface JudgeCodeRowProps {
  code: JudgeCode;
  onCopy: (text: string) => void;
}

function JudgeCodeRow({ code: c, onCopy }: JudgeCodeRowProps) {
  const deleteMutation = useDeleteJudgeCode();
  const isExpired = c.expiresAt && new Date(c.expiresAt) < new Date();
  const isPending = deleteMutation.isPending;

  return (
    <tr className={`hover:bg-white/[0.04] transition-all group ${isExpired ? "opacity-30 grayscale" : ""} ${isPending ? "opacity-50 grayscale bg-ares-red/5" : ""}`}>
      <td className="px-8 py-5 relative">
        <div className="absolute top-0 left-0 w-1 h-0 bg-ares-cyan group-hover:h-full transition-all duration-300"></div>
        <p className="text-white font-black uppercase tracking-wider text-sm">{c.label || "UNTITLED_NODE"}</p>
        <p className="text-[9px] text-marble/20 font-black uppercase tracking-[0.2em] mt-1 italic">INITIALIZED: {new Date(c.createdAt).toLocaleDateString()}</p>
      </td>
      <td className="px-8 py-5">
        <div className="flex items-center gap-3">
          <code className="bg-black/60 px-4 py-2 ares-cut-sm border border-white/10 text-ares-cyan font-black tracking-[0.3em] text-sm shadow-inner">
            {c.code}
          </code>
          <button 
            onClick={() => onCopy(c.code)}
            className="p-2 text-marble/20 hover:text-white transition-all bg-white/5 hover:bg-white/10 ares-cut-sm border border-white/5"
            title="Copy Code"
          >
            <Copy size={14} />
          </button>
        </div>
      </td>
      <td className="px-8 py-5">
        {c.expiresAt ? (
          <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${isExpired ? "text-ares-red animate-pulse" : "text-marble/40"}`}>
            <Calendar size={12} className={isExpired ? "text-ares-red" : "text-white/20"} />
            {isExpired ? "DECOMMISSIONED" : new Date(c.expiresAt).toLocaleDateString()}
          </div>
        ) : (
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-ares-cyan bg-ares-cyan/5 px-3 py-1 ares-cut-sm border border-ares-cyan/10">PERMANENT_ACCESS</span>
        )}
      </td>
      <td className="px-8 py-5">
        <div className="flex items-center gap-3">
          <a 
            href={`/judges?code=${c.code}`} 
            target="_blank" 
            rel="noreferrer"
            className="p-3 bg-white/5 hover:bg-ares-cyan text-marble/40 hover:text-black ares-cut-sm border border-white/5 hover:border-ares-cyan transition-all duration-300"
            title="Test as Judge"
          >
            <ExternalLink size={16} />
          </a>
          <button
            onClick={() => {
              if (confirm("Are you sure you want to revoke this access code?")) {
                deleteMutation.mutate(c.id, {
                  onSuccess: () => toast.success("Access code revoked")
                });
              }
            }}
            disabled={isPending}
            className={`p-3 bg-white/5 hover:bg-ares-red text-marble/40 hover:text-white ares-cut-sm border border-white/5 hover:border-ares-red transition-all duration-300 ${isPending ? 'animate-pulse' : ''}`}
            title="Revoke Access"
          >
            {isPending ? <RefreshCw size={16} className="animate-spin" /> : <Trash2 size={16} />}
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function JudgeCodeManager() {
  const [label, setLabel] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const { data: codesRes, isLoading, isError } = useGetJudgeCodes();
  const codes = codesRes?.codes || [];

  const createMutation = useCreateJudgeCode({
    onSuccess: () => {
      setLabel("");
      setExpiresAt("");
      toast.success("Judge access code generated");
    },
    onError: (err: unknown) => {
      toastApiError(err);
    }
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Code copied to clipboard");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="animate-spin text-ares-cyan" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <DashboardPageHeader 
        title="Judge Access" 
        subtitle="Manage secure access codes for judge portfolio review."
        icon={<ShieldCheck className="text-ares-cyan" />}
      />

      {isError && (
        <div className="bg-ares-red/10 border border-ares-red/30 p-4 ares-cut-sm text-ares-red text-xs font-bold mb-6 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-ares-red animate-pulse" />
          TELEMETRY FAULT: Failed to synchronize judge access codes.
        </div>
      )}

      {/* Generate Action */}
      <div className="bg-black/40 border border-white/5 ares-cut-lg p-10 backdrop-blur-sm relative group overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-0 bg-ares-cyan group-hover:h-full transition-all duration-700"></div>
        <h3 className="text-2xl font-black text-white mb-8 uppercase tracking-tighter flex items-center gap-3">
          <Plus size={28} className="text-ares-cyan" /> INITIALIZE_ACCESS_NODE
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-2">
            <label htmlFor="judge-code-label" className="text-[10px] font-black uppercase tracking-[0.2em] text-marble/40 ml-1">LABEL_EVENT_IDENTIFIER</label>
            <input 
              id="judge-code-label"
              type="text"
              placeholder="E.G. CHAMPIONSHIP_2026"
              className="w-full bg-black/60 border border-white/10 ares-cut-sm px-5 py-4 text-xs font-black uppercase tracking-widest text-white focus:border-ares-cyan focus:outline-none placeholder:text-white/5"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="judge-code-expiry" className="text-[10px] font-black uppercase tracking-[0.2em] text-marble/40 ml-1">DECOMMISSION_DATETIME (OPTIONAL)</label>
            <div className="relative">
              <input 
                id="judge-code-expiry"
                type="datetime-local"
                className="w-full bg-black/60 border border-white/10 ares-cut-sm px-5 py-4 text-xs font-black uppercase tracking-widest text-white focus:border-ares-cyan focus:outline-none [color-scheme:dark]"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
              <Calendar className="absolute right-5 top-4 text-marble/20 pointer-events-none" size={18} />
            </div>
          </div>
          <div className="flex items-end">
            <button
              disabled={createMutation.isPending}
              onClick={() => createMutation.mutate({ label, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined })}
              className="w-full py-4 bg-ares-cyan/10 text-ares-cyan border border-ares-cyan/30 hover:bg-ares-cyan hover:text-black font-black uppercase tracking-[0.2em] text-[10px] ares-cut-sm transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg shadow-ares-cyan/5"
            >
              {createMutation.isPending ? <RefreshCw className="animate-spin" size={18} /> : <Plus size={18} />} 
              GENERATE_ENCRYPTION_KEY
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="bg-black/40 border border-white/5 ares-cut-lg overflow-hidden backdrop-blur-sm">
        {codes.length === 0 ? (
          <div className="p-16 text-center text-marble/20 font-black uppercase tracking-[0.4em] text-[10px] flex flex-col items-center justify-center">
            <ShieldCheck size={48} className="text-white/5 mb-4" />
            NO_ACCESS_NODES_ACTIVE
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-black/60 border-b border-white/10">
                <tr>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-marble/40">NODE_IDENTIFIER</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-marble/40">ENCRYPTION_KEY</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-marble/40">OPERATIONAL_STATUS</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-marble/40">COMMAND_OVERRIDE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {codes.map((c) => (
                  <JudgeCodeRow key={c.id} code={c} onCopy={copyToClipboard} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
