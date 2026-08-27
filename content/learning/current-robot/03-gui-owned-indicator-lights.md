# Author GUI-owned FTC indicator lights

Lightbot's two goBILDA indicator lights are canonical Robot Builder subsystems. This guided lab
traces `.ares/subsystems/indicator-lights.aressubsystem` through generated Redux state, actions,
controllers, FTC/mock adapters, lifecycle registration, simulator output, and physical validation.
Do not hand-edit generated source to complete the exercise.

## Read the canonical descriptor

The descriptor declares two independently addressable devices: `indicator` on the left and
`indicator2` on the right. Each has a safe output of zero and a simulator placement. Separate
`leftColor` and `rightColor` target fields feed separate direct control loops, so changing one side
must not mutate the other.

The implementation is `DECLARATIVE_GENERATED` with `GENERATED_DO_NOT_EDIT` ownership. It requests a
generated mock and generated tests. `requiredAtStartup` is false, but that startup policy does not
remove the safe-off or physical-review requirements.

## Trace the generated flow

```text
TeleOp or autonomous choice
  -> generated named action
  -> Redux reducer
  -> immutable subsystem state
  -> generated controller
  -> shared I/O contract
  -> FTC or mock adapter
```

1. Open the indicator-light subsystem in ARES Robotics Studio's Robot Builder.
2. Locate the two hardware-map names, visual placements, target fields, output limits, and safe
   outputs. Do not change them merely to complete this lesson.
3. In generated-artifact details, identify the definition, registry, tests, and mock/adapter
   boundary. Confirm that editable adapter starters are distinct from generated mechanical files.
4. Run **Verify & build** and inspect the evidence for safe startup/stop, independent targets,
   generated actions, failed writes, simulator integration, and FTC lifecycle coverage.
5. In Local Simulator, set and cycle each side independently. Record the applied outputs and visual
   placements; do not treat apparent color accuracy as physical evidence.

## Physical-validation boundary

The highest automatic claim is **Ready for physical validation**. Before recording physical
evidence, a mentor must keep the robot disabled, confirm both hardware-map names and physical sides,
verify safe-off behavior, use restrained hold-to-run steps, and keep an accessible emergency stop.
Compilation and simulation cannot prove wiring, brightness, PWM color accuracy, or a safe physical
installation.
