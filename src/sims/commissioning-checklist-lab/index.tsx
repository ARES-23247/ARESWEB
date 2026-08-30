/** @sim {"name":"Commissioning Boundary Checklist","requiresContext":false,"academyApproved":true,"fidelity":"conceptual"} */
import { AcademyChecklistLab } from "@/sims/shared/academy-interaction-ui";

export type CommissioningChecks = { code: boolean; simulation: boolean; configuration: boolean; stopReady: boolean; restrained: boolean; unexpected: boolean };
export type CommissioningFinding = {
  ready: boolean;
  title: "Continue evidence work" | "Stop and investigate" | "Ready to consider one bounded device test";
  nextAction: string;
};

export function chooseCommissioningBoundary(checks: CommissioningChecks): CommissioningFinding {
  if (checks.unexpected) return { ready: false, title: "Stop and investigate", nextAction: "Record the unexpected result and return to the last boundary with good evidence." };
  if (!checks.code) return { ready: false, title: "Continue evidence work", nextAction: "Run the required build, verification, and focused tests." };
  if (!checks.simulation) return { ready: false, title: "Continue evidence work", nextAction: "Run the applicable hardware-free simulation and fault cases." };
  if (!checks.configuration) return { ready: false, title: "Continue evidence work", nextAction: "Keep disabled and review the exact names, connections, directions, limits, and safe outputs." };
  if (!checks.stopReady) return { ready: false, title: "Stop and investigate", nextAction: "Do not request motion until the stop control and written stop conditions are ready." };
  if (!checks.restrained) return { ready: false, title: "Continue evidence work", nextAction: "Prepare a stable restrained setup through the team's robot-safety procedure." };
  return { ready: true, title: "Ready to consider one bounded device test", nextAction: "Use one small hold-to-run request and stop after any unexpected result." };
}

const DEFAULTS: CommissioningChecks = { code: false, simulation: false, configuration: false, stopReady: false, restrained: false, unexpected: false };
const ITEMS: { key: keyof CommissioningChecks; label: string }[] = [
  { key: "code", label: "Required code checks passed" },
  { key: "simulation", label: "Applicable simulation and fault cases passed" },
  { key: "configuration", label: "Current disabled configuration review is recorded" },
  { key: "stopReady", label: "Stop control and written stop conditions are ready" },
  { key: "restrained", label: "Stable restrained setup is ready" },
  { key: "unexpected", label: "An unexpected result occurred" },
];

export default function CommissioningChecklistLab() {
  return (
    <AcademyChecklistLab
      titleId="commissioning-checklist-title"
      title="Commissioning Boundary Checklist"
      eyebrow="Evidence boundary"
      description="Mark only evidence that is current for one invented system. The result chooses a next boundary, not permission to move a robot."
      initialValues={DEFAULTS}
      checks={ITEMS}
      legend="Current evidence"
      resultHeading="Next boundary"
      review={chooseCommissioningBoundary}
      limit="This checklist uses self-reported boxes. It does not run tests, inspect an inventory, verify a safety setup, connect to hardware, authorize motion, command an actuator, or prove physical behavior."
    />
  );
}
