import { useState, useCallback, useEffect } from "react";
import { Crosshair, Search, Globe, Sparkles, RefreshCw, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import DOMPurify from 'dompurify';
import { scoutingApi, type TOATeam, type TOARanking, type AnalysisResponse } from "../../lib/scouting-api";
import EventSelector from "./EventSelector";
import TeamAnalysisCard from "./TeamAnalysisCard";

type Tab = "team" | "event" | "analysis";

const SEASON_KEY = "25-26";

export default function ScoutingTool() {
  const [activeTab, setActiveTab] = useState<Tab>("team");

  // ── Team Search State ──
  const [teamSearch, setTeamSearch] = useState("");
  const [teamData, setTeamData] = useState<TOATeam | null>(null);
  const [teamRanking, setTeamRanking] = useState<TOARanking | undefined>(undefined);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);

  // ── Event Browser State ──
  const [selectedEventKey, setSelectedEventKey] = useState<string>("");
  const [selectedEventName, setSelectedEventName] = useState<string>("");
  const [eventRankings, setEventRankings] = useState<TOARanking[]>([]);
  const [eventTeams, setEventTeams] = useState<TOATeam[]>([]);
  const [eventLoading, setEventLoading] = useState(false);
  const [eventError, setEventError] = useState<string | null>(null);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  // ── Event Analysis State ──
  const [analysisEventKey, setAnalysisEventKey] = useState<string>("");
  const [analysisEventName, setAnalysisEventName] = useState<string>("");
  const [eventAnalysis, setEventAnalysis] = useState<AnalysisResponse & { created_at?: string } | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [loadingEventHistory, setLoadingEventHistory] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!analysisEventKey) {
      void Promise.resolve().then(() => {
        if (mounted) setEventAnalysis(null);
      });
      return;
    }

    const loadHistory = async () => {
      setLoadingEventHistory(true);
      try {
        const history = await scoutingApi.getSavedAnalyses({ eventKey: analysisEventKey });
        if (mounted && history && history.length > 0) {
          const latest = history.find((a) => a.mode === "event_overview");
          if (latest) {
            setEventAnalysis(latest);
          }
        }
      } catch (err) {
        console.error("Failed to load event analysis history:", err);
      } finally {
        if (mounted) setLoadingEventHistory(false);
      }
    };
    
    loadHistory();
    return () => { mounted = false; };
  }, [analysisEventKey]);

  // ── Team Search Handler ──
  const handleTeamSearch = useCallback(async () => {
    const num = parseInt(teamSearch, 10);
    if (isNaN(num) || num <= 0) {
      setTeamError("Please enter a valid team number.");
      return;
    }

    setTeamLoading(true);
    setTeamError(null);
    setTeamData(null);
    setTeamRanking(undefined);

    try {
      const team = await scoutingApi.getTeam(num);
      setTeamData(team);

      // Try to fetch ranking data from current season
      try {
        const results = await scoutingApi.getTeamResults(num, SEASON_KEY);
        // Results may contain ranking data — extract if available
        if (Array.isArray(results) && results.length > 0) {
          const firstResult = results[0] as Record<string, unknown>;
          if (firstResult.opr !== undefined) {
            setTeamRanking(firstResult as unknown as TOARanking);
          }
        }
      } catch {
        // Ranking data not available for this season — that's fine
      }
    } catch (err) {
      setTeamError(err instanceof Error ? err.message : "Team not found");
    } finally {
      setTeamLoading(false);
    }
  }, [teamSearch]);

  // ── Event Select Handler ──
  const handleEventSelect = useCallback(async (eventKey: string, eventName: string) => {
    setSelectedEventKey(eventKey);
    setSelectedEventName(eventName);
    setEventLoading(true);
    setEventError(null);
    setExpandedTeam(null);

    try {
      const [rankings, teams] = await Promise.all([
        scoutingApi.getEventRankings(eventKey),
        scoutingApi.getEventTeams(eventKey),
      ]);
      setEventRankings(Array.isArray(rankings) ? rankings : []);
      setEventTeams(Array.isArray(teams) ? teams : []);
    } catch (err) {
      setEventError(err instanceof Error ? err.message : "Failed to load event data");
    } finally {
      setEventLoading(false);
    }
  }, []);

  // ── Event Analysis Handler ──
  const handleEventAnalysis = useCallback(async () => {
    if (!analysisEventKey) return;

    setAnalysisLoading(true);
    setAnalysisError(null);
    setEventAnalysis(null);

    try {
      // Fetch event data for context
      const [rankings, teams] = await Promise.all([
        scoutingApi.getEventRankings(analysisEventKey),
        scoutingApi.getEventTeams(analysisEventKey),
      ]);

      const result = await scoutingApi.analyze({
        mode: "event_overview",
        eventKey: analysisEventKey,
        seasonKey: SEASON_KEY,
        context: {
          eventName: analysisEventName,
          eventKey: analysisEventKey,
          teamCount: Array.isArray(teams) ? teams.length : 0,
          rankings: Array.isArray(rankings) ? rankings.slice(0, 20) : [],
          teams: Array.isArray(teams) ? teams.slice(0, 30) : [],
        },
      });

      setEventAnalysis(result);
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalysisLoading(false);
    }
  }, [analysisEventKey, analysisEventName]);

  const tabs: { id: Tab; label: string; icon: typeof Search }[] = [
    { id: "team", label: "Team Search", icon: Search },
    { id: "event", label: "Event Browser", icon: Globe },
    { id: "analysis", label: "Event Analysis", icon: Sparkles },
  ];

  // Helper to find team data for a ranking row
  const getTeamForRanking = (teamKey: string) =>
    eventTeams.find((t) => t.team_key === teamKey);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 ares-cut bg-gradient-to-br from-ares-red to-red-900 border border-ares-danger/30 flex items-center justify-center shadow-[0_0_20px_rgba(192,0,0,0.2)]">
          <Crosshair size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            FTC SCOUT
          </h1>
          <p className="text-sm text-marble/50 font-semibold">
            AI-Powered Team Analysis & Match Predictions
          </p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-white/5 p-1 ares-cut-sm">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 ares-cut-sm text-sm font-bold uppercase tracking-wider transition-all ${
              activeTab === tab.id
                ? "bg-ares-red/20 text-white border border-ares-red/30 shadow-[0_0_15px_rgba(192,0,0,0.1)]"
                : "text-marble/60 hover:text-white hover:bg-white/5 border border-transparent"
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 1: Team Search
          ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === "team" && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-marble/60" />
              <input
                type="number"
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTeamSearch()}
                placeholder="Enter FTC team number (e.g., 23247)"
                className="w-full bg-obsidian border border-white/10 text-white text-sm font-semibold pl-10 pr-4 py-3 ares-cut-sm focus:border-ares-cyan/50 focus:outline-none transition-colors placeholder:text-marble/30"
              />
            </div>
            <button
              onClick={handleTeamSearch}
              disabled={teamLoading || !teamSearch.trim()}
              className="px-6 py-3 bg-ares-red/20 border border-ares-red/30 text-white font-bold text-sm uppercase tracking-wider ares-cut-sm hover:bg-ares-red/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {teamLoading ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <Search size={16} />
              )}
              Search
            </button>
          </div>

          {teamError && (
            <ErrorBanner message={teamError} onRetry={handleTeamSearch} />
          )}

          {teamData && (
            <TeamAnalysisCard
              team={teamData}
              ranking={teamRanking}
              seasonKey={SEASON_KEY}
            />
          )}

          {!teamData && !teamLoading && !teamError && (
            <EmptyState
              icon={Search}
              title="Search for a Team"
              description="Enter an FTC team number above to view their stats, history, and get AI-powered analysis."
            />
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 2: Event Browser
          ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === "event" && (
        <div className="space-y-4">
          <EventSelector
            onEventSelect={handleEventSelect}
            selectedEventKey={selectedEventKey}
          />

          {selectedEventKey && (
            <div className="bg-obsidian border border-white/10 ares-cut overflow-hidden">
              <div className="p-4 border-b border-white/5 bg-gradient-to-r from-ares-cyan/5 to-transparent">
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  {selectedEventName || "Event Rankings"}
                </h3>
                <p className="text-xs text-marble/60 mt-0.5">
                  {eventRankings.length} teams ranked
                </p>
              </div>

              {eventLoading ? (
                <div className="p-8 text-center">
                  <RefreshCw size={24} className="animate-spin text-ares-cyan/60 mx-auto mb-2" />
                  <p className="text-sm text-marble/60 font-semibold">Loading event data...</p>
                </div>
              ) : eventError ? (
                <div className="p-4">
                  <ErrorBanner message={eventError} />
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {/* Table Header */}
                  <div className="grid grid-cols-[60px_80px_1fr_80px_100px_80px] gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-marble/60 bg-white/3">
                    <span>Rank</span>
                    <span>Team</span>
                    <span>Name</span>
                    <span className="text-right">OPR</span>
                    <span className="text-right">Record</span>
                    <span className="text-right">RP</span>
                  </div>

                  {eventRankings.map((ranking) => {
                    const team = getTeamForRanking(ranking.team_key);
                    const isExpanded = expandedTeam === ranking.team_key;
                    const teamNumber = ranking.team_key?.replace("frc", "");

                    return (
                      <div key={ranking.rank_key || ranking.team_key}>
                        <button
                          onClick={() =>
                            setExpandedTeam(isExpanded ? null : ranking.team_key)
                          }
                          className="w-full grid grid-cols-[60px_80px_1fr_80px_100px_80px] gap-2 px-4 py-3 text-sm hover:bg-white/3 transition-colors items-center"
                        >
                          <span className="text-ares-gold font-black">#{ranking.rank}</span>
                          <span className="text-white font-bold">{teamNumber}</span>
                          <span className="text-marble/70 font-semibold truncate text-left">
                            {team?.team_name_short || "—"}
                          </span>
                          <span className="text-ares-cyan font-bold text-right">
                            {ranking.opr?.toFixed(1) ?? "—"}
                          </span>
                          <span className="text-marble/60 font-semibold text-right">
                            {ranking.wins}W-{ranking.losses}L-{ranking.ties}T
                          </span>
                          <span className="text-marble/60 font-semibold text-right flex items-center justify-end gap-1">
                            {ranking.ranking_points?.toFixed(1) ?? "—"}
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </span>
                        </button>

                        {isExpanded && team && (
                          <div className="px-4 pb-4">
                            <TeamAnalysisCard
                              team={team}
                              ranking={ranking}
                              seasonKey={SEASON_KEY}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {eventRankings.length === 0 && !eventLoading && (
                    <div className="p-8 text-center">
                      <p className="text-sm text-marble/60 font-semibold">
                        No rankings available for this event yet.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!selectedEventKey && (
            <EmptyState
              icon={Globe}
              title="Browse Events"
              description="Select a season and event above to view team rankings, OPR data, and detailed analysis."
            />
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 3: Event Analysis
          ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === "analysis" && (
        <div className="space-y-4">
          <EventSelector
            onEventSelect={(key, name) => {
              setAnalysisEventKey(key);
              setAnalysisEventName(name);
              setEventAnalysis(null);
              setAnalysisError(null);
            }}
            selectedEventKey={analysisEventKey}
          />

          {analysisEventKey && !eventAnalysis && !analysisLoading && !loadingEventHistory && (
            <button
              onClick={handleEventAnalysis}
              className="w-full flex items-center justify-center gap-3 py-4 bg-ares-cyan/10 border border-ares-cyan/30 text-ares-cyan hover:bg-ares-cyan/20 hover:border-ares-cyan/50 ares-cut-sm transition-all font-bold text-sm uppercase tracking-wider"
            >
              <Sparkles size={18} />
              Analyze Event with AI
            </button>
          )}

          {loadingEventHistory && !eventAnalysis && !analysisLoading && (
            <div className="bg-obsidian border border-white/10 ares-cut p-8 text-center">
              <RefreshCw size={28} className="animate-spin text-marble/30 mx-auto mb-3" />
            </div>
          )}

          {analysisLoading && (
            <div className="bg-obsidian border border-white/10 ares-cut p-8 text-center">
              <RefreshCw size={28} className="animate-spin text-ares-cyan/60 mx-auto mb-3" />
              <p className="text-sm font-bold text-marble/60 animate-pulse uppercase tracking-widest">
                Generating event analysis...
              </p>
              <p className="text-xs text-marble/30 mt-1">
                This may take 10–20 seconds
              </p>
            </div>
          )}

          {analysisError && (
            <ErrorBanner message={analysisError} onRetry={handleEventAnalysis} />
          )}

          {eventAnalysis && (
            <div className="bg-obsidian border border-white/10 ares-cut overflow-hidden">
              <div className="p-4 border-b border-white/5 bg-gradient-to-r from-ares-cyan/5 to-transparent flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">
                      AI Event Analysis
                    </h3>
                    {eventAnalysis.created_at && (
                      <span className="text-[10px] text-marble/60 bg-white/5 px-2 py-0.5 rounded-full">
                        {new Date(eventAnalysis.created_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-marble/60 mt-0.5">
                    {analysisEventName}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-semibold text-marble/30">
                    {eventAnalysis.model}
                    {eventAnalysis.tokensUsed ? ` • ${eventAnalysis.tokensUsed} tokens` : ""}
                  </span>
                  <button
                    onClick={handleEventAnalysis}
                    disabled={analysisLoading}
                    className="flex items-center gap-1 text-[10px] font-bold text-ares-cyan/70 hover:text-ares-cyan uppercase tracking-wider transition-colors disabled:opacity-50"
                    title="Regenerate Analysis"
                  >
                    <RefreshCw size={12} className={analysisLoading ? "animate-spin" : ""} />
                    Regenerate
                  </button>
                </div>
              </div>
              <div
                className="p-6 prose prose-invert prose-sm max-w-none text-marble/80
                  prose-headings:text-white prose-headings:font-bold prose-headings:tracking-tight
                  prose-h2:text-base prose-h2:mt-5 prose-h2:mb-2
                  prose-strong:text-ares-gold prose-strong:font-bold
                  prose-li:text-marble/70 prose-li:marker:text-ares-cyan/50"
                dangerouslySetInnerHTML={{ __html: markdownToHtml(eventAnalysis.markdown) }}
              />
            </div>
          )}

          {!analysisEventKey && (
            <EmptyState
              icon={Sparkles}
              title="AI Event Analysis"
              description="Select an event above, then click 'Analyze' to get a comprehensive AI-powered event overview with predictions."
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Shared Sub-Components ────────────────────────────────────────────

function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="bg-ares-danger/10 border border-ares-danger/30 p-4 ares-cut-sm flex items-start gap-3">
      <AlertTriangle size={18} className="text-ares-danger shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm text-ares-danger-soft font-semibold">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 text-xs text-ares-cyan font-bold uppercase tracking-widest hover:underline"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Search;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-obsidian border border-white/5 ares-cut p-12 text-center">
      <div className="w-16 h-16 mx-auto mb-4 bg-white/5 ares-cut flex items-center justify-center">
        <Icon size={28} className="text-marble/20" />
      </div>
      <h3 className="text-lg font-bold text-marble/50 mb-1">{title}</h3>
      <p className="text-sm text-marble/30 max-w-md mx-auto">{description}</p>
    </div>
  );
}

/** Minimal markdown → HTML converter */
function markdownToHtml(md: string): string {
  let html = md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/^(?!<[hlu]|<li)(.+)$/gm, "<p>$1</p>");
  // eslint-disable-next-line security/detect-unsafe-regex
  html = html.replace(/(<li>.*?<\/li>\n?)+/gs, (match) => `<ul>${match}</ul>`);
  // Sanitize HTML to prevent XSS attacks
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['h1', 'h2', 'h3', 'strong', 'em', 'p', 'ul', 'li'],
    ALLOWED_ATTR: ['class']
  });
}
