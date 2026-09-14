import type { RobotSetup } from "./core/types";

export default function RobotMechanismDiagram({setup}:{setup:RobotSetup}) {
  const ports=(side:"front"|"back")=><div className="bio-layout-ports" role="group" aria-label={`${side} mechanisms`}>
    {(setup.intake===side||setup.intake==="both")&&<span className="bio-port bio-port-intake"><b>I</b> Intake</span>}
    {setup.deposit===side&&<span className="bio-port bio-port-flower"><b>F</b> Flower placement</span>}
    {!setup.turret&&setup.shooter===side&&<span className="bio-port bio-port-shooter"><b>S</b> Shooter</span>}
  </div>;
  return <figure className="bio-robot-layout" aria-label="Robot mechanism layout">
    <figcaption>Robot layout · front ↑</figcaption>
    <strong>Front</strong>{ports("front")}
    <div className="bio-layout-chassis" aria-hidden="true"><span>↑</span>{setup.turret?<span className="bio-port bio-port-shooter"><b>S</b> Turret</span>:"Chassis"}</div>
    {ports("back")}<strong>Back</strong>
    {setup.turret&&<p className="bio-help">Shooter rotates on a turret; home points {setup.shooter}.</p>}
    <p className="bio-help">I = intake · F = flower placement · S = shooter. These letters mark the same sides on the field.</p>
  </figure>;
}
