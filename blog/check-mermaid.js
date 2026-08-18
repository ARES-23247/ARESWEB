const diagrams = {
  tools: `flowchart TD
    toolbox["🧰 The Shared Toolbox<br/>~133,000 lines of ready-made robot skills<br/>written once, used by every robot"]
    ftc["🤖 The FTC Robot<br/>our phone-driven competition robot"]
    frc["🚀 The FRC Robot<br/>our bigger RoboRIO competition robot"]
    app["💻 Mission Control<br/>the team's laptop app"]
    toolbox --> ftc
    toolbox --> frc
    toolbox --> app
    app <-. "live data and remote control" .-> ftc
    app <-. "live data" .-> frc`,

  journey: `flowchart TD
    plan["1 · Make the plan<br/>draw the path, pick actions from a menu"] --> translate["2 · Translate<br/>the computer turns the plan into robot code"]
    translate --> check["3 · Double-check<br/>plan and code must match, or the build stops"]
    check --> rehearse["4 · Rehearse<br/>a physics simulator practices the plan and scores it"]
    rehearse --> gameday["5 · Game day<br/>the driver picks the plan from a menu"]
    rehearse -. "mistake found? fix it here, long before the robot" .-> plan`,

  store: `flowchart LR
    tasks["Routine task tree<br/>state machines that emit actions"] --> dispatch["Dispatch<br/>driver input, vision, task actions"]
    sensors["Sensors<br/>cached once per cycle"] --> dispatch
    dispatch --> store["The store<br/>one shared, immutable state tree"]
    store --> reducers["Reducers<br/>pure functions compute the next state"]
    reducers --> outputs["Outputs<br/>motors, servos, telemetry, logs"]
    outputs --> sensors`,

  subsystemFlow: `flowchart LR
    form["Describe the mechanism<br/>devices, safe positions, state fields,<br/>control loops, homing, interlocks"] --> validate["Validate<br/>cross-checks every reference, flags<br/>missing safety configuration"]
    validate --> generate["Generate Kotlin<br/>state, IO contract, controller,<br/>hardware adapter, simulator mock, tests"]
    generate --> own["Team review<br/>starters are owned: edit if you like —<br/>regeneration never overwrites without confirmation"]
    own --> wire["Auto-wired<br/>set-target, homing and recovery actions<br/>appear on the routine menu by themselves"]`,

  subsystemLifecycle: `stateDiagram-v2
    [*] --> Idle
    Idle --> Homing: explicit homing request
    Homing --> Ready: sensor evidence held for the dwell time
    Homing --> HomingFault: timeout or unsafe write
    HomingFault --> Idle: operator cancel
    Ready --> Tracking: target commanded, all permits green
    Tracking --> Ready: target reached
    Tracking --> FaultLatched: hardware write fails
    Ready --> SafeNeutral: interlock or feedback invalid
    Tracking --> SafeNeutral: interlock or feedback invalid
    SafeNeutral --> Ready: condition clears
    FaultLatched --> Recovering: neutral-recovery request
    Recovering --> Ready: neutral applied everywhere
    Recovering --> FaultLatched: recovery fails`,

  rehearsal: `flowchart TD
    rules["✅ Rule check<br/>does the plan follow every rule?"] --> sim["🎮 Simulated rehearsal<br/>the plan drives in a physics video game"]
    sim --> wiring["📡 Wiring practice<br/>laptop and robot talk like it is a real match"]
    wiring --> team["🏭 Team-wide re-test<br/>every change re-runs all of this, automatically"]`,

  comparison: `flowchart LR
    subgraph B["Block coding"]
        direction LR
        b1["Idea"] --> b2["Snap the blocks<br/>you are writing the program"] --> b3["Run it and see"]
    end
    subgraph A["Document-driven"]
        direction LR
        a1["Idea"] --> a2["Write the document<br/>you are writing the specification"] --> a3["Review the diff"] --> a4["Generator writes the code"] --> a5["Simulate + CI"] --> a6["Run"]
    end`,
};

(async () => {
  const { JSDOM } = require("jsdom");
  const dom = new JSDOM("<!DOCTYPE html><body></body>", { pretendToBeVisual: true });
  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  global.DOMPurify = { sanitize: (x) => x, addHook: () => {} };

  const mermaidModule = require("mermaid");
  const mermaid = mermaidModule.default || mermaidModule;
  mermaid.initialize({ startOnLoad: false, securityLevel: "loose" });

  let failures = 0;
  for (const [name, text] of Object.entries(diagrams)) {
    try {
      await mermaid.parse(text);
      console.log("OK   " + name);
    } catch (e) {
      failures++;
      console.log("FAIL " + name + ": " + String(e.message || e).split("\n")[0]);
    }
  }
  process.exit(failures ? 1 : 0);
})();
