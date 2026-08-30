/** @sim {"name":"Hardware Topology Diagnostic","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { AcademyChecklistLab } from "@/sims/shared/academy-interaction-ui";

export type TopologyEvidence = { inventory: boolean; name: boolean; connection: boolean; startupHealth: boolean; freshInput: boolean; outputWrite: boolean };
export type TopologyFinding = { ready: boolean; title: string; nextAction: string };

export function diagnoseTopologyEvidence(evidence: TopologyEvidence): TopologyFinding {
  if (!evidence.inventory) return { ready: false, title: "Canonical inventory missing", nextAction: "Stop guessing and identify the exact project document and device record." };
  if (!evidence.name) return { ready: false, title: "Stable name mismatch", nextAction: "Keep disabled and compare the software name with the configured hardware name." };
  if (!evidence.connection) return { ready: false, title: "Connection identity mismatch", nextAction: "Compare platform, parent, port, bus, address, and channel with the reviewed inventory." };
  if (!evidence.startupHealth) return { ready: false, title: "Startup health failed", nextAction: "Keep outputs neutral and preserve the named required or optional device failure." };
  if (!evidence.freshInput) return { ready: false, title: "Input evidence is stale or invalid", nextAction: "Inspect the single refresh owner, timestamp, validity, unit, and diagnostic state." };
  if (!evidence.outputWrite) return { ready: false, title: "Output write failed", nextAction: "Latch or report the failure and require a neutral recovery before another motion request." };
  return { ready: true, title: "No fault found in these software checks", nextAction: "Continue with a bounded physical inspection; do not call the device proven operational." };
}

const DEFAULTS: TopologyEvidence = { inventory: true, name: true, connection: true, startupHealth: true, freshInput: true, outputWrite: true };
const CHECKS: { key: keyof TopologyEvidence; label: string }[] = [
  { key: "inventory", label: "Exact canonical device record is available" },
  { key: "name", label: "Stable software and configured hardware names match" },
  { key: "connection", label: "Parent, port, bus, address, or channel matches" },
  { key: "startupHealth", label: "Required or optional startup health is explicit" },
  { key: "freshInput", label: "Cached input is valid, fresh, and unit-labeled" },
  { key: "outputWrite", label: "Commanded output write reports success" },
];

export default function HardwareTopologyDiagnostic() {
  return (
    <AcademyChecklistLab
      titleId="topology-diagnostic-title"
      title="Hardware Topology Diagnostic"
      eyebrow="First visible mismatch"
      description="Turn off one invented evidence check. The model identifies the earliest represented boundary that needs work."
      initialValues={DEFAULTS}
      checks={CHECKS}
      legend="Invented evidence record"
      resultHeading="Diagnostic result"
      review={diagnoseTopologyEvidence}
      limit="These self-reported checks do not open an ARES project, scan a hardware map, connect to a controller, read power or wiring, poll a sensor, write an actuator, identify a root cause, or prove a device works."
    />
  );
}
