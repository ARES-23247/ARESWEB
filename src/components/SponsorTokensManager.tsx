import { useState } from "react";
import { Plus, FileKey2, ExternalLink, RefreshCw } from "lucide-react";
import { adminApi } from "../api/adminApi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardPageHeader from "./dashboard/DashboardPageHeader";

interface Sponsor {
  id: string;
  name: string;
}

interface Token {
  token: string;
  sponsor_id: string;
  sponsor_name: string;
  created_at: string;
}

export default function SponsorTokensManager() {
  const queryClient = useQueryClient();
  const [selectedSponsor, setSelectedSponsor] = useState("");

  const { data: sponsorsData, isLoading: loadingSponsors, isError: isSponsorsError } = useQuery<{ sponsors: Sponsor[] }>({
    queryKey: ["admin_sponsors"],
    queryFn: async () => adminApi.get<{ sponsors: Sponsor[] }>("/api/sponsors/admin")
  });

  const { data: tokensData, isLoading: loadingTokens, isError: isTokensError } = useQuery<{ tokens: Token[] }>({
    queryKey: ["admin_sponsor_tokens"],
    queryFn: async () => adminApi.get<{ tokens: Token[] }>("/api/sponsors/admin/tokens")
  });

  const generateMutation = useMutation({
    mutationFn: async (sponsorId: string) => {
      return adminApi.request("/api/sponsors/admin/tokens", {
        method: "POST",
        body: JSON.stringify({ sponsor_id: sponsorId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_sponsor_tokens"] });
      setSelectedSponsor("");
    }
  });

  const sponsors = sponsorsData?.sponsors || [];
  const tokens = tokensData?.tokens || [];
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
      <div className="bg-obsidian/50 border border-white/5 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-widest flex items-center gap-2">
          <FileKey2 size={16} className="text-ares-gold" /> Generate Magic Link
        </h3>
        <div className="flex flex-col sm:flex-row gap-4">
          <select 
            className="flex-1 bg-black border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold text-white focus:border-ares-gold focus:outline-none"
            value={selectedSponsor}
            onChange={(e) => setSelectedSponsor(e.target.value)}
          >
            <option value="" disabled>Select a Sponsor</option>
            {sponsors.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button
            disabled={!selectedSponsor || generateMutation.isPending}
            onClick={() => generateMutation.mutate(selectedSponsor)}
            className="px-6 py-2.5 bg-ares-gold hover:opacity-90 text-black font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {generateMutation.isPending ? <RefreshCw className="animate-spin" size={16} /> : <Plus size={16} />} 
            Generate Link
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-obsidian/50 border border-white/5 rounded-2xl overflow-hidden">
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
              {tokens.map(t => {
                const url = `${window.location.origin}/sponsors/roi/${t.token}`;
                return (
                  <tr key={t.token} className="hover:bg-white/[0.02]">
                    <td className="px-6 py-4">
                      <p className="text-white font-bold">{t.sponsor_name}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <input readOnly value={url} className="bg-black text-xs text-white/60 font-mono px-3 py-1.5 rounded-lg border border-white/5 w-64 focus:outline-none" />
                        <a href={url} target="_blank" rel="noreferrer" className="text-ares-gold hover:text-white transition-colors">
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-white/60">
                      {new Date(t.created_at).toLocaleDateString()}
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
