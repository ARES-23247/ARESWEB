# The ARES software workspace

ARES separates reusable robotics behavior from season-specific robots and desktop tools.

| Repository | Responsibility |
| --- | --- |
| ARESLib-Kotlin | Shared Redux state, math, controllers, hardware contracts, simulation, telemetry, and logging |
| ARES-FTC | Team 23247's current FTC season hardware, mechanisms, actions, reducers, and OpModes |
| ARES-FRC | The current FRC season layer over shared ARESLib behavior |
| ARES-Analytics | Desktop authoring, simulation control, telemetry, local log import, and optional laptop-to-cloud synchronization |
| ARES-FTC-Starter | A generic novice FTC project without Team 23247's season mechanisms or calibration |

## Decide where a change belongs

Ask whether more than one robot should reuse the behavior. Shared geometry, control, logging, and SDK-free IO contracts belong in ARESLib. A mechanism tied to one game belongs in the season repository. Desktop workflows belong in Analytics.

## Checkpoint

For each proposed change, name its owner and one consumer that must be retested. Do not copy a shared fix into multiple season repositories merely to avoid changing the library.
