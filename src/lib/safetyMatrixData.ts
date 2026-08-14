/**
 * Workshop Safety & Tool Certification Matrix Data Model
 * ARES 23247 - Appalachian Robotics & Engineering Society
 * 
 * Strict Zero-PII Safety Qualification & Incident Response Engine
 */

export interface MachineQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  criticalCategory: string;
}

export type HazardLevel = "Critical" | "High" | "Moderate";

export interface MachineSafetyProtocol {
  id: string;
  name: string;
  shortName: string;
  category: string;
  hazardLevel: HazardLevel;
  iconName: string;
  description: string;
  requiredPPE: string[];
  prohibitedItems: string[];
  preOperationalChecks: string[];
  operatingRules: string[];
  postOperationalCleanup: string[];
  emergencyShutdown: string;
  quizQuestions: MachineQuizQuestion[];
}

export interface EmergencyProcedureSection {
  id: string;
  title: string;
  subtitle: string;
  iconName: string;
  priorityLevel: "Urgent" | "Critical" | "Standard";
  guidelines: string[];
  criticalAlert?: string;
  subsections?: {
    heading: string;
    items: string[];
  }[];
}

export interface SafetyCertificationRecord {
  recordId: string;
  callsign: string;
  issuedAt: string;
  expiresAt: string;
  certifiedMachineIds: string[];
  totalQualified: number;
  isFullyCertified: boolean;
  checksum: string;
  version: string;
}

export interface QuizEvaluationResult {
  machineId: string;
  passed: boolean;
  score: number;
  totalQuestions: number;
  incorrectQuestionIds: string[];
  feedback: {
    questionId: string;
    isCorrect: boolean;
    explanation: string;
  }[];
}

export const WORKSHOP_MACHINES: MachineSafetyProtocol[] = [
  {
    id: "cnc-router",
    name: "Computer Numerical Control (CNC) Router",
    shortName: "CNC Router",
    category: "Subtractive Machining",
    hazardLevel: "Critical",
    iconName: "Cpu",
    description: "High-speed 24,000 RPM precision spindle for milling robot chassis plates, gearbox mounts, and polycarbonate intake brackets.",
    requiredPPE: [
      "ANSI Z87.1 Approved Eye Protection with Side Shields",
      "Hearing Protection (Earmuffs or NRR 25+ Earplugs)",
      "Closed-Toe Leather / Work Shoes",
      "Fitted Short Sleeves or Rolled-Up Sleeves",
    ],
    prohibitedItems: [
      "NO Gloves of ANY type (severe rotational entanglement hazard)",
      "NO Loose Hoodies, Drawstrings, Ties, or Baggy Clothing",
      "NO Necklaces, Rings, Watches, or Dangling Jewelry",
      "NO Untied Hair (all hair past collar must be securely bunned back)",
    ],
    preOperationalChecks: [
      "Verify stock is rigidly clamped down with double T-track clamps or screwed spoilboard hold-downs; test for zero deflection.",
      "Check collet and endmill for chips, cracks, or pitch buildup; torque ER20 collet nut to proper spec (do not overtighten).",
      "Ensure work coordinate origin (X0, Y0, Z0) is probed correctly using the touch plate with grounded clip attached.",
      "Inspect toolpath simulation in CAM / G-code sender; confirm zero rapid-traverse collisions and clear clamp keep-out zones.",
      "Verify vacuum dust collection is running and the emergency E-Stop button is within immediate reach.",
    ],
    operatingRules: [
      "Never leave the CNC router unattended while the spindle is spinning or executing G-code.",
      "Maintain a 36-inch safety perimeter around the machine bed; spectators must remain behind safety barrier line.",
      "Keep hands completely outside the enclosure during spindle rotation; never touch moving swarf or vacuum chips manually.",
      "If you hear chatter, screeching, or smell burning material, hit FEED HOLD or E-STOP immediately.",
    ],
    postOperationalCleanup: [
      "Wait for the spindle to come to a complete, absolute stop before opening enclosure or reaching into the bed.",
      "Vacuum all aluminum swarf and polycarbonate chips from rails, lead screws, and spoilboard into metal chip bin.",
      "Carefully remove endmill with collet wrench and store bit in protective casing.",
      "Wipe down linear guide rails and turn off main controller power.",
    ],
    emergencyShutdown: "Slap the large red mushroom E-STOP button located on the front control panel. Spindle power and stepper drives will immediately de-energize.",
    quizQuestions: [
      {
        id: "cnc-q1",
        question: "Why is wearing gloves strictly prohibited when operating the CNC router or milling machine?",
        options: [
          "Gloves get dirty from aluminum cutting fluid",
          "Gloves can be caught by the 24,000 RPM rotating spindle and pull hands into the cutting bit (entanglement hazard)",
          "Gloves reduce tactile grip on plastic wrenches",
          "Gloves trap static electricity that corrupts G-code",
        ],
        correctIndex: 1,
        explanation: "Rotating tools create severe entanglement hazards. Fabric or leather gloves will not slip off; they will pull the operator's fingers and hand directly into the rotating bit in milliseconds.",
        criticalCategory: "Entanglement Prevention",
      },
      {
        id: "cnc-q2",
        question: "What must you verify before starting a high-speed CNC cutting job?",
        options: [
          "The shop music volume is loud enough to hear over the router",
          "Workpiece clamping rigidity, correct Z-zero probe, clamp clearance in CAM simulation, and dust collection active",
          "The coolant reservoir is filled with tap water",
          "The feed rate is set to 200% maximum override",
        ],
        correctIndex: 1,
        explanation: "Loose stock can fly off the bed at lethal speeds, incorrect Z-zero will plunge the spindle into the table, and colliding with metal clamps will destroy carbide bits and create shrapnel.",
        criticalCategory: "Pre-Flight Verification",
      },
      {
        id: "cnc-q3",
        question: "What is the proper immediate action if a CNC endmill starts screeching or smoking during a polycarbonate cut?",
        options: [
          "Reach inside with pliers to clear melted plastic while the spindle runs",
          "Hit the Emergency Stop (E-Stop) or Feed Hold button immediately",
          "Spray water from a water bottle directly at the spinning bit",
          "Wait for the G-code program to finish the current contour",
        ],
        correctIndex: 1,
        explanation: "Never place hands inside the machine envelope while the tool is spinning. Hitting E-Stop immediately stops power and avoids tool breakage, fire, or spindle damage.",
        criticalCategory: "Emergency Response",
      },
    ],
  },
  {
    id: "3d-printers",
    name: "3D Printers (FDM & SLA Resin)",
    shortName: "3D Printers",
    category: "Additive & Polymers",
    hazardLevel: "Moderate",
    iconName: "Layers",
    description: "Additive manufacturing cluster comprising high-temperature FDM (PLA/PETG/Nylon-CF) and UV photopolymer SLA resin printers.",
    requiredPPE: [
      "ANSI Z87.1 Safety Glasses (required during spatula scraping and SLA post-processing)",
      "Nitrile Gloves (MANDATORY when handling liquid SLA photopolymer resin or IPA wash tanks)",
      "Vapor-Rated Half-Mask Respirator (when using open SLA resin in unventilated areas)",
      "Heat-Resistant Gloves (when changing hot FDM nozzles at 280°C)",
    ],
    prohibitedItems: [
      "NO bare skin contact with uncured photopolymer liquid resin (sensitizer hazard)",
      "NO disposing of uncured resin down sewer sinks or drains",
      "NO touching heated FDM heatbed (60-100°C) or hotend (200-300°C) with bare fingers",
      "NO scraping prints towards your body or free hand",
    ],
    preOperationalChecks: [
      "FDM: Verify print bed is clean, free of residual plastic, and nozzle has no debris encrustation.",
      "FDM: Check filament path for tangles and verify spool is rotating freely without binding.",
      "SLA: Inspect resin VAT FEP film for punctures, wrinkles, or cured debris; ensure build plate is locked down securely.",
      "SLA: Ensure UV hood enclosure is closed and exhaust carbon filter fan is powered on.",
    ],
    operatingRules: [
      "Always scrape prints AWAY from your hands, fingers, and body using rounded spatula tools.",
      "Keep IPA (Isopropyl Alcohol 99%) wash containers closed and away from open sparks, soldering irons, or heat guns.",
      "Never open SLA UV cover while UV LED exposure layer is curing.",
      "Cure all resin-contaminated paper towels, gloves, and rinse water under UV light before disposing of as solid waste.",
    ],
    postOperationalCleanup: [
      "Clean FDM nozzle with brass wire brush while at standby temperature.",
      "Wash SLA prints in dedicated sealed ultrasonic/vortex IPA station, then complete UV post-cure cycle.",
      "Wipe down resin workstation using IPA and dispose of all nitrile gloves in hazmat solid cure bin.",
      "Turn off heated beds and park print heads after cooling below 50°C.",
    ],
    emergencyShutdown: "Flip the rear rocker power switch or disconnect main AC wall power plug to instantly kill heater cartridges and stepper motors.",
    quizQuestions: [
      {
        id: "3d-q1",
        question: "When handling liquid SLA photopolymer resin and Isopropyl Alcohol (IPA) wash tanks, what PPE is mandatory?",
        options: [
          "Leather welding gloves and steel-toe boots",
          "Nitrile gloves and ANSI Z87.1 safety glasses with side shields",
          "Cotton gardening gloves",
          "No PPE is needed for non-toxic 3D printing",
        ],
        correctIndex: 1,
        explanation: "Liquid photopolymer resin contains acrylate monomers that are severe dermal sensitizers and ocular irritants. Nitrile gloves and eye protection prevent chemical absorption and splash injuries.",
        criticalCategory: "Chemical Safety",
      },
      {
        id: "3d-q2",
        question: "What is the primary rule when using a metal spatula to remove a stubborn print from a build plate?",
        options: [
          "Apply maximum force directly towards your holding hand",
          "Heat the spatula with an open blowtorch first",
          "Always scrape away from your body and keep your free hand behind the cutting edge",
          "Hit the side of the glass plate with a claw hammer",
        ],
        correctIndex: 2,
        explanation: "Spatula slippage is the leading cause of puncture lacerations in 3D printing labs. Always direct the blade away from your body and never place hands in the blade's slip path.",
        criticalCategory: "Tool Handling Safety",
      },
    ],
  },
  {
    id: "drill-press",
    name: "Floor & Benchtop Drill Press",
    shortName: "Drill Press",
    category: "Cutting & Shaping",
    hazardLevel: "High",
    iconName: "Disc",
    description: "Vertical spindle drill press for drilling, reaming, and counterboring aluminum tube, channel, and Delrin bushings.",
    requiredPPE: [
      "ANSI Z87.1 Approved Safety Glasses / Goggles (mandatory)",
      "Hearing Protection when drilling thick metal",
      "Closed-Toe Sturdy Footwear",
      "Hair Secured Tightly Above Collar",
    ],
    prohibitedItems: [
      "ABSOLUTELY NO GLOVES (extreme rotating chuck entanglement hazard)",
      "NO Holding Sheet Metal or Small Workpieces by Bare Hand (spinning 'helicopter' blade hazard)",
      "NO Leaving Chuck Key in the Drill Chuck",
      "NO Long Sleeves, Scarves, Neckties, or Hanging Jewelry",
    ],
    preOperationalChecks: [
      "Ensure the chuck key is REMOVED from the chuck before powering on.",
      "Secure workpiece in a drill press vise or clamp it firmly to the slotted cast-iron table using C-clamps or step blocks.",
      "Check belt pulley speed setting: Slow RPM for large bits and steel/aluminum; Faster RPM for tiny bits and plastics.",
      "Verify drill bit is sharp, centered, and tightened evenly across all three chuck holes.",
    ],
    operatingRules: [
      "Center-punch all hole locations to prevent drill bit walking and bending.",
      "Apply steady, smooth downward quill feed; ease off pressure when the drill bit breaks through the underside.",
      "Use cutting wax or aluminum lubricant (WD-40/Boelube) to prevent aluminum chip welding.",
      "Never attempt to stop a spinning chuck with your hands or rag.",
    ],
    postOperationalCleanup: [
      "Turn off the power switch and wait for the spindle to come to a complete standstill.",
      "Use a bench brush or vacuum to sweep sharp metal swarf; never wipe swarf with bare hands.",
      "Remove drill bit, wipe clean, and return to proper drill index drawer.",
      "Wipe oil residue from cast-iron table and lower quill to rest position.",
    ],
    emergencyShutdown: "Press the large front red Stop paddle switch. If the workpiece binds and spins, step back immediately and cut power.",
    quizQuestions: [
      {
        id: "dp-q1",
        question: "Why is holding a piece of sheet metal with bare hands while drilling strictly forbidden?",
        options: [
          "The sheet metal might get fingerprints on it",
          "If the drill bit grabs the material, the sheet metal will spin violently like a rotating knife blade ('helicopter hazard') and sever tendons",
          "Holding metal vibrates too loudly",
          "The metal gets cold from the airflow",
        ],
        correctIndex: 1,
        explanation: "Drill bits frequently catch when breaking through the bottom of metal. Unclamped metal spins at spindle speed (1,000+ RPM), creating a lethal rotating blade that can cause amputations.",
        criticalCategory: "Workpiece Clamping Safety",
      },
      {
        id: "dp-q2",
        question: "What must be removed immediately after tightening or loosening a drill bit in the chuck?",
        options: [
          "The table clamp",
          "The chuck key",
          "The safety glasses",
          "The motor belt",
        ],
        correctIndex: 1,
        explanation: "Leaving the chuck key in the chuck turns it into a high-velocity projectile the moment the motor is switched on.",
        criticalCategory: "Pre-Flight Verification",
      },
    ],
  },
  {
    id: "horizontal-bandsaw",
    name: "Horizontal & Vertical Metal Bandsaw",
    shortName: "Metal Bandsaw",
    category: "Cutting & Shaping",
    hazardLevel: "High",
    iconName: "Scissors",
    description: "Continuous bi-metal toothed loop blade for cutting aluminum extrusion, round shafts, threaded rod, and composite stock.",
    requiredPPE: [
      "ANSI Z87.1 Safety Glasses with Side Shields",
      "Hearing Protection",
      "Sturdy Closed-Toe Work Shoes",
      "Snug-fitting clothing with sleeves rolled up past elbows",
    ],
    prohibitedItems: [
      "NO Gloves while operating in vertical push-cut mode near exposed blade",
      "NO Cutting round stock without clamping in horizontal vise (rolls and strips teeth)",
      "NO Cutting material shorter than vise clamp jaw width without spacer blocks",
      "NO Forcing down horizontal saw arm faster than hydraulic damper allows",
    ],
    preOperationalChecks: [
      "Check blade tension and inspect for missing or stripped bi-metal carbide teeth.",
      "Verify blade guides are adjusted close to the workpiece (within 1/2 inch) to minimize exposed blade flex.",
      "Confirm vise is clamping the stock square and locked tight against fixed jaw.",
      "Ensure coolant pump or drip oiler is flowing if cutting thick solid billet.",
    ],
    operatingRules: [
      "Horizontal cut: Lower the saw head gently until blade touches stock, then let gravity and hydraulic feed regulate downward pace.",
      "Vertical cut: Keep fingers at least 4 inches away from blade path; use push stick for narrow stock.",
      "Support long protruding stock on roller stands to prevent tip-over and blade binding.",
      "Never reach across or under the moving saw blade.",
    ],
    postOperationalCleanup: [
      "Wait for blade to come to a full stop before unlocking vise and removing cut parts.",
      "Deburr sharp cut edges immediately with a metal file or rotary deburring tool.",
      "Brush metal filings into chip tray; do not blow chips with compressed air (flying ocular hazard).",
      "Raise horizontal bow to parked locked position.",
    ],
    emergencyShutdown: "Hit the red E-STOP button on the motor housing, or trip the automatic shut-off limit switch.",
    quizQuestions: [
      {
        id: "bs-q1",
        question: "How should long pieces of aluminum extrusion extending outside the bandsaw vise be supported?",
        options: [
          "Let them hang freely onto the floor",
          "Have another student hold them loosely with one hand while chatting",
          "Support them with an adjustable roller stand aligned with the vise table",
          "Tie them to the ceiling with zip ties",
        ],
        correctIndex: 2,
        explanation: "Unbalanced long stock creates leverage that tilts the stock in the vise, binding the blade, damaging the saw, or dropping heavy metal onto operators' feet.",
        criticalCategory: "Material Handling",
      },
      {
        id: "bs-q2",
        question: "When using the bandsaw in vertical table mode, what is the minimum safe distance for fingers from the blade?",
        options: [
          "1/4 inch",
          "At least 4 inches (use a wooden push stick for smaller parts)",
          "1 millimeter",
          "Any distance as long as you wear thick gloves",
        ],
        correctIndex: 1,
        explanation: "Keep hands at least 4 inches from the blade. For small cuts, always use a push stick. Gloves are never a substitute and add entanglement hazards.",
        criticalCategory: "Operator Safety",
      },
    ],
  },
  {
    id: "soldering-station",
    name: "Soldering & Heat Gun Station",
    shortName: "Soldering Station",
    category: "Electronics & Wiring",
    hazardLevel: "Moderate",
    iconName: "Flame",
    description: "Temperature-controlled soldering irons (350-400°C) and heat guns (600°C) for XT30/Anderson Powerpole wiring, PCB repair, and heatshrink insulation.",
    requiredPPE: [
      "ANSI Z87.1 Safety Glasses (hot solder splashes easily from flexed wire tension)",
      "High-Density Heat-Resistant Silicone Mat on Worksurface",
      "Lead-Free Solder (or wash hands thoroughly after leaded alloy handling)",
    ],
    prohibitedItems: [
      "NO Eating or drinking at or near the electronics workbench",
      "NO Leaving hot soldering iron unattended or resting on wood/plastic tables",
      "NO Inhaling rosin flux smoke (keep fume extractor nozzle within 4 inches)",
      "NO Pointing heat gun at wires near LiPo battery terminals",
    ],
    preOperationalChecks: [
      "Verify the soldering iron is seated securely in its spring wire holder stand.",
      "Check that the solder fume extractor or carbon fan filter is turned on and positioned near the joint.",
      "Dampen the brass wire wool or cleaning sponge.",
      "Inspect iron cord for thermal burn damage or exposed wiring.",
    ],
    operatingRules: [
      "Tin the iron tip before and after every soldering session to prevent tip oxidation.",
      "Heat the wire joint first, then feed solder to the heated wire — not directly to the iron tip.",
      "Never flick excess hot liquid solder off the iron; wipe it gently on brass wool.",
      "When using heat gun for heatshrink tubing, use silicone tweezers or needle-nose pliers to hold wires, never bare fingers.",
    ],
    postOperationalCleanup: [
      "Turn off the power switch on the soldering station and heat gun.",
      "Tin the tip with fresh solder to protect against oxidation during cool down.",
      "Allow iron to cool down in its metal holder for at least 15 minutes before storage.",
      "Wipe benchtop and wash hands thoroughly with soap and water before eating.",
    ],
    emergencyShutdown: "Turn off the soldering station power toggle or unplug the master power strip switch.",
    quizQuestions: [
      {
        id: "sold-q1",
        question: "Why must eye protection (safety glasses) be worn while soldering robot wiring harnesses?",
        options: [
          "To look professional in the pit area",
          "Tensioned wires can snap back and fling molten 350°C solder or flux splatters directly into eyes",
          "To block UV radiation from solder sparks",
          "Safety glasses are only optional if using lead-free solder",
        ],
        correctIndex: 1,
        explanation: "When soldering stranded wire, spring tension in the wire or flux boil can pop molten solder droplets at high velocity. Eye protection is mandatory.",
        criticalCategory: "PPE Compliance",
      },
      {
        id: "sold-q2",
        question: "What must you do after finishing soldering with rosin-core solder before eating or drinking?",
        options: [
          "Just wipe hands on your pants",
          "Wash hands thoroughly with soap and warm water",
          "Use hand sanitizer only",
          "Nothing is required",
        ],
        correctIndex: 1,
        explanation: "Solder alloys and flux chemicals leave residues on skin. Washing hands thoroughly with soap prevents accidental chemical ingestion.",
        criticalCategory: "Toxic Exposure Control",
      },
    ],
  },
  {
    id: "lipo-depot",
    name: "LiPo Battery Charging & Power Depot",
    shortName: "LiPo Depot",
    category: "Power & Energy Storage",
    hazardLevel: "Critical",
    iconName: "BatteryCharging",
    description: "Multi-channel balance chargers, REV 12V Slim Batteries, and 3S/4S Lithium-Polymer packs powering FTC robots and testing equipment.",
    requiredPPE: [
      "Safety Glasses with Side Shields",
      "Fire-Resistant LiPo Safe Charging Bags / Steel Ammo Bunker Box",
      "Insulated Terminal Covers for all stored packs",
    ],
    prohibitedItems: [
      "NO Charging puffy, punctured, dropped, or physically dented batteries",
      "NO Leaving batteries charging unattended overnight or while workshop is locked",
      "NO Charging on combustible surfaces (wood desks, cardboard, carpet)",
      "NO Exceeding manufacturer C-rate (never charge FTC 3000mAh packs above 3.0A)",
    ],
    preOperationalChecks: [
      "Inspect battery pack casing: Check for any swelling, punctures, split heatshrink, or exposed wires.",
      "Verify charger chemistry mode is set correctly to 'LiPo 3S (11.1V)' or 'NiMH' matching pack chemistry.",
      "Plug in both the main discharge lead AND the white multi-pin JST-XH balance lead.",
      "Confirm battery is enclosed inside a flame-retardant fiberglass LiPo Safe bag or metal bunker.",
    ],
    operatingRules: [
      "Always balance-charge lithium batteries so individual cell voltages stay equal within 0.02V (max 4.20V/cell).",
      "If a battery becomes warm/hot to the touch or starts swelling, abort charging immediately.",
      "Store batteries at storage voltage (3.80V-3.85V per cell) if not being used within 48 hours.",
      "Maintain a dedicated Class D / Sand Bucket and fire extinguisher within 10 feet of the charging depot.",
    ],
    postOperationalCleanup: [
      "Disconnect battery from charger before turning off charger power.",
      "Install protective plastic end caps over XT30/Anderson connectors to prevent accidental short circuits in transport.",
      "Place fully charged batteries in the 'READY TO RUN' marked steel bin.",
      "Quarantine any damaged packs in the outdoor fireproof sand bunker.",
    ],
    emergencyShutdown: "Unplug the master AC charging strip power cord from wall without touching the burning pack; alert workshop immediately.",
    quizQuestions: [
      {
        id: "lipo-q1",
        question: "What is the very first action if a LiPo battery begins puffing, hissing, or venting smoke during charging?",
        options: [
          "Pour cold tap water directly into the charger",
          "Immediately disconnect the main AC power strip from the wall if safe to do so, alert everyone to evacuate the smoke zone, and quarantine pack in sand bucket",
          "Pick up the burning battery with bare hands and throw it in the trash can",
          "Put tape over the swollen battery to hold it together",
        ],
        correctIndex: 1,
        explanation: "Disconnecting AC power stops electrical overdrive. The toxic vapor fumes contains hydrofluoric acid and require immediate ventilation/evacuation and smothering in a sand bucket.",
        criticalCategory: "Thermal Runaway Emergency",
      },
      {
        id: "lipo-q2",
        question: "What is the maximum safe charging current for a standard 3000mAh (3.0Ah) robot battery at 1C rate?",
        options: [
          "10.0 Amps",
          "3.0 Amps",
          "0.1 Amps",
          "30.0 Amps",
        ],
        correctIndex: 1,
        explanation: "1C charge rate for a 3000mAh capacity pack is 3.0 Amps. Charging at higher currents creates excess internal resistance heat and risks thermal runaway fire.",
        criticalCategory: "Battery Chemistry Management",
      },
    ],
  },
];

export const EMERGENCY_PROCEDURES: EmergencyProcedureSection[] = [
  {
    id: "eyewash",
    title: "Emergency Eyewash Station Protocol",
    subtitle: "Immediate response for swarf, chemical splash, resin, or foreign particulates in eyes.",
    iconName: "Eye",
    priorityLevel: "Critical",
    criticalAlert: "FLUSH CONTINUOUSLY FOR A FULL 15 MINUTES. DO NOT DELAY FOR MEDICAL FORMS.",
    guidelines: [
      "Immediately shout for help and guide the affected student to the eyewash station near the workshop sink.",
      "Push the large yellow/silver activation paddle with your palm to initiate continuous dual aerated water flow.",
      "Hold both eyelids wide open with clean fingers; roll eyes left, right, up, and down continuously in the water stream.",
      "If contact lenses are worn, flush eyes immediately and remove lenses once lubricated during the wash.",
      "Designate a team member to notify the adult Mentor/Coach and consult the chemical SDS sheet.",
      "After 15 minutes of continuous flushing, cover eyes with sterile gauze and seek professional medical evaluation.",
    ],
    subsections: [
      {
        heading: "Inspection & Testing Schedule",
        items: [
          "Weekly functional flush check logged on the yellow inspection tag.",
          "Clear 36-inch radius pathway maintained in front of station at all times (no boxes or carts).",
          "Verify protective dust covers pop off automatically under water pressure.",
        ],
      },
    ],
  },
  {
    id: "fire-extinguishers",
    title: "Fire Extinguisher Classes & P.A.S.S. Method",
    subtitle: "Rapid suppression hierarchy for workshop combustibles, electronics, and lithium batteries.",
    iconName: "Flame",
    priorityLevel: "Critical",
    criticalAlert: "IF FIRE EXCEEDS THE SIZE OF A TRASH CAN OR EVOLVES THICK TOXIC SMOKE: EVACUATE & CALL 911.",
    guidelines: [
      "Confirm you have an unobstructed exit behind you before attempting to fight any small fire.",
      "Deploy the P.A.S.S. technique with smooth, steady hand movements.",
      "Never turn your back on an extinguished fire; watch for reignition.",
    ],
    subsections: [
      {
        heading: "The P.A.S.S. Technique",
        items: [
          "P — PULL the safety pin breaking the plastic tamper seal ring.",
          "A — AIM low, pointing the nozzle or horn at the base of the fire (not flames).",
          "S — SQUEEZE the discharge lever slowly and evenly from 6-8 feet away.",
          "S — SWEEP the nozzle side-to-side across the base until fire is completely dead.",
        ],
      },
      {
        heading: "Extinguisher Class Matrix",
        items: [
          "Class ABC (Dry Chemical): Wood, paper, 3D print filament, electrical chassis.",
          "Class CO2 (Carbon Dioxide): Energized electronics, robot control hubs (no corrosive residue).",
          "Class D / Heavy Sand Bucket: Lithium metal, severe thermal runaway containment.",
        ],
      },
    ],
  },
  {
    id: "lipo-thermal-runaway",
    title: "Lithium Battery Thermal Runaway Emergency",
    subtitle: "Action plan for swollen, smoking, venting, or burning lithium-based battery packs.",
    iconName: "BatteryCharging",
    priorityLevel: "Urgent",
    criticalAlert: "NEVER INHALE FUMES. LITHIUM ELECTROLYTE RELEASES HYDROFLUORIC ACID (HF) GAS.",
    guidelines: [
      "STOP charging or discharging immediately by killing master power from the wall.",
      "Alert the workshop with the verbal callout: 'SAFETY ALL-STOP: LIPO INCIDENT!'.",
      "If safe to touch with welding gloves/tongs, transfer pack into the heavy steel LiPo bunker or sand bucket.",
      "Smother burning cells under at least 4 inches of dry play sand to cut off oxygen and absorb radiant heat.",
      "Evacuate everyone from the fume dispersion zone; open exterior bay doors for high-volume cross-ventilation.",
      "Quarantine the submerged battery outdoors in an open-air metal drum for at least 48 hours before disposal.",
    ],
    subsections: [
      {
        heading: "Thermal Runaway Warning Signs",
        items: [
          "Sudden ballooning / pillowing of the battery pouch casing.",
          "Rapid temperature increase (pack too hot to comfortably hold).",
          "Hissing, whistling, popping sounds, or sweet chemical odor.",
          "Jet flame or dense white/grey smoke ejecting from cell seams.",
        ],
      },
    ],
  },
  {
    id: "injury-reporting",
    title: "Zero-PII Incident Reporting & First Aid",
    subtitle: "Standardized triage, first aid administration, and non-identifying root-cause logging.",
    iconName: "ShieldAlert",
    priorityLevel: "Standard",
    criticalAlert: "ALL INJURIES MUST BE REPORTED TO COACHES REGARDLESS OF SEVERITY.",
    guidelines: [
      "Level 1 (Minor Scratch/Burn): Clean with antiseptic, apply sterile bandage from First Aid Kit, rest.",
      "Level 2 (Deep Laceration/Foreign Object): Apply direct pressure with sterile trauma pad; elevate; notify Coach; seek urgent care.",
      "Level 3 (Severe Trauma/Head Injury/Arterial Bleed): Call 911 immediately. Direct emergency EMS to door.",
      "Fill out the ARES Workshop Safety Incident Form using student callsigns (Zero-PII compliance).",
      "Conduct a 5-minute team safety stand-down to inspect the tool and prevent recurrence before resuming work.",
    ],
    subsections: [
      {
        heading: "Zero-PII Incident Record Fields",
        items: [
          "Incident ID & Timestamp (YYYY-MM-DD HH:MM)",
          "Machine Tool or Subsystem Involved (e.g., CNC Router, Bandsaw)",
          "Mechanics of Failure (e.g., clamp slippage, lack of push stick, improper feed rate)",
          "Corrective Action & Tool Lockout Status (e.g., blade replaced, training revised)",
          "Strict Privacy: No minor student names, emails, phone numbers, or health records are recorded.",
        ],
      },
    ],
  },
];

/**
 * Sanitizes an anonymous student callsign to prevent PII injection.
 */
export function sanitizeCallsign(rawInput: string): string {
  if (!rawInput) return "Mountaineer-Safety-Lead";
  
  // Strip emails, phone numbers, HTML tags, scripts, and non-alphanumeric chars (keep hyphens and underscores)
  const stripped = rawInput
    .replace(/<[^>]*>/g, "")
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "")
    .replace(/\d{7,15}/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!stripped || stripped.length < 2) {
    return "Mountaineer-Safety-Lead";
  }

  return stripped.slice(0, 28);
}

/**
 * Evaluates quiz answers for a single machine tool.
 */
export function verifyQuizAnswers(
  machineId: string,
  selectedAnswers: Record<string, number>
): QuizEvaluationResult {
  const machine = WORKSHOP_MACHINES.find((m) => m.id === machineId);
  if (!machine) {
    return {
      machineId,
      passed: false,
      score: 0,
      totalQuestions: 0,
      incorrectQuestionIds: [],
      feedback: [],
    };
  }

  let correctCount = 0;
  const incorrectQuestionIds: string[] = [];
  const feedback = machine.quizQuestions.map((q) => {
    const userAnswer = selectedAnswers[q.id];
    const isCorrect = userAnswer === q.correctIndex;
    if (isCorrect) {
      correctCount++;
    } else {
      incorrectQuestionIds.push(q.id);
    }
    return {
      questionId: q.id,
      isCorrect,
      explanation: q.explanation,
    };
  });

  const totalQuestions = machine.quizQuestions.length;
  // 100% score required to earn machine qualification
  const passed = totalQuestions > 0 && correctCount === totalQuestions;

  return {
    machineId,
    passed,
    score: correctCount,
    totalQuestions,
    incorrectQuestionIds,
    feedback,
  };
}

/**
 * Fast synchronous deterministic checksum generator for offline client verification.
 */
export function generateChecksum(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const combined = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return combined.toString(16).toUpperCase().padStart(12, "0");
}

/**
 * Generates an exportable, tamper-evident Safety Certification Record.
 */
export function generateCertificationRecord(
  rawCallsign: string,
  certifiedMachineIds: string[],
  issuedDateStr?: string
): SafetyCertificationRecord {
  const callsign = sanitizeCallsign(rawCallsign);
  const now = issuedDateStr ? new Date(issuedDateStr) : new Date("2026-08-14T12:00:00Z");
  const issuedAt = now.toISOString();

  // Expiration is 1 year from issue
  const expDate = new Date(now.getTime());
  expDate.setFullYear(expDate.getFullYear() + 1);
  const expiresAt = expDate.toISOString();

  const sortedMachines = [...certifiedMachineIds].sort();
  const totalQualified = sortedMachines.length;
  const isFullyCertified = totalQualified === WORKSHOP_MACHINES.length;

  const rawPayload = `ARES23247-SAFETY-v1:${callsign}:${sortedMachines.join(",")}:${totalQualified}:${isFullyCertified ? 1 : 0}:${issuedAt}:${expiresAt}`;
  const checksum = `ARES-CERT-${generateChecksum(rawPayload)}`;
  const recordId = `QUAL-${generateChecksum(callsign + ":" + issuedAt).slice(0, 8)}`;

  return {
    recordId,
    callsign,
    issuedAt,
    expiresAt,
    certifiedMachineIds: sortedMachines,
    totalQualified,
    isFullyCertified,
    checksum,
    version: "1.0.0-2026",
  };
}

/**
 * Verifies if a certification record's checksum is authentic and un-tampered.
 */
export function verifyCertificationChecksum(record: SafetyCertificationRecord): boolean {
  if (!record || !record.checksum || !record.callsign || !record.issuedAt) return false;
  const sortedMachines = [...record.certifiedMachineIds].sort();
  const rawPayload = `ARES23247-SAFETY-v1:${record.callsign}:${sortedMachines.join(",")}:${record.totalQualified}:${record.isFullyCertified ? 1 : 0}:${record.issuedAt}:${record.expiresAt}`;
  const expectedChecksum = `ARES-CERT-${generateChecksum(rawPayload)}`;
  return record.checksum === expectedChecksum;
}
