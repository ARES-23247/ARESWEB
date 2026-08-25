# Autonomous paths, localization, and vision

ARES parses PathPlanner path/auto JSON outside the control loop, parameterizes it, and executes it through a configured holonomic follower. Named event commands must be registered before an auto is built.

Path X/Y are field-relative meters. Tangent and holonomic heading are radians and counter-clockwise-positive. Alliance mirroring occurs once while loading for the active alliance. The Analytics field-to-canvas transform is for rendering only.

Before execution, reject empty paths, non-finite values, unsafe footprint/costmap intersections, and incompatible chained endpoints or constraints. Stop the drivetrain when loading or execution fails.

Vision capture timestamps must describe capture time, not receipt time. Hardware adapters subtract latency once. Delayed measurements are applied to estimator history and replayed forward. Invalid tags, ambiguity, covariance, field/history position, or innovation must remain visible as rejected measurements; do not replace the estimated pose with simulator truth or force a snap merely to make a display look aligned.

Simulation verifies the software and coordinate pipeline but not physical camera mounting, calibration, exposure, focus, or field placement.
