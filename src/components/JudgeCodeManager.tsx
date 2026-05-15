
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
    <tr className={`hover:bg-white/[0.02] transition-all ${isExpired ? "opacity-40" : ""} ${isPending ? "opacity-50 grayscale bg-ares-red/5" : ""}`}>
      <td className="px-6 py-4">
        <p className="text-white font-bold">{c.label || "Untitled"}</p>
        <p className="text-[10px] text-marble/40 font-mono uppercase tracking-tighter">Created {new Date(c.createdAt).toLocaleDateString()}</p>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <code className="bg-black/60 px-3 py-1.5 ares-cut-sm border border-white/10 text-ares-cyan font-black tracking-widest text-sm">
            {c.code}
          </code>
          <button 
            onClick={() => onCopy(c.code)}
            className="p-1.5 text-marble/40 hover:text-white transition-colors"
            title="Copy Code"
          >
            <Copy size={14} />
          </button>
        </div>
      </td>
      <td className="px-6 py-4">
        {c.expiresAt ? (
          <div className={`flex items-center gap-1.5 text-xs font-bold ${isExpired ? "text-ares-red" : "text-marble/60"}`}>
            <Calendar size={12} />
            {new Date(c.expiresAt).toLocaleDateString()}
          </div>
        ) : (
          <span className="text-[10px] font-black uppercase tracking-widest text-ares-cyan/40">Permanent Access</span>
        )}
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <a 
            href={`/judges?code=${c.code}`} 
            target="_blank" 
            rel="noreferrer"
            className="p-2 bg-white/5 hover:bg-ares-cyan/20 text-marble/60 hover:text-ares-cyan ares-cut-sm border border-white/10 transition-all"
            title="Test as Judge"
          >
            <ExternalLink size={14} />
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
            className={`p-2 bg-white/5 hover:bg-ares-red/20 text-marble/60 hover:text-ares-red ares-cut-sm border border-white/10 transition-all ${isPending ? 'animate-pulse' : ''}`}
            title="Revoke Access"
          >
            {isPending ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
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
      <div className="bg-obsidian/50 border border-white/5 ares-cut-lg p-6">
        <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-widest flex items-center gap-2">
          <Plus size={16} className="text-ares-cyan" /> Create New Access Code
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label htmlFor="judge-code-label" className="text-[10px] font-black uppercase tracking-widest text-marble/60 ml-1">Label / Event Name</label>
            <input 
              id="judge-code-label"
              type="text"
              placeholder="e.g. Championship 2026"
              className="w-full bg-black border border-white/10 ares-cut-sm px-4 py-2.5 text-sm font-bold text-white focus:border-ares-cyan focus:outline-none"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="judge-code-expiry" className="text-[10px] font-black uppercase tracking-widest text-marble/60 ml-1">Expiration (Optional)</label>
            <div className="relative">
              <input 
                id="judge-code-expiry"
                type="datetime-local"
                className="w-full bg-black border border-white/10 ares-cut-sm px-4 py-2.5 text-sm font-bold text-white focus:border-ares-cyan focus:outline-none [color-scheme:dark]"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
              <Calendar className="absolute right-3 top-3 text-marble/30 pointer-events-none" size={16} />
            </div>
          </div>
          <div className="flex items-end">
            <button
              disabled={createMutation.isPending}
              onClick={() => createMutation.mutate({ label, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined })}
              className="w-full py-2.5 bg-ares-cyan hover:opacity-90 text-black font-black uppercase tracking-widest ares-cut-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {createMutation.isPending ? <RefreshCw className="animate-spin" size={16} /> : <Plus size={16} />} 
              Generate Code
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="bg-obsidian/50 border border-white/5 ares-cut-lg overflow-hidden">
        {codes.length === 0 ? (
          <div className="p-8 text-center text-white/60 font-bold uppercase tracking-widest text-xs">
            No judge access codes active.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-black/40 border-b border-white/5">
                <tr>
                  <th className="px-6 py-3 text-xs font-black uppercase tracking-widest text-white/60">Label</th>
                  <th className="px-6 py-3 text-xs font-black uppercase tracking-widest text-white/60">Access Code</th>
                  <th className="px-6 py-3 text-xs font-black uppercase tracking-widest text-white/60">Expires</th>
                  <th className="px-6 py-3 text-xs font-black uppercase tracking-widest text-white/60">Actions</th>
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
