import { useState, useEffect } from "react";
import { Plus, FileKey2, ExternalLink, RefreshCw } from "lucide-react";

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
  const [tokens, setTokens] = useState<Token[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [selectedSponsor, setSelectedSponsor] = useState("");
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch available sponsors to pick from
      const sRes = await fetch("/api/sponsors/admin");
      if (sRes.ok) {
        const sData = await sRes.json() as { sponsors: Sponsor[] };
        setSponsors(sData.sponsors || []);
      }
      
      // Fetch generated tokens
      const tRes = await fetch("/api/sponsors/admin/tokens");
      if (tRes.ok) {
        const tData = await tRes.json() as { tokens: Token[] };
        setTokens(tData.tokens || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, []);



  const generateToken = async () => {
    if (!selectedSponsor) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/sponsors/admin/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sponsor_id: selectedSponsor }),
      });
      if (res.ok) {
        await fetchData();
        setSelectedSponsor("");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="animate-spin text-ares-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Generate Action */}
      <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-widest flex items-center gap-2">
          <FileKey2 size={16} className="text-ares-cyan" /> Generate Magic Link
        </h3>
        <div className="flex flex-col sm:flex-row gap-4">
          <select 
            className="flex-1 bg-black border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold text-white focus:border-ares-cyan focus:outline-none"
            value={selectedSponsor}
            onChange={(e) => setSelectedSponsor(e.target.value)}
          >
            <option value="" disabled>Select a Sponsor</option>
            {sponsors.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button
            disabled={!selectedSponsor || generating}
            onClick={generateToken}
            className="px-6 py-2.5 bg-ares-cyan hover:bg-cyan-500 text-black font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {generating ? <RefreshCw className="animate-spin" size={16} /> : <Plus size={16} />} 
            Generate Link
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-zinc-900/50 border border-white/5 rounded-2xl overflow-hidden">
        {tokens.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 font-bold uppercase tracking-widest text-xs">
            No access tokens generated yet.
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-black/40 border-b border-white/5">
              <tr>
                <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Sponsor</th>
                <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Magic URL</th>
                <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Created</th>
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
                        <input readOnly value={url} className="bg-black text-[10px] text-zinc-400 font-mono px-3 py-1.5 rounded-lg border border-white/5 w-64 focus:outline-none" />
                        <a href={url} target="_blank" rel="noreferrer" className="text-ares-cyan hover:text-white transition-colors">
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-zinc-500">
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
