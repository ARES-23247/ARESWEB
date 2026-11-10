import { useEffect, useMemo, useState } from "react";
import {
  Calculator,
  ChevronDown,
  ChevronUp,
  ListChecks,
  Save,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import type {
  PicklistTier,
  TeamScoutingSummary,
  Tournament,
  TournamentPicklistEntry,
} from "@/types/tournament";

interface TournamentAlliancePlannerProps {
  tournament: Tournament;
  teamSummaries?: TeamScoutingSummary[];
  canManagePicklist?: boolean;
  onSavePicklist?: (picklist: TournamentPicklistEntry[]) => Promise<unknown>;
}

const TIER_ORDER: Record<PicklistTier, number> = {
  first_pick: 0,
  second_pick: 1,
  unranked: 2,
  do_not_pick: 3,
};

const TIER_LABEL: Record<PicklistTier, string> = {
  first_pick: "1st Pick",
  second_pick: "2nd Pick",
  unranked: "Unranked",
  do_not_pick: "Do Not Pick",
};

export function TournamentAlliancePlanner({
  tournament,
  teamSummaries = [],
  canManagePicklist = false,
  onSavePicklist,
}: TournamentAlliancePlannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSavingPicklist, setIsSavingPicklist] = useState(false);
  const [picklistStatus, setPicklistStatus] = useState<string | null>(null);

  const teamList = useMemo(() => {
    return [...(tournament.oprList ?? [])].sort(
      (a, b) => (Number(b.opr) || 0) - (Number(a.opr) || 0),
    );
  }, [tournament.oprList]);

  const defaultSelf = useMemo(() => {
    const ares = teamList.find((t) => t.teamNumber === "23247");
    return ares ? ares.teamNumber : (teamList[0]?.teamNumber ?? "");
  }, [teamList]);

  const defaultPartner = useMemo(() => {
    const candidate = teamList.find((t) => t.teamNumber !== defaultSelf);
    return candidate?.teamNumber ?? "";
  }, [teamList, defaultSelf]);

  const [myCaptain, setMyCaptain] = useState(defaultSelf);
  const [myPartner, setMyPartner] = useState(defaultPartner);
  const [oppCaptain, setOppCaptain] = useState("");
  const [oppPartner, setOppPartner] = useState("");

  const [draftPicklist, setDraftPicklist] = useState<
    Record<string, { tier: PicklistTier; notes: string }>
  >(() => {
    const map: Record<string, { tier: PicklistTier; notes: string }> = {};
    for (const entry of tournament.picklist ?? []) {
      map[entry.teamNumber] = {
        tier: entry.tier,
        notes: entry.notes ?? "",
      };
    }
    return map;
  });

  useEffect(() => {
    const map: Record<string, { tier: PicklistTier; notes: string }> = {};
    for (const entry of tournament.picklist ?? []) {
      map[entry.teamNumber] = {
        tier: entry.tier,
        notes: entry.notes ?? "",
      };
    }
    setDraftPicklist(map);
  }, [tournament.picklist]);

  const captainTeam = useMemo(
    () => teamList.find((t) => t.teamNumber === myCaptain),
    [teamList, myCaptain],
  );
  const partnerTeam = useMemo(
    () => teamList.find((t) => t.teamNumber === myPartner),
    [teamList, myPartner],
  );
  const oppCaptainTeam = useMemo(
    () => teamList.find((t) => t.teamNumber === oppCaptain),
    [teamList, oppCaptain],
  );
  const oppPartnerTeam = useMemo(
    () => teamList.find((t) => t.teamNumber === oppPartner),
    [teamList, oppPartner],
  );

  const myTotalOpr = useMemo(() => {
    const cap = captainTeam ? Number(captainTeam.opr) || 0 : 0;
    const part = partnerTeam ? Number(partnerTeam.opr) || 0 : 0;
    return Math.round((cap + part) * 10) / 10;
  }, [captainTeam, partnerTeam]);

  const myComponentOpr = useMemo(() => {
    const hasAuto =
      captainTeam?.autoOpr !== undefined || partnerTeam?.autoOpr !== undefined;
    if (!hasAuto) return null;
    return {
      auto:
        Math.round(
          ((captainTeam?.autoOpr ?? 0) + (partnerTeam?.autoOpr ?? 0)) * 10,
        ) / 10,
      teleop:
        Math.round(
          ((captainTeam?.teleopOpr ?? 0) + (partnerTeam?.teleopOpr ?? 0)) * 10,
        ) / 10,
      endgame:
        Math.round(
          ((captainTeam?.endgameOpr ?? 0) + (partnerTeam?.endgameOpr ?? 0)) *
            10,
        ) / 10,
    };
  }, [captainTeam, partnerTeam]);

  const oppTotalOpr = useMemo(() => {
    const cap = oppCaptainTeam ? Number(oppCaptainTeam.opr) || 0 : 0;
    const part = oppPartnerTeam ? Number(oppPartnerTeam.opr) || 0 : 0;
    return Math.round((cap + part) * 10) / 10;
  }, [oppCaptainTeam, oppPartnerTeam]);

  const differential = Math.round((myTotalOpr - oppTotalOpr) * 10) / 10;

  const summaryByTeam = useMemo(() => {
    const map = new Map<string, TeamScoutingSummary>();
    for (const s of teamSummaries) map.set(s.teamNumber, s);
    return map;
  }, [teamSummaries]);

  const candidateTeams = useMemo(() => {
    return teamList
      .filter((t) => t.teamNumber !== "23247")
      .sort((a, b) => {
        const tierA = draftPicklist[a.teamNumber]?.tier ?? "unranked";
        const tierB = draftPicklist[b.teamNumber]?.tier ?? "unranked";
        if (TIER_ORDER[tierA] !== TIER_ORDER[tierB]) {
          return TIER_ORDER[tierA] - TIER_ORDER[tierB];
        }
        return (Number(b.opr) || 0) - (Number(a.opr) || 0);
      });
  }, [draftPicklist, teamList]);

  const handleTierChange = (teamNumber: string, tier: PicklistTier) => {
    setDraftPicklist((prev) => ({
      ...prev,
      [teamNumber]: {
        tier,
        notes: prev[teamNumber]?.notes ?? "",
      },
    }));
  };

  const handleNoteChange = (teamNumber: string, notes: string) => {
    setDraftPicklist((prev) => ({
      ...prev,
      [teamNumber]: {
        tier: prev[teamNumber]?.tier ?? "unranked",
        notes,
      },
    }));
  };

  const handleSavePicklist = async () => {
    if (!onSavePicklist) return;
    setIsSavingPicklist(true);
    setPicklistStatus(null);
    try {
      const entries: TournamentPicklistEntry[] = Object.entries(draftPicklist)
        .filter(([, val]) => val.tier !== "unranked" || val.notes.trim().length > 0)
        .map(([teamNumber, val]) => ({
          teamNumber,
          tier: val.tier,
          notes: val.notes.trim() || undefined,
        }));
      await onSavePicklist(entries);
      setPicklistStatus("Alliance picklist saved for selection committee.");
    } catch (err) {
      setPicklistStatus(
        err instanceof Error ? err.message : "Could not save picklist.",
      );
    } finally {
      setIsSavingPicklist(false);
    }
  };

  if (teamList.length < 2) return null;

  return (
    <section className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden backdrop-blur-sm shadow-xl text-left">
      <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
        <div className="flex items-center gap-2">
          <Calculator className="text-ares-gold" size={18} aria-hidden="true" />
          <h2 className="text-lg font-bold text-white uppercase tracking-tight font-heading">
            Alliance Strategy &amp; Selection Planner
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-white/5 hover:bg-white/10 text-xs font-bold text-marble/80 hover:text-white transition-colors cursor-pointer border border-white/10"
          aria-expanded={isOpen}
          aria-controls="alliance-planner-panel"
        >
          <span>{isOpen ? "Collapse" : "Open Simulator"}</span>
          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      <p className="text-xs text-marble/60 mb-4 leading-relaxed">
        Simulate alliance pairings, inspect Auto / TeleOp / Endgame NP-OPR splits, and manage the playoff selection picklist.
      </p>

      {isOpen && (
        <div
          id="alliance-planner-panel"
          className="space-y-6 pt-2 animate-fadeIn"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Our Alliance */}
            <div className="bg-black/35 p-5 rounded-xl border border-ares-cyan/30 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-ares-cyan flex items-center gap-1.5">
                  <Shield size={14} />
                  Your Alliance
                </span>
                <span className="text-sm font-mono font-black text-white bg-ares-cyan/20 border border-ares-cyan/40 px-2.5 py-0.5 rounded">
                  Combined OPR: {myTotalOpr}
                </span>
              </div>

              {myComponentOpr && (
                <div className="grid grid-cols-3 gap-2 text-center font-mono text-[10px]">
                  <div className="rounded border border-white/10 bg-black/40 p-1.5">
                    <span className="block text-marble/55 uppercase">Auto</span>
                    <span className="font-bold text-ares-gold">
                      {myComponentOpr.auto}
                    </span>
                  </div>
                  <div className="rounded border border-white/10 bg-black/40 p-1.5">
                    <span className="block text-marble/55 uppercase">TeleOp</span>
                    <span className="font-bold text-white">
                      {myComponentOpr.teleop}
                    </span>
                  </div>
                  <div className="rounded border border-white/10 bg-black/40 p-1.5">
                    <span className="block text-marble/55 uppercase">Endgame</span>
                    <span className="font-bold text-ares-cyan">
                      {myComponentOpr.endgame}
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-3 text-xs">
                <div>
                  <label
                    htmlFor="select-my-captain"
                    className="block text-[10px] font-bold text-marble/60 uppercase mb-1"
                  >
                    Captain / Primary Team
                  </label>
                  <select
                    id="select-my-captain"
                    value={myCaptain}
                    onChange={(e) => setMyCaptain(e.target.value)}
                    className="w-full bg-black/60 border border-white/15 rounded px-3 py-2 text-white focus:outline-none focus:border-ares-cyan text-xs"
                  >
                    <option value="">Select Team</option>
                    {teamList.map((t) => (
                      <option key={t.teamNumber} value={t.teamNumber}>
                        #{t.teamNumber} - {t.teamName} (OPR: {t.opr})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="select-my-partner"
                    className="block text-[10px] font-bold text-marble/60 uppercase mb-1"
                  >
                    Alliance Partner Pick
                  </label>
                  <select
                    id="select-my-partner"
                    value={myPartner}
                    onChange={(e) => setMyPartner(e.target.value)}
                    className="w-full bg-black/60 border border-white/15 rounded px-3 py-2 text-white focus:outline-none focus:border-ares-cyan text-xs"
                  >
                    <option value="">Select Team</option>
                    {teamList.map((t) => (
                      <option key={t.teamNumber} value={t.teamNumber}>
                        #{t.teamNumber} - {t.teamName} (OPR: {t.opr})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Opposing Alliance */}
            <div className="bg-black/35 p-5 rounded-xl border border-ares-red/30 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-ares-red flex items-center gap-1.5">
                  <Users size={14} />
                  Opposing Alliance
                </span>
                <span className="text-sm font-mono font-black text-white bg-ares-red/20 border border-ares-red/40 px-2.5 py-0.5 rounded">
                  Combined OPR: {oppTotalOpr}
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label
                    htmlFor="select-opp-captain"
                    className="block text-[10px] font-bold text-marble/60 uppercase mb-1"
                  >
                    Opponent Captain
                  </label>
                  <select
                    id="select-opp-captain"
                    value={oppCaptain}
                    onChange={(e) => setOppCaptain(e.target.value)}
                    className="w-full bg-black/60 border border-white/15 rounded px-3 py-2 text-white focus:outline-none focus:border-ares-red text-xs"
                  >
                    <option value="">Select Team</option>
                    {teamList.map((t) => (
                      <option key={t.teamNumber} value={t.teamNumber}>
                        #{t.teamNumber} - {t.teamName} (OPR: {t.opr})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="select-opp-partner"
                    className="block text-[10px] font-bold text-marble/60 uppercase mb-1"
                  >
                    Opponent Partner
                  </label>
                  <select
                    id="select-opp-partner"
                    value={oppPartner}
                    onChange={(e) => setOppPartner(e.target.value)}
                    className="w-full bg-black/60 border border-white/15 rounded px-3 py-2 text-white focus:outline-none focus:border-ares-red text-xs"
                  >
                    <option value="">Select Team</option>
                    {teamList.map((t) => (
                      <option key={t.teamNumber} value={t.teamNumber}>
                        #{t.teamNumber} - {t.teamName} (OPR: {t.opr})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Differential Analysis Banner */}
          {(oppTotalOpr > 0 || myTotalOpr > 0) && (
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Sparkles className="text-ares-gold" size={16} />
                <span className="font-bold text-white uppercase tracking-wider">
                  Projected OPR Advantage:
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono">
                <span
                  className={`text-sm font-black px-3 py-1 rounded ${
                    differential > 0
                      ? "bg-ares-cyan/20 text-ares-cyan border border-ares-cyan/40"
                      : differential < 0
                        ? "bg-ares-red/20 text-ares-red border border-ares-red/40"
                        : "bg-white/10 text-white"
                  }`}
                >
                  {differential > 0 ? `+${differential}` : differential} pts
                </span>
                <span className="text-[11px] text-marble/55">
                  {differential > 0
                    ? "Projected winning margin"
                    : differential < 0
                      ? "Projected deficit"
                      : "Evenly matched projection"}
                </span>
              </div>
            </div>
          )}

          {/* Playoff Alliance Picklist */}
          {candidateTeams.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-black/35 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-ares-gold flex items-center gap-2">
                  <ListChecks size={15} aria-hidden="true" />
                  Playoff Alliance Picklist
                </h3>
                {canManagePicklist && onSavePicklist && (
                  <button
                    type="button"
                    disabled={isSavingPicklist}
                    onClick={() => void handleSavePicklist()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-ares-red px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-white hover:bg-ares-bronze disabled:opacity-50"
                  >
                    <Save size={12} aria-hidden="true" />
                    {isSavingPicklist ? "Saving..." : "Save Picklist"}
                  </button>
                )}
              </div>

              {picklistStatus && (
                <p role="status" className="text-xs text-ares-cyan font-semibold">
                  {picklistStatus}
                </p>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-[10px] font-black uppercase tracking-wider text-marble/55">
                      <th className="py-2 pr-3">Team</th>
                      <th className="py-2 pr-3">OPR Split</th>
                      <th className="py-2 pr-3">Scouted Reliability</th>
                      <th className="py-2 pr-3">Tier</th>
                      <th className="py-2">Strategy Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {candidateTeams.map((team) => {
                      const scout = summaryByTeam.get(team.teamNumber);
                      const entry = draftPicklist[team.teamNumber] ?? {
                        tier: "unranked" as PicklistTier,
                        notes: "",
                      };
                      return (
                        <tr key={team.teamNumber} className="text-marble/85">
                          <td className="py-2.5 pr-3 font-mono">
                            <span className="font-bold text-white">
                              #{team.teamNumber}
                            </span>{" "}
                            <span className="text-marble/60">
                              {team.teamName}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 font-mono text-[11px]">
                            <span className="font-bold text-ares-gold">
                              {team.opr}
                            </span>
                            {team.autoOpr !== undefined && (
                              <span className="ml-1.5 text-marble/55">
                                ({team.autoOpr}A / {team.teleopOpr ?? 0}T /{" "}
                                {team.endgameOpr ?? 0}E)
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 pr-3 font-mono text-[11px]">
                            {scout ? (
                              <span>
                                {scout.highEndgameRate}% High EG ·{" "}
                                {scout.disconnectRate}% DC
                              </span>
                            ) : (
                              <span className="text-marble/45">No stand logs</span>
                            )}
                          </td>
                          <td className="py-2.5 pr-3">
                            {canManagePicklist ? (
                              <select
                                aria-label={`Picklist tier for #${team.teamNumber}`}
                                value={entry.tier}
                                onChange={(e) =>
                                  handleTierChange(
                                    team.teamNumber,
                                    e.target.value as PicklistTier,
                                  )
                                }
                                className="rounded border border-white/15 bg-black/70 px-2 py-1 text-[10px] font-bold uppercase text-white"
                              >
                                <option value="first_pick">1st Pick</option>
                                <option value="second_pick">2nd Pick</option>
                                <option value="unranked">Unranked</option>
                                <option value="do_not_pick">Do Not Pick</option>
                              </select>
                            ) : (
                              <span className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-black uppercase text-white">
                                {TIER_LABEL[entry.tier]}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5">
                            {canManagePicklist ? (
                              <input
                                type="text"
                                aria-label={`Picklist note for #${team.teamNumber}`}
                                placeholder="Auto synergy / notes..."
                                value={entry.notes}
                                onChange={(e) =>
                                  handleNoteChange(
                                    team.teamNumber,
                                    e.target.value,
                                  )
                                }
                                className="w-full min-w-[140px] rounded border border-white/15 bg-black/50 px-2 py-1 text-xs text-white"
                              />
                            ) : (
                              <span className="text-marble/70">
                                {entry.notes || "—"}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
