export interface OpenHardwarePart {
  id: string;
  title: string;
  category: "Odometry & Sensors" | "Intake & Mechanisms" | "Electronics & Power" | "Cable Management";
  description: string;
  recommendedMaterial: "PETG" | "PLA / PLA+" | "TPU 95A" | "ABS / ASA";
  infillPercent: number;
  perimeters: number;
  features: string[];
  printablesUrl: string;
}

export const OPEN_HARDWARE_PARTS: OpenHardwarePart[] = [
  {
    id: "pinpoint-odometry-mount",
    title: "Pinpoint Precision Dead-Wheel Odometry Pod",
    category: "Odometry & Sensors",
    description: "Ultra-compact sprung dead-wheel pod designed for goBILDA and REV channel mounting, maximizing ground contact and encoder consistency during high-speed autonomous runs.",
    recommendedMaterial: "PETG",
    infillPercent: 40,
    perimeters: 4,
    features: ["Spring-tensioned ground contact", "Zero-backlash bearing pocket", "Standard 8mm / 16mm pattern"],
    printablesUrl: "https://www.printables.com/@ARESFTC_3784306",
  },
  {
    id: "tpu-compliant-intake-roller",
    title: "TPU 95A Compliant Star Intake Roller",
    category: "Intake & Mechanisms",
    description: "High-traction compliant intake roller engineered with internal void pockets for progressive compression, allowing rapid acquisition of game elements without motor stall.",
    recommendedMaterial: "TPU 95A",
    infillPercent: 20,
    perimeters: 3,
    features: ["Progressive grip compression", "Direct 1/2-inch hex shaft fit", "Durable tear-resistant TPU geometry"],
    printablesUrl: "https://www.printables.com/@ARESFTC_3784306",
  },
  {
    id: "rev-control-hub-bracket",
    title: "REV Control Hub Quick-Release Isolation Mount",
    category: "Electronics & Power",
    description: "Vibration-dampened mounting bracket for REV Robotics Control Hub and Expansion Hub with integrated zip-tie channels and active cooling ventilation.",
    recommendedMaterial: "PETG",
    infillPercent: 35,
    perimeters: 4,
    features: ["Impact shock isolation", "Thermal airflow channels", "Quick-access USB / power ports"],
    printablesUrl: "https://www.printables.com/@ARESFTC_3784306",
  },
  {
    id: "limelight-apriltag-mount",
    title: "Adjustable 25°/35° Vision Camera & Sensor Mount",
    category: "Odometry & Sensors",
    description: "Rigid, vibration-free camera mount calibrated for AprilTag detection angles and low-latency target locking during autonomous and teleop alignment.",
    recommendedMaterial: "PETG",
    infillPercent: 50,
    perimeters: 4,
    features: ["Fixed precision tilt angles", "Reinforced mounting flange", "Lightweight hollowed structural ribbing"],
    printablesUrl: "https://www.printables.com/@ARESFTC_3784306",
  },
  {
    id: "xt30-sensor-wire-clips",
    title: "FTC Low-Profile XT30 & Sensor Strain Relief Clips",
    category: "Cable Management",
    description: "Snap-fit cable organizers that clip securely into standard extrusion slots, preventing connector disconnects and keeping sensor leads organized.",
    recommendedMaterial: "PETG",
    infillPercent: 100,
    perimeters: 3,
    features: ["Extrusion slot snap-fit", "XT30 lock-in strain relief", "Low mass (less than 2 grams)"],
    printablesUrl: "https://www.printables.com/@ARESFTC_3784306",
  },
];
