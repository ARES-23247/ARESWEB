/** @sim {"name":"Drivetrain Starting-Point Lab","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { useMemo, useState } from "react";
import { RotateCcw, Ruler } from "lucide-react";
import { AcademyDatum } from "@/sims/shared/academy-interaction-ui";

type DriveType = "FTC_MECANUM" | "FRC_CTRE_SWERVE" | "DIFFERENTIAL" | "ADVANCED_CUSTOM";

const DRIVE_TYPES: Record<DriveType, { label: string; topology: string; motion: string; evidence: string }> = {
  FTC_MECANUM: { label: "FTC mecanum", topology: "Four named drive motors and one primary localization source", motion: "Forward, sideways, rotation, and combined chassis motion", evidence: "Wheel order, inversion, geometry, heading, odometry scale, and restrained direction checks" },
  FRC_CTRE_SWERVE: { label: "FRC CTRE swerve", topology: "Four modules with drive, steer, absolute encoder, position, and vendor provenance", motion: "Independent module speed and angle for full chassis motion", evidence: "Vendor file hash, module order, offsets, CAN identity, geometry, and restrained module checks" },
  DIFFERENTIAL: { label: "Differential", topology: "Left and right grouped drive hardware with explicit leaders and followers", motion: "Forward, reverse, and turning; no direct sideways wheel motion", evidence: "Side grouping, follower direction, track width, wheel scale, heading, and restrained direction checks" },
  ADVANCED_CUSTOM: { label: "Advanced or custom", topology: "A fully explicit topology that does not fit the common starting points", motion: "Only the motions supported by the reviewed custom model", evidence: "Written topology, kinematics, limits, localization, simulator contract, and added hazard review" },
};

const DEFAULTS = { driveType: "FTC_MECANUM" as DriveType, geometry: false, localization: false, neutral: false, simulation: false };

export default function DrivetrainChoiceLab() {
  const [driveType, setDriveType] = useState<DriveType>(DEFAULTS.driveType);
  const [geometry, setGeometry] = useState(DEFAULTS.geometry);
  const [localization, setLocalization] = useState(DEFAULTS.localization);
  const [neutral, setNeutral] = useState(DEFAULTS.neutral);
  const [simulation, setSimulation] = useState(DEFAULTS.simulation);
  const completed = useMemo(() => [geometry, localization, neutral, simulation].filter(Boolean).length, [geometry, localization, neutral, simulation]);
  const reset = () => { setDriveType(DEFAULTS.driveType); setGeometry(false); setLocalization(false); setNeutral(false); setSimulation(false); };
  const selected = DRIVE_TYPES[driveType];

  return (
    <section aria-labelledby="drivetrain-lab-title" className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">Topology review</p><h3 id="drivetrain-lab-title" className="mt-1 text-xl font-black text-white">Drivetrain Starting-Point Lab</h3><p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">Compare the four ARES starting points and mark which design facts still need evidence.</p></div>
        <button type="button" onClick={reset} className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"><RotateCcw aria-hidden="true" size={16} /> Reset</button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <fieldset className="grid gap-4 rounded-lg border border-white/10 bg-white/5 p-4">
          <legend className="px-2 text-sm font-bold text-ares-gold">Reviewed design record</legend>
          <label htmlFor="drive-type" className="grid gap-2 text-sm font-bold text-white"><span>ARES starting point</span><select id="drive-type" value={driveType} onChange={(event) => setDriveType(event.currentTarget.value as DriveType)} className="min-h-11 rounded border border-white/20 bg-black px-3 py-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">{Object.entries(DRIVE_TYPES).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select></label>
          <Check label="Geometry was measured and recorded" checked={geometry} onChange={setGeometry} />
          <Check label="Localization and heading sources are declared" checked={localization} onChange={setLocalization} />
          <Check label="Safe neutral and fault recovery are defined" checked={neutral} onChange={setNeutral} />
          <Check label="Simulation uses the canonical geometry and tuning" checked={simulation} onChange={setSimulation} />
        </fieldset>

        <div className="rounded-lg border border-white/10 bg-obsidian p-4">
          <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ares-gold"><Ruler aria-hidden="true" size={18} /> Selected starting point</h4>
          <dl aria-live="polite" aria-atomic="true" className="mt-4 grid gap-3"><Datum label="Topology" value={selected.topology} /><Datum label="Motion model" value={selected.motion} /><Datum label="Evidence focus" value={selected.evidence} /><Datum label="Recorded design facts" value={`${completed} of 4 marked; marks are not validation`} /></dl>
        </div>
      </div>

      <details className="mt-5 rounded border border-white/10 bg-white/5 p-3 text-sm text-white"><summary className="min-h-11 cursor-pointer font-bold text-ares-cyan">Compare all four starting points</summary><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[46rem] border-collapse text-left text-sm"><thead><tr><th className="border border-white/15 p-2 text-ares-gold">Starting point</th><th className="border border-white/15 p-2 text-ares-gold">Physical grouping</th><th className="border border-white/15 p-2 text-ares-gold">Motion</th></tr></thead><tbody>{Object.entries(DRIVE_TYPES).map(([id, item]) => <tr key={id}><th scope="row" className="border border-white/15 p-2 font-semibold text-white">{item.label}</th><td className="border border-white/15 p-2 text-marble/80">{item.topology}</td><td className="border border-white/15 p-2 text-marble/80">{item.motion}</td></tr>)}</tbody></table></div></details>

      <p role="note" className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white"><strong>Model limit:</strong> This reference card does not choose a drivetrain, measure a robot, solve wheel commands, inspect a drivebase document, validate vendor data, run simulation, command hardware, or prove safe motion. The checkboxes are local lesson marks only.</p>
    </section>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) { return <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded border border-white/10 p-3 text-sm font-bold text-white"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.currentTarget.checked)} className="h-5 w-5 accent-ares-red" /> {label}</label>; }
const Datum = AcademyDatum;
