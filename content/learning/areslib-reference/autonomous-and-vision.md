# Autonomous paths, localization, and vision

Canonical `.aresroutine` documents are decoded by `project-schema`, assembled into the effective
project model, and compiled into typed routine IR. The compiler resolves stable subsystem,
capability, resource, and task keys before deterministic code generation. The FTC or FRC runtime
then executes the generated routine through its league-specific lifecycle. Do not put a second
routine parser or hidden autonomous behavior in a lifecycle adapter.

External path assets may still feed reviewed path nodes, but they are inputs to the canonical
routine and compiler pipeline rather than an alternate source of robot meaning. Every referenced
command or resource must be declared before generation succeeds.

Path X/Y are field-relative meters. Tangent and holonomic heading are radians and
counter-clockwise-positive. Alliance mirroring occurs once at the declared runtime boundary. The
Studio field-to-canvas transform is for rendering only.

Before execution, reject empty paths, non-finite values, unsafe footprint/costmap intersections, and incompatible chained endpoints or constraints. Stop the drivetrain when loading or execution fails.

Vision capture timestamps must describe capture time, not receipt time. Hardware adapters subtract latency once. Delayed measurements are applied to estimator history and replayed forward. Invalid tags, ambiguity, covariance, field/history position, or innovation must remain visible as rejected measurements; do not replace the estimated pose with simulator truth or force a snap merely to make a display look aligned.

Simulation verifies the canonical-document, compiler, runtime, and coordinate pipeline but not
physical camera mounting, calibration, exposure, focus, wiring, or field placement.
