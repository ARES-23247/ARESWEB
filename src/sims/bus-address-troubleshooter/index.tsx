/** @sim {"name":"Bus and Address Troubleshooter","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { useMemo, useState } from "react";
import { Cable, RotateCcw } from "lucide-react";

type ConnectionKind = "CAN" | "I2C" | "CHANNEL";
type DeviceIdentity = { kind: ConnectionKind; bus: string; address: number };
export type IdentityFinding = { status: "No duplicate in this two-device model" | "Blocked: duplicate identity"; reason: string };

export function compareDeviceIdentities(first: DeviceIdentity, second: DeviceIdentity): IdentityFinding {
  if (![first.address, second.address].every(Number.isInteger) || first.address < 0 || second.address < 0) {
    throw new Error("Addresses and channels must be whole numbers at or above zero.");
  }
  const sameKind = first.kind === second.kind;
  const sameBus = first.bus.trim().toLowerCase() === second.bus.trim().toLowerCase();
  const sameAddress = first.address === second.address;
  if (sameKind && sameBus && sameAddress) {
    return {
      status: "Blocked: duplicate identity",
      reason: `Both records claim ${first.kind} ${first.address} on ${first.bus.trim() || "an unnamed bus"}.`,
    };
  }
  return {
    status: "No duplicate in this two-device model",
    reason: "The connection type, bus or controller, or numeric address is different.",
  };
}

const DEFAULT_FIRST: DeviceIdentity = { kind: "CAN", bus: "rio", address: 20 };
const DEFAULT_SECOND: DeviceIdentity = { kind: "CAN", bus: "rio", address: 21 };

export default function BusAddressTroubleshooter() {
  const [first, setFirst] = useState<DeviceIdentity>(DEFAULT_FIRST);
  const [second, setSecond] = useState<DeviceIdentity>(DEFAULT_SECOND);
  const finding = useMemo(() => compareDeviceIdentities(first, second), [first, second]);
  const reset = () => { setFirst(DEFAULT_FIRST); setSecond(DEFAULT_SECOND); };

  return (
    <section aria-labelledby="bus-address-title" className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">Identity comparison</p><h3 id="bus-address-title" className="mt-1 text-xl font-black text-white">Bus and Address Troubleshooter</h3><p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">Compare two invented connection records. A duplicate needs the same connection type, the same bus or controller, and the same number.</p></div>
        <button type="button" onClick={reset} className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"><RotateCcw aria-hidden="true" size={16} /> Reset</button>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <DeviceEditor legend="Device A" prefix="first" value={first} onChange={setFirst} />
        <DeviceEditor legend="Device B" prefix="second" value={second} onChange={setSecond} />
      </div>

      <div className="mt-5 rounded-lg border border-white/10 bg-obsidian p-4">
        <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ares-gold"><Cable aria-hidden="true" size={18} /> Comparison result</h4>
        <dl aria-live="polite" aria-atomic="true" className="mt-4 grid gap-3 sm:grid-cols-2"><Datum label="Status" value={finding.status} /><Datum label="Reason" value={finding.reason} /></dl>
      </div>

      <details className="mt-5 rounded border border-white/10 bg-white/5 p-3 text-sm text-white"><summary className="min-h-11 cursor-pointer font-bold text-ares-cyan">Open the identity checklist</summary><ol className="mt-3 list-decimal space-y-2 pl-6 text-marble/80"><li>Match the software name to the physical label.</li><li>Record the connection type and parent controller.</li><li>Record the bus name and numeric address or channel.</li><li>Check the complete project for another owner.</li><li>Keep configuration review separate from a powered test.</li></ol></details>

      <p role="note" className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white"><strong>Model limit:</strong> This two-record comparison does not scan an ARES project, discover a device, validate current vendor or competition ranges, inspect wiring or termination, connect to a robot, or prove physical identity.</p>
    </section>
  );
}

function DeviceEditor({ legend, prefix, value, onChange }: { legend: string; prefix: string; value: DeviceIdentity; onChange: (value: DeviceIdentity) => void }) {
  return <fieldset className="grid gap-4 rounded-lg border border-white/10 bg-white/5 p-4"><legend className="px-2 text-sm font-bold text-ares-gold">{legend}</legend><label htmlFor={`${prefix}-kind`} className="grid gap-2 text-sm font-bold text-white"><span>Connection type</span><select id={`${prefix}-kind`} value={value.kind} onChange={(event) => onChange({ ...value, kind: event.currentTarget.value as ConnectionKind })} className="min-h-11 rounded border border-white/20 bg-black px-3 py-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"><option value="CAN">CAN device</option><option value="I2C">I2C device</option><option value="CHANNEL">Controller channel</option></select></label><label htmlFor={`${prefix}-bus`} className="grid gap-2 text-sm font-bold text-white"><span>Bus or parent controller</span><input id={`${prefix}-bus`} value={value.bus} onChange={(event) => onChange({ ...value, bus: event.currentTarget.value })} className="min-h-11 rounded border border-white/20 bg-black px-3 py-2 font-mono text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan" /></label><label htmlFor={`${prefix}-address`} className="grid gap-2 text-sm font-bold text-white"><span>Address or channel number</span><input id={`${prefix}-address`} type="number" min="0" step="1" value={value.address} onChange={(event) => onChange({ ...value, address: Number(event.currentTarget.value) })} className="min-h-11 rounded border border-white/20 bg-black px-3 py-2 font-mono text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan" /></label></fieldset>;
}

function Datum({ label, value }: { label: string; value: string }) { return <div className="rounded border border-white/10 p-3"><dt className="text-xs uppercase tracking-wide text-marble/70">{label}</dt><dd className="mt-1 font-semibold leading-relaxed text-white">{value}</dd></div>; }
