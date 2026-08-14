import { useState, useMemo } from "react";
import { Users, Calculator, Sparkles, Shield, ChevronDown, ChevronUp } from "lucide-react";
import type { Tournament } from "@/types/tournament";

interface TournamentAlliancePlannerProps {
  tournament: Tournament;
}

export function TournamentAlliancePlanner({ tournament }: TournamentAlliancePlannerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const teamList = useMemo(() => {
    return [...(tournament.oprList ?? [])].sort(
      (a, b) => (Number(b.opr) || 0) - (Number(a.opr) || 0)
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

  const captainTeam = useMemo(
    () => teamList.find((t) => t.teamNumber === myCaptain),
    [teamList, myCaptain]
  );
  const partnerTeam = useMemo(
    () => teamList.find((t) => t.teamNumber === myPartner),
    [teamList, myPartner]
  );
  const oppCaptainTeam = useMemo(
    () => teamList.find((t) => t.teamNumber === oppCaptain),
    [teamList, oppCaptain]
  );
  const oppPartnerTeam = useMemo(
    () => teamList.find((t) => t.teamNumber === oppPartner),
    [teamList, oppPartner]
  );

  const myTotalOpr = useMemo(() => {
    const cap = captainTeam ? Number(captainTeam.opr) || 0 : 0;
    const part = partnerTeam ? Number(partnerTeam.opr) || 0 : 0;
    return Math.round((cap + part) * 10) / 10;
  }, [captainTeam, partnerTeam]);

  const oppTotalOpr = useMemo(() => {
    const cap = oppCaptainTeam ? Number(oppCaptainTeam.opr) || 0 : 0;
    const part = oppPartnerTeam ? Number(oppPartnerTeam.opr) || 0 : 0;
    return Math.round((cap + part) * 10) / 10;
  }, [oppCaptainTeam, oppPartnerTeam]);

  const differential = Math.round((myTotalOpr - oppTotalOpr) * 10) / 10;

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
        Simulate alliance pairings and project combined Offensive Power Ratings (OPR) for playoff alliance selections and match strategy.
      </p>

      {isOpen && (
        <div id="alliance-planner-panel" className="space-y-6 pt-2 animate-fadeIn">
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

              <div className="space-y-3 text-xs">
                <div>
                  <label htmlFor="select-my-captain" className="block text-[10px] font-bold text-marble/60 uppercase mb-1">
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
                  <label htmlFor="select-my-partner" className="block text-[10px] font-bold text-marble/60 uppercase mb-1">
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
                  <label htmlFor="select-opp-captain" className="block text-[10px] font-bold text-marble/60 uppercase mb-1">
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
                  <label htmlFor="select-opp-partner" className="block text-[10px] font-bold text-marble/60 uppercase mb-1">
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
        </div>
      )}
    </section>
  );
}
