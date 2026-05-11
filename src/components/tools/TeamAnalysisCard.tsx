import { useState, useEffect } from "react";
import { Sparkles, RefreshCw, Award, TrendingUp, TrendingDown, Target } from "lucide-react";
import DOMPurify from 'dompurify';
import { scoutingApi, type TOATeam, type TOARanking, type AnalysisResponse } from "../../lib/scouting-api";
import { logger } from "../../utils/logger";

interface TeamAnalysisCardProps {
  team: TOATeam;
  ranking?: TOARanking;
  seasonKey: string;
}

export default function TeamAnalysisCard({ team, ranking, seasonKey }: TeamAnalysisCardProps) {
  const [analysis, setAnalysis] = useState<AnalysisResponse & { createdAt?: string } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadHistory = async () => {
      try {
        const history = await scoutingApi.getSavedAnalyses({ teamNumber: team.team_number });
        if (mounted && history && history.length > 0) {
          const latest = history.find((a) => a.mode === "team_analysis");
          if (latest) {
            setAnalysis(latest);
          }
        }
      } catch (err) {
        logger.error("Failed to load analysis history:", err);
      } finally {
        if (mounted) setLoadingHistory(false);
      }
    };
    
    loadHistory();
    return () => { mounted = false; };
  }, [team.team_number]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const result = await scoutingApi.analyze({
        mode: "team_analysis",
        teamNumber: team.team_number,
        seasonKey,
        context: {
          team: {
            number: team.team_number,
            name: team.team_name_short || team.team_name_long,
            robotName: team.robot_name,
            city: team.city,
            state: team.state_prov,
            country: team.country,
            rookieYear: team.rookie_year,
          },
          ranking: ranking
            ? {
                rank: ranking.rank,
                opr: ranking.opr,
                npOpr: ranking.np_opr,
                wins: ranking.wins,
                losses: ranking.losses,
                ties: ranking.ties,
                highestQualScore: ranking.highest_qual_score,
                rankingPoints: ranking.ranking_points,
                qualifyingPoints: ranking.qualifying_points,
                played: ranking.played,
              }
            : null,
        },
      });
      setAnalysis(result);
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const statItems = ranking
    ? [
        { label: "Rank", value: `#${ranking.rank}`, icon: Award, color: "text-ares-gold" },
        { label: "OPR", value: ranking.opr?.toFixed(1) ?? "—", icon: TrendingUp, color: "text-ares-cyan" },
        { label: "NP-OPR", value: ranking.np_opr?.toFixed(1) ?? "—", icon: Target, color: "text-ares-cyan" },
        { label: "Record", value: `${ranking.wins}W-${ranking.losses}L-${ranking.ties}T`, icon: TrendingDown, color: "text-marble" },
        { label: "High Score", value: ranking.highest_qual_score?.toString() ?? "—", icon: Sparkles, color: "text-ares-gold" },
        { label: "RP", value: ranking.ranking_points?.toFixed(1) ?? "—", icon: Award, color: "text-ares-bronze" },
      ]
    : [];

  return (
    <div className="bg-obsidian border border-white/10 ares-cut overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-white/5 bg-gradient-to-r from-ares-red/5 to-transparent">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-black text-ares-gold tracking-tight">
                {team.team_number}
              </span>
              <span className="text-lg font-bold text-white tracking-tight">
                {team.team_name_short || team.team_name_long || "Unknown Team"}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              {team.city && (
                <span className="text-xs text-marble/60 font-semibold">
                  📍 {team.city}, {team.state_prov}{team.country && team.country !== "USA" ? `, ${team.country}` : ""}
                </span>
              )}
              {team.robot_name && (
                <span className="text-xs text-ares-cyan/60 font-semibold">
                  🤖 {team.robot_name}
                </span>
              )}
              {team.rookie_year && (
                <span className="text-xs text-marble/60 font-semibold">
                  Est. {team.rookie_year}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      {statItems.length > 0 && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-px bg-white/5">
          {statItems.map((stat) => (
            <div key={stat.label} className="bg-obsidian p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <stat.icon size={12} className={`${stat.color} opacity-60`} />
                <span className="text-[10px] font-black uppercase tracking-widest text-marble/50">
                  {stat.label}
                </span>
              </div>
              <span className={`text-sm font-bold ${stat.color}`}>{stat.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* AI Analysis Section */}
      <div className="p-4">
        {!analysis && !analyzing && !loadingHistory && (
          <button
            onClick={handleAnalyze}
            className="w-full flex items-center justify-center gap-2 py-3 bg-ares-cyan/10 border border-ares-cyan/30 text-ares-cyan hover:bg-ares-cyan/20 hover:border-ares-cyan/50 ares-cut-sm transition-all font-bold text-sm uppercase tracking-wider"
          >
            <Sparkles size={16} />
            Analyze with AI
          </button>
        )}

        {loadingHistory && !analysis && !analyzing && (
          <div className="flex justify-center py-4">
            <RefreshCw size={16} className="animate-spin text-marble/30" />
          </div>
        )}

        {analyzing && (
          <div className="flex items-center justify-center gap-3 py-6">
            <RefreshCw size={20} className="animate-spin text-ares-cyan/60" />
            <span className="text-sm font-bold text-marble/60 animate-pulse uppercase tracking-widest">
              Analyzing team...
            </span>
          </div>
        )}

        {analyzeError && (
          <div className="bg-ares-danger/10 border border-ares-danger/30 p-3 ares-cut-sm">
            <p className="text-sm text-ares-danger-soft font-semibold">{analyzeError}</p>
            <button
              onClick={handleAnalyze}
              className="mt-2 text-xs text-ares-cyan font-bold uppercase tracking-widest hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {analysis && (
          <div className="bg-black/30 border border-white/5 p-4 ares-cut-sm">
            <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-ares-cyan uppercase tracking-widest">
                  AI Analysis
                </span>
                {analysis.createdAt && (
                  <span className="text-[10px] text-marble/60 bg-white/5 px-2 py-0.5 rounded-full">
                    {new Date(analysis.createdAt).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-semibold text-marble/30">
                  {analysis.model} {analysis.tokensUsed ? `• ${analysis.tokensUsed} tokens` : ""}
                </span>
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="flex items-center gap-1 text-[10px] font-bold text-ares-cyan/70 hover:text-ares-cyan uppercase tracking-wider transition-colors disabled:opacity-50"
                  title="Regenerate Analysis"
                >
                  <RefreshCw size={12} className={analyzing ? "animate-spin" : ""} />
                  Regenerate
                </button>
              </div>
            </div>
            <div
              className="prose prose-invert prose-sm max-w-none text-marble/80 
                prose-headings:text-white prose-headings:font-bold prose-headings:tracking-tight
                prose-h2:text-base prose-h2:mt-4 prose-h2:mb-2
                prose-strong:text-ares-gold prose-strong:font-bold
                prose-li:text-marble/70 prose-li:marker:text-ares-cyan/50"
              dangerouslySetInnerHTML={{ __html: markdownToHtml(analysis.markdown) }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/** Minimal markdown → HTML converter for AI analysis responses */
function markdownToHtml(md: string): string {
  let html = md
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // Paragraphs (lines not already wrapped)
    .replace(/^(?!<[hlu]|<li)(.+)$/gm, '<p>$1</p>');

  // Wrap consecutive <li> in <ul>
  // eslint-disable-next-line security/detect-unsafe-regex
  html = html.replace(/(<li>.*?<\/li>\n?)+/gs, (match) => `<ul>${match}</ul>`);

  // Sanitize HTML to prevent XSS attacks
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['h1', 'h2', 'h3', 'strong', 'em', 'p', 'ul', 'li'],
    ALLOWED_ATTR: ['class']
  });
}

