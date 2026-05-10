
import { useState } from "react";
import { Plus, FileKey2, ExternalLink, RefreshCw } from "lucide-react";
import { useGetAdminSponsors, useGetAdminTokens, useGenerateSponsorToken } from "../api";
import { useQueryClient } from "@tanstack/react-query";
import DashboardPageHeader from "./dashboard/DashboardPageHeader";
import { toast } from "sonner";

export default function SponsorTokensManager() {
  const queryClient = useQueryClient();
  const [selectedSponsor, setSelectedSponsor] = useState("");

  const { data: sponsorsRes, isLoading: loadingSponsors, isError: isSponsorsError } = useGetAdminSponsors();
  const sponsors = sponsorsRes?.sponsors || [];

  const { data: tokensRes, isLoading: loadingTokens, isError: isTokensError } = useGetAdminTokens();
  const tokens = (tokensRes?.tokens || []) as any[];

  const generateMutation = useGenerateSponsorToken({
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ["sponsor_tokens"] });
        setSelectedSponsor("");
        toast.success("Magic link generated");
      } else {
        toast.error("Generation failed");
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || "Generation failed");
    }
  });

  const isLoading = loadingSponsors || loadingTokens;
  const isError = isSponsorsError || isTokensError;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="animate-spin text-ares-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <DashboardPageHeader 
        title="ROI Links" 
        subtitle="Generate magic links for sponsors to view impact data."
        icon={<FileKey2 className="text-ares-gold" />}
      />

      {isError && (
        <div className="bg-ares-red/10 border border-ares-red/30 p-4 ares-cut-sm text-ares-red text-xs font-bold mb-6 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-ares-red animate-pulse" />
          TELEMETRY FAULT: Failed to synchronize ROI access tokens.
        </div>
      )}

      {/* Generate Action */}
      <div className="bg-obsidian/50 border border-white/5 ares-cut-lg p-6">
        <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-widest flex items-center gap-2">
          <FileKey2 size={16} className="text-ares-gold" /> Generate Magic Link
        </h3>
        <div className="flex flex-col sm:flex-row gap-4">
          <select 
            className="flex-1 bg-black border border-white/10 ares-cut-sm px-4 py-2.5 text-sm font-bold text-white focus:border-ares-gold focus:outline-none"
            value={selectedSponsor}
            onChange={(e) => setSelectedSponsor(e.target.value)}
            title="Select a sponsor to generate a magic link for"
          >
            <option value="" disabled>Select a Sponsor</option>
            {sponsors.map((s: { id: string; name: string }) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button
            disabled={!selectedSponsor || generateMutation.isPending}
            onClick={() => generateMutation.mutate({ sponsorId: selectedSponsor })}
            className="px-6 py-2.5 bg-ares-gold hover:opacity-90 text-black font-black uppercase tracking-widest ares-cut-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {generateMutation.isPending ? <RefreshCw className="animate-spin" size={16} /> : <Plus size={16} />} 
            Generate Link
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-obsidian/50 border border-white/5 ares-cut-lg overflow-hidden">
        {tokens.length === 0 ? (
          <div className="p-8 text-center text-white/60 font-bold uppercase tracking-widest text-xs">
            No access tokens generated yet.
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-black/40 border-b border-white/5">
              <tr>
                <th className="px-6 py-3 text-xs font-black uppercase tracking-widest text-white/60">Sponsor</th>
                <th className="px-6 py-3 text-xs font-black uppercase tracking-widest text-white/60">Magic URL</th>
                <th className="px-6 py-3 text-xs font-black uppercase tracking-widest text-white/60">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {tokens.map((t: any) => {
                const url = `${window.location.origin}/sponsors/roi/${t.token}`;
                return (
                  <tr key={t.token} className="hover:bg-white/[0.02]">
                    <td className="px-6 py-4">
                      <p className="text-white font-bold">{t.sponsorName}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <input readOnly value={url} aria-label="Magic link URL" className="bg-black text-xs text-white/60 font-mono px-3 py-1.5 ares-cut-sm border border-white/5 w-64 focus:outline-none" />
                        <a href={url} target="_blank" rel="noreferrer" title="Open magic link" className="text-ares-gold hover:text-white transition-colors">
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-white/60">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

