"use client";

import React, { useState, useId, useMemo } from "react";
import {
  Cpu,
  Zap,
  Activity,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Layers,
  Search,
  RotateCcw,
  CheckSquare,
  Info,
  Eye,
  Crosshair,
  Gauge,
  Workflow,
  ChevronRight,
  Flame,
  Cable
} from "lucide-react";
import { GreekMeander } from "@/components/GreekMeander";
import SEO from "@/components/SEO";

// --- WIRE RESISTANCE VALUES (Ohms per foot for annealed copper at 20°C) ---
export const WIRE_GAUGES: Record<string, { name: string; ohmsPerFoot: number; maxAmpsFTC: number; typicalUse: string }> = {
  "16 AWG": { name: "16 AWG", ohmsPerFoot: 0.004016, maxAmpsFTC: 20, typicalUse: "Heavy-duty 12V battery main feed & high-torque drive lines" },
  "18 AWG": { name: "18 AWG", ohmsPerFoot: 0.006385, maxAmpsFTC: 20, typicalUse: "FTC Mandatory standard for 12V Battery, Hubs, & DC Motors" },
  "20 AWG": { name: "20 AWG", ohmsPerFoot: 0.01015, maxAmpsFTC: 5, typicalUse: "Servo power distribution hubs, Limelight 5V buck feed" },
  "22 AWG": { name: "22 AWG", ohmsPerFoot: 0.01614, maxAmpsFTC: 2, typicalUse: "Sensors, I2C logic lines, Quad Encoders, Limit switches" },
};

// --- PRESET CALCULATIONS ---
export interface CalcPreset {
  label: string;
  gauge: string;
  lengthInches: number;
  currentAmps: number;
  supplyVoltage: number;
  description: string;
}

export const CALC_PRESETS: CalcPreset[] = [
  {
    label: 'Main 12V Battery to Hub (18 AWG, 14")',
    gauge: "18 AWG",
    lengthInches: 14,
    currentAmps: 18.0,
    supplyVoltage: 12.0,
    description: "Peak stall current draw on primary battery lead under rapid 4-motor acceleration."
  },
  {
    label: 'Drivetrain Motor Lead (18 AWG, 24")',
    gauge: "18 AWG",
    lengthInches: 24,
    currentAmps: 10.5,
    supplyVoltage: 12.0,
    description: "High-speed continuous transit load for mecanum drive motor channel."
  },
  {
    label: 'Limelight 3A Vision Line (20 AWG, 16")',
    gauge: "20 AWG",
    lengthInches: 16,
    currentAmps: 2.2,
    supplyVoltage: 5.0,
    description: "5V 3A buck regulator feed to Limelight 3A coprocessor running 90 FPS AprilTag pipeline."
  },
  {
    label: 'GoBILDA Servo Hub Feed (20 AWG, 18")',
    gauge: "20 AWG",
    lengthInches: 18,
    currentAmps: 4.5,
    supplyVoltage: 6.0,
    description: "Simultaneous multi-servo claw clamp and specimen wrist actuation rail."
  },
  {
    label: 'REV Color Sensor V3 (22 AWG, 28")',
    gauge: "22 AWG",
    lengthInches: 28,
    currentAmps: 0.04,
    supplyVoltage: 3.3,
    description: "3.3V I2C APDS-9960 color & proximity sensor telemetry line."
  },
  {
    label: 'Odometry Encoder Pod (22 AWG, 36")',
    gauge: "22 AWG",
    lengthInches: 36,
    currentAmps: 0.025,
    supplyVoltage: 5.0,
    description: "8192 CPR dead-wheel optical quadrature encoder 5V logic signal cable."
  }
];

// --- COMPONENT PINOUT DEFINITIONS ---
export interface PinDefinition {
  pin: number | string;
  name: string;
  color: string;
  wireHex: string;
  type: "Power" | "Ground" | "Signal" | "I2C" | "Analog" | "PWM" | "Differential";
  description: string;
}

export interface HardwareComponent {
  id: string;
  name: string;
  category: "Controllers" | "Power" | "Actuation" | "Vision & Sensors" | "Odometry";
  partNumber: string;
  voltage: string;
  maxCurrent: string;
  connectorType: string;
  icon: string;
  overview: string;
  electricalSpecs: Record<string, string>;
  pinout: PinDefinition[];
  ftcRules: string[];
  bestPractices: string[];
}

export const HARDWARE_COMPONENTS: HardwareComponent[] = [
  {
    id: "rev-control-hub",
    name: "REV Robotics Control Hub",
    category: "Controllers",
    partNumber: "REV-31-1595",
    voltage: "12.0V DC Nominal (9V - 15V operating range)",
    maxCurrent: "20.0A Peak System Total",
    connectorType: "XT30 (Power), JST-PH (I2C/Digital/Analog/RS485), JST-VH (Motors), 0.1\" Header (Servos), USB 2.0/3.0/Type-C",
    icon: "Cpu",
    overview: "The primary onboard computational and motor-control core for ARES #23247. Integrates an Android ARM processor running Qualcomm Snapdragon 410 with dedicated real-time coprocessors for motor PID velocity loops, 12V H-bridge power stages, servo PWM generation, and high-speed multi-bus sensor polling.",
    electricalSpecs: {
      "DC Motor Ports": "4x 12V H-Bridge (JST-VH + 4-pin JST-PH Encoder feedback)",
      "Servo Ports": "6x 5V/6V PWM Output (2.0A continuous internal rail total)",
      "I2C Buses": "4x Independent 3.3V I2C buses (Bus 0 - Bus 3)",
      "Digital I/O": "8x 3.3V Digital channels (2 per 4-pin JST-PH port)",
      "Analog Inputs": "4x 0-3.3V 12-bit ADC channels",
      "RS485 Port": "1x High-speed differential bus to Expansion Hub",
      "Communication": "Integrated 5GHz 802.11ac Wi-Fi Direct + USB 3.0 OTG Host"
    },
    pinout: [
      { pin: "12V IN+", name: "VBAT (+12V)", color: "Red", wireHex: "#ef4444", type: "Power", description: "Direct 12V fused battery input via XT30" },
      { pin: "12V IN-", name: "GND (0V)", color: "Black", wireHex: "#1e293b", type: "Ground", description: "System primary common ground return" },
      { pin: "RS485-A", name: "DATA+", color: "Yellow", wireHex: "#eab308", type: "Differential", description: "Differential non-inverting bus line to Expansion Hub" },
      { pin: "RS485-B", name: "DATA-", color: "Blue", wireHex: "#3b82f6", type: "Differential", description: "Differential inverting bus line to Expansion Hub" },
      { pin: "RS485-G", name: "BUS_GND", color: "Black", wireHex: "#1e293b", type: "Ground", description: "Common signal reference for differential transceiver" },
      { pin: "I2C Pin 1", name: "GND", color: "Black", wireHex: "#1e293b", type: "Ground", description: "3.3V Sensor ground" },
      { pin: "I2C Pin 2", name: "+3.3V VCC", color: "Red", wireHex: "#ef4444", type: "Power", description: "Regulated 3.3V bus power (Max 150mA per bus)" },
      { pin: "I2C Pin 3", name: "SDA", color: "Blue", wireHex: "#3b82f6", type: "I2C", description: "I2C Serial Data line (with internal 4.7kΩ pull-up)" },
      { pin: "I2C Pin 4", name: "SCL", color: "Yellow", wireHex: "#eab308", type: "I2C", description: "I2C Serial Clock line (up to 400 kHz Fast Mode)" }
    ],
    ftcRules: [
      "<RE06> Maximum one (1) Control Hub allowed per robot.",
      "<RE14> Must run official FIRST-approved FTC Robot Controller App.",
      "<RE03> Main 12V power path must be wired with 18 AWG minimum wire."
    ],
    bestPractices: [
      "Keep XT30 power connector retention clips tightly seated with vibration-resistant clips.",
      "Isolate RS485 communication lines from high-current motor lead runs to avoid EMI brownout resets.",
      "Mount vertically or with clear heatsink ventilation to ensure cooling during back-to-back finals matches."
    ]
  },
  {
    id: "rev-expansion-hub",
    name: "REV Robotics Expansion Hub",
    category: "Controllers",
    partNumber: "REV-31-1153",
    voltage: "12.0V DC Nominal (XT30 pass-through)",
    maxCurrent: "20.0A Peak Pass-Through",
    connectorType: "XT30 (Power In/Pass-through), RS485 Bus, JST-PH & JST-VH",
    icon: "Layers",
    overview: "Secondary actuation and sensing module daisy-chained to the Control Hub over a high-speed RS485 differential bus. Doubles available motor ports (giving 8 total across the robot) and provides dedicated servo, I2C, and quadrature encoder channels for intake mechanisms and specimen lifts.",
    electricalSpecs: {
      "DC Motor Ports": "4x 12V H-Bridge (Independent PID controllers)",
      "Servo Ports": "6x 5V/6V PWM Output channels",
      "I2C Buses": "4x Independent 3.3V I2C ports",
      "Digital / Analog": "8x Digital I/O and 4x 12-bit Analog input channels",
      "Power Link": "XT30 Daisy-Chain In/Out with low-resistance copper plane"
    },
    pinout: [
      { pin: "XT30-IN+", name: "12V VCC", color: "Red", wireHex: "#ef4444", type: "Power", description: "12V input from Control Hub XT30 auxiliary tap" },
      { pin: "XT30-IN-", name: "GND", color: "Black", wireHex: "#1e293b", type: "Ground", description: "Common ground return" },
      { pin: "RS485-A", name: "DIFF+", color: "Yellow", wireHex: "#eab308", type: "Differential", description: "RS485 Data+ linked to Control Hub" },
      { pin: "RS485-B", name: "DIFF-", color: "Blue", wireHex: "#3b82f6", type: "Differential", description: "RS485 Data- linked to Control Hub" },
      { pin: "M0+", name: "MOTOR 0 (+)", color: "White", wireHex: "#f8fafc", type: "Power", description: "12V PWM H-Bridge output for lift/slides" },
      { pin: "M0-", name: "MOTOR 0 (-)", color: "Black", wireHex: "#1e293b", type: "Power", description: "12V PWM H-Bridge return" }
    ],
    ftcRules: [
      "<RE06> Maximum one (1) Expansion Hub connected to Control Hub.",
      "<RE04> RS485 communication cable must not be spliced or modified."
    ],
    bestPractices: [
      "Use official 3-wire keyed JST-PH cable for RS485 with locking tab.",
      "Verify address 2 configuration in FTC Driver Station Hardware Configuration.",
      "Secure XT30 power jumper leads with heatshrink to avoid intermittent connection drops."
    ]
  },
  {
    id: "power-distribution-fuse",
    name: "12V Power Distribution & 20A Main Fuse Isolation",
    category: "Power",
    partNumber: "ARES-PWR-ISOLATION-V2",
    voltage: "12.0V - 12.6V DC (NiMH 10-cell pack)",
    maxCurrent: "20.0A Continuous (30A Inrush Trip Curve)",
    connectorType: "Anderson PowerPole 45A / XT30 High-Amp Connectors",
    icon: "Zap",
    overview: "The primary electrical safety isolation subsystem. Directs current from the 3000mAh NiMH slim battery through a mandatory 20A fast-acting blade fuse and a heavy-duty mechanical switch directly to the Control Hub. Ensures catastrophic motor stalls trip the fuse before battery damage or wire insulation thermal breakdown occurs.",
    electricalSpecs: {
      "Battery Pack": "12V 3000mAh 10-Cell NiMH (REV-31-1302 or Matrix)",
      "Main Fuse": "20A ATO/ATC Automotive Blade Fuse (Yellow casing)",
      "Switch Rating": "Heavy-duty SPST Rocker Rated for 20A @ 14V DC",
      "Ground Isolation": ">100 kΩ galvanic isolation between battery GND and robot frame",
      "Wiring Gauge": "16 AWG / 18 AWG Ultra-flexible Silicone Copper Cable"
    },
    pinout: [
      { pin: "BAT+", name: "BATT_POS", color: "Red", wireHex: "#ef4444", type: "Power", description: "Positive terminal from 12V 10-cell battery pack" },
      { pin: "FUSE-IN", name: "FUSE_LINE", color: "Red", wireHex: "#ef4444", type: "Power", description: "Input leg to 20A automotive blade fuse holder" },
      { pin: "FUSE-OUT", name: "FUSE_LOAD", color: "Red", wireHex: "#ef4444", type: "Power", description: "Protected output leg to Robot Main Power Switch" },
      { pin: "SW-LOAD", name: "SWITCHED_12V", color: "Red", wireHex: "#ef4444", type: "Power", description: "Switched 12V bus to REV Control Hub XT30 input" },
      { pin: "BAT-", name: "BATT_NEG", color: "Black", wireHex: "#1e293b", type: "Ground", description: "Direct common negative line to Control Hub XT30 ground" }
    ],
    ftcRules: [
      "<RE01> Exactly one (1) approved 12V battery pack may be connected.",
      "<RE03> Mandatory 20A fuse or circuit breaker must be installed in series on positive battery lead.",
      "<RE02> Robot main switch must be securely mounted and easily accessible to field referees."
    ],
    bestPractices: [
      "Carry spare 20A ATC fuses in pit toolbox and pre-match inspection pouch.",
      "Check blade fuse terminal socket tension every 3 matches to prevent vibration micro-arcing.",
      "Verify zero continuity (infinite resistance) between 12V ground and anodized aluminum chassis."
    ]
  },
  {
    id: "spark-mini-controllers",
    name: "SparkMINI / REV Spark Motor Controllers",
    category: "Actuation",
    partNumber: "REV-31-1230",
    voltage: "12.0V DC Operating Voltage",
    maxCurrent: "20.0A Peak / 15.0A Continuous",
    connectorType: "3-pin 0.1\" PWM Signal, Anderson PowerPole 12V In / Motor Out, Limit JST",
    icon: "Sliders",
    overview: "Compact brushed DC motor controller used to actuate secondary mechanisms such as active roller intakes and high-speed flywheel shooters. Accepts standard 1.0ms - 2.0ms PWM servo signals and provides bidirectional 12V H-bridge power modulation with built-in hardware limit-switch cutoff lines.",
    electricalSpecs: {
      "Control Signal": "Standard PWM (1000µs full reverse, 1500µs neutral, 2000µs full forward)",
      "PWM Frequency": "20 kHz ultrasonic quiet switching",
      "Protection": "Over-current foldback, reverse-polarity protection, thermal shutdown",
      "Limit Switch In": "2x Active-low inputs for forward and reverse physical limit switches"
    },
    pinout: [
      { pin: "PWM Pin 1", name: "PWM_GND", color: "Black", wireHex: "#1e293b", type: "Ground", description: "Logic ground reference from Hub servo port" },
      { pin: "PWM Pin 2", name: "VCC (NC)", color: "Red", wireHex: "#ef4444", type: "Power", description: "Unconnected on SparkMINI (powered by 12V rail)" },
      { pin: "PWM Pin 3", name: "PWM_SIG", color: "White", wireHex: "#f8fafc", type: "PWM", description: "1.0ms to 2.0ms pulse width modulation control line" },
      { pin: "PWR (+)", name: "12V_IN", color: "Red", wireHex: "#ef4444", type: "Power", description: "12V input from Hub motor channel or fused bus" },
      { pin: "PWR (-)", name: "GND_IN", color: "Black", wireHex: "#1e293b", type: "Ground", description: "High-current ground return" },
      { pin: "M+", name: "MOTOR (+)", color: "White", wireHex: "#f8fafc", type: "Power", description: "Motor armature terminal A" },
      { pin: "M-", name: "MOTOR (-)", color: "Black", wireHex: "#1e293b", type: "Power", description: "Motor armature terminal B" }
    ],
    ftcRules: [
      "<RE08> Motor controllers must be controlled via legitimate Hub PWM/Servo ports.",
      "<RE07> Total DC motor count across all Hubs/controllers cannot exceed eight (8)."
    ],
    bestPractices: [
      "Use 18 AWG silicone leads for all motor power connections.",
      "Calibrate PWM neutral deadband in OpMode initialization to prevent creep."
    ]
  },
  {
    id: "gobilda-servo-hub",
    name: "GoBILDA Servo Distribution Hub & Dual-Mode Servos",
    category: "Actuation",
    partNumber: "GOBILDA-3101-0001",
    voltage: "6.0V - 7.4V DC Regulated Rail",
    maxCurrent: "10.0A Peak Rail Total (2.8A Stall per Servo)",
    connectorType: "3-Pin 0.1\" Dupont / JR Keyed Connector",
    icon: "Workflow",
    overview: "High-torque multi-actuator distribution network powering ARES #23247's 5-DOF specimen collection arm, wrist pitch, and claw gripper. Features dedicated high-current power isolation from a 6V/7.4V BEC regulator with opto-isolated PWM signal routing from Control Hub servo ports 0-5.",
    electricalSpecs: {
      "Servo Torque": "300+ oz-in (21.6 kg-cm) at 7.4V on GoBILDA 2000 Series Dual-Mode Servos",
      "Pulse Range": "500µs (0°) to 2500µs (300° extended travel mode)",
      "Current Draw": "0.15A Idle, 1.2A Dynamic movement, 2.8A Full stall",
      "Bus Protection": "External 4700µF 16V low-ESR buffer capacitor bank to prevent voltage dips"
    },
    pinout: [
      { pin: "Pin 1", name: "GND", color: "Black / Brown", wireHex: "#78350f", type: "Ground", description: "Common ground return" },
      { pin: "Pin 2", name: "VCC (+6.0V / +7.4V)", color: "Red", wireHex: "#ef4444", type: "Power", description: "High-current regulated power feed" },
      { pin: "Pin 3", name: "PWM SIGNAL", color: "Yellow / Orange", wireHex: "#f97316", type: "PWM", description: "Position control signal (50Hz - 333Hz refresh rate)" }
    ],
    ftcRules: [
      "<RE11> Total servo actuators allowed per robot: up to twelve (12) standard servos.",
      "<RE12> Servo power must originate from REV Hub servo ports or approved FTC servo power modules."
    ],
    bestPractices: [
      "Use servo safety retention clips or heatshrink sleeves on all extensions to prevent disconnection during high-G collisions.",
      "Set software soft-limits in ARESLib to prevent mechanical stalling against hard stops, avoiding thermal fuse trips."
    ]
  },
  {
    id: "limelight-3a-vision",
    name: "Limelight 3A / OpenCV Vision Coprocessor Pipeline",
    category: "Vision & Sensors",
    partNumber: "LL-3A-AI",
    voltage: "5.0V DC (via dedicated 5V 3A Step-Down Buck Converter)",
    maxCurrent: "2.5A Peak during 90 FPS Neural Net Inference",
    connectorType: "USB-C (High-Speed Data & UVC stream) & 2-Pin Screw/JST 5V Power",
    icon: "Eye",
    overview: "The primary high-velocity perception pipeline for ARES #23247. Features a wide-angle 120° FOV global shutter sensor running onboard hardware-accelerated AprilTag (36h11 family) 3D pose estimation at 90 FPS, paired with OpenCV color thresholding and neural classifier pipelines for field sample tracking.",
    electricalSpecs: {
      "Camera Sensor": "Global Shutter Monochrome/RGB with integrated LED ring array",
      "Processing Latency": "Sub-12ms pipeline latency (Capture -> AprilTag Pose Estimation -> USB Telemetry)",
      "Communication": "High-Speed UVC / USB-CDC Serial stream directly into Qualcomm Control Hub",
      "Field Integration": "Dynamic 3D Robot Pose fused with Dead-Wheel Odometry via Unscented Kalman Filter (UKF)"
    },
    pinout: [
      { pin: "PWR 1", name: "5V_VCC", color: "Red", wireHex: "#ef4444", type: "Power", description: "5.0V regulated input from high-efficiency DC-DC buck converter" },
      { pin: "PWR 2", name: "GND", color: "Black", wireHex: "#1e293b", type: "Ground", description: "Common ground reference" },
      { pin: "USB-D+", name: "USB_DATA+", color: "Green", wireHex: "#22c55e", type: "Differential", description: "USB 2.0 / 3.0 High-Speed Data Plus" },
      { pin: "USB-D-", name: "USB_DATA-", color: "White", wireHex: "#f8fafc", type: "Differential", description: "USB 2.0 / 3.0 High-Speed Data Minus" },
      { pin: "SHIELD", name: "DRAIN_SHIELD", color: "Braid", wireHex: "#64748b", type: "Ground", description: "Braided EMI cable shield clamped to chassis drain point" }
    ],
    ftcRules: [
      "<RE15> External coprocessors allowed provided power is drawn from approved Hub or battery port.",
      "<RE16> No external light sources that blind human drive teams or other robots."
    ],
    bestPractices: [
      "Secure USB-C cable with 3D-printed strain relief bracket to prevent port wobble during high-speed turning.",
      "Keep 5V buck converter away from high-noise Spark motor leads to eliminate video signal ripple."
    ]
  },
  {
    id: "rev-color-sensor-v3",
    name: "REV Color Sensor V3 (I2C Bus APDS-9960)",
    category: "Vision & Sensors",
    partNumber: "REV-31-1557",
    voltage: "3.3V DC Regulated Logic",
    maxCurrent: "45mA Peak Active (LED on + IR Proximity Active)",
    connectorType: "4-Pin JST-PH (0.1\" pitch standard)",
    icon: "Crosshair",
    overview: "High-precision digital color and proximity sensor integrated into the robot intake claw. Combines an APDS-9960 advanced optical engine with RGB spectral sensing, ambient lux measurement, and an infrared proximity detector capable of millimeter-accurate sample detection (1cm - 10cm range).",
    electricalSpecs: {
      "I2C Address": "0x52 (7-bit address standard)",
      "Proximity Range": "1 cm to 10 cm with configurable IR LED pulse amplitude",
      "Spectral Channels": "Red, Green, Blue, and Clear (Broadband) with 16-bit ADC integration",
      "I2C Clock Speed": "Supported up to 400 kHz Fast-Mode I2C bus"
    },
    pinout: [
      { pin: "Pin 1", name: "GND", color: "Black", wireHex: "#1e293b", type: "Ground", description: "Common ground return" },
      { pin: "Pin 2", name: "+3.3V VCC", color: "Red", wireHex: "#ef4444", type: "Power", description: "Regulated 3.3V supply from Control Hub I2C port" },
      { pin: "Pin 3", name: "SDA", color: "Blue", wireHex: "#3b82f6", type: "I2C", description: "I2C Serial Data bidirectional line" },
      { pin: "Pin 4", name: "SCL", color: "Yellow", wireHex: "#eab308", type: "I2C", description: "I2C Serial Clock synchronization line" }
    ],
    ftcRules: [
      "<RE10> Sensors must operate on 3.3V or 5V logic powered solely through the REV Hub ports."
    ],
    bestPractices: [
      "Twist SDA/SCL lines with GND to minimize capacitive crosstalk along long extension cables.",
      "Avoid placing on the same I2C bus as other identical 0x52 address sensors (use separate Hub I2C ports 0-3)."
    ]
  },
  {
    id: "odometry-encoder-pods",
    name: "Odometry Dead-Wheel Optical Encoders",
    category: "Odometry",
    partNumber: "REV-11-1271 / GOBILDA-5202",
    voltage: "5.0V DC (Level-shifted from Hub Digital Ports)",
    maxCurrent: "25mA per Encoder Pod",
    connectorType: "4-Pin JST-PH / 0.1\" Level Shifter Header",
    icon: "Gauge",
    overview: "Precision unpowered dead-wheel tracking pods sprung against the foam competition tiles. Utilizes high-resolution optical quadrature encoders producing 8192 counts per revolution (CPR) with 4x hardware decoding, delivering sub-millimeter positional localization and sub-degree heading tracking for ARESLib autonomous motion profiling.",
    electricalSpecs: {
      "Resolution": "2048 PPR (8192 CPR in 4x Quadrature Decoding mode)",
      "Max Angular Velocity": "Up to 30,000 RPM with zero count loss",
      "Signal Type": "Dual 90° Phase-Shifted Square Waves (Channel A & Channel B)",
      "Shielding": "Braided foil shielding with twisted signal pairs"
    },
    pinout: [
      { pin: "Pin 1", name: "+5V VCC", color: "Red", wireHex: "#ef4444", type: "Power", description: "5.0V clean logic supply from Hub encoder rail" },
      { pin: "Pin 2", name: "GND", color: "Black", wireHex: "#1e293b", type: "Ground", description: "Digital logic ground reference" },
      { pin: "Pin 3", name: "CHANNEL A", color: "White", wireHex: "#f8fafc", type: "Signal", description: "Quadrature phase A square-wave frequency output" },
      { pin: "Pin 4", name: "CHANNEL B", color: "Green", wireHex: "#22c55e", type: "Signal", description: "Quadrature phase B (90° phase offset for direction detection)" }
    ],
    ftcRules: [
      "<RE10> Encoders must receive power directly from Hub sensor/encoder ports."
    ],
    bestPractices: [
      "Route encoder wires away from 12V high-current motor cables to eliminate magnetic induction noise.",
      "Check encoder tick counts in Driver Station self-test prior to every autonomous match."
    ]
  }
];

// --- PRE-FLIGHT CHECKLIST ITEMS ---
export interface ChecklistItem {
  id: string;
  category: "Power & Isolation" | "Bus Communication" | "Motors & Servos" | "Sensors & Vision";
  title: string;
  ruleRef: string;
  description: string;
  remediation: string;
}

export const INITIAL_CHECKLIST: ChecklistItem[] = [
  {
    id: "chk-1",
    category: "Power & Isolation",
    title: "12V Battery Retention & Mechanical Lock",
    ruleRef: "<RE01> & <RG01>",
    description: "Battery pack is mechanically locked with hook-and-loop strap and cannot shift during 3G field collisions.",
    remediation: "Tighten battery retention bracket and verify safety strap is double-threaded."
  },
  {
    id: "chk-2",
    category: "Power & Isolation",
    title: "20A Main Fuse Seating & Continuity",
    ruleRef: "<RE03>",
    description: "20A yellow blade fuse is firmly seated in the waterproof holder with zero terminal play.",
    remediation: "Inspect fuse element for metal fatigue or oxidation; reseat firmly into spring clips."
  },
  {
    id: "chk-3",
    category: "Power & Isolation",
    title: "Chassis Galvanic Ground Isolation (>100 kΩ)",
    ruleRef: "<RE05>",
    description: "Multimeter test between battery negative (GND) and bare aluminum robot frame measures infinite resistance (>100 kΩ).",
    remediation: "Locate frayed wire or uninsulated screw terminal touching frame; insulate with polyimide tape."
  },
  {
    id: "chk-4",
    category: "Power & Isolation",
    title: "Main Power Switch Accessibility (<2s Reach)",
    ruleRef: "<RE02>",
    description: "Robot power rocker switch is rigidly mounted, clearly labeled with standard FIRST decal, and reachable without reaching inside mechanisms.",
    remediation: "Relocate switch to top exterior plate with unobstructed 180° field referee access."
  },
  {
    id: "chk-5",
    category: "Bus Communication",
    title: "RS485 Differential Bus Locking Tab Engaged",
    ruleRef: "<RE04>",
    description: "3-wire JST-PH cable connecting Control Hub to Expansion Hub has intact locking retention clip.",
    remediation: "Replace cable if locking clip is snapped; secure connector with hot-melt inspection glue."
  },
  {
    id: "chk-6",
    category: "Bus Communication",
    title: "Expansion Hub Heartbeat LED Steady Pulse",
    ruleRef: "<RE14>",
    description: "Blue heartbeat LED on Expansion Hub pulses regularly, confirming active RS485 synchronization with Control Hub.",
    remediation: "Reboot Control Hub and verify address 2 assignment in Driver Station configuration."
  },
  {
    id: "chk-7",
    category: "Motors & Servos",
    title: "Motor Power Lead Crimps (18 AWG Minimum)",
    ruleRef: "<RE04>",
    description: "All 12V motor power leads are verified 18 AWG or thicker with zero exposed copper strands at crimp barrels.",
    remediation: "Recrimp loose Anderson PowerPole contacts with proper ratcheting crimper."
  },
  {
    id: "chk-8",
    category: "Motors & Servos",
    title: "Servo Lead Polarity & Strain Relief",
    ruleRef: "<RE11>",
    description: "All 3-pin servo leads match Black/Brown GND orientation on Hub rails and have extension clip locks.",
    remediation: "Verify pinout with Hub label before powering; apply servo clips on all cable junctions."
  },
  {
    id: "chk-9",
    category: "Sensors & Vision",
    title: "Limelight 3A USB-C Cable Anchor & 5V Rail",
    ruleRef: "<RE15>",
    description: "USB-C data line to Control Hub is physically anchored against shock and 5V 3A buck converter voltage reads 5.1V.",
    remediation: "Fasten 3D printed USB bracket to frame; check buck converter input voltage with multimeter."
  },
  {
    id: "chk-10",
    category: "Sensors & Vision",
    title: "Dead-Wheel Odometry Encoders Tick Verification",
    ruleRef: "<RE10>",
    description: "Manually rolling the robot 10 inches forward generates identical positive tick increments on left and right tracking pods.",
    remediation: "Check spring pre-load tension on dead-wheel arm and inspect encoder JST-PH connector."
  }
];

export default function HardwareElectronicsPage() {
  const [activeTab, setActiveTab] = useState<"architecture" | "components" | "calculator" | "checklist" | "safety">("architecture");
  const [selectedComponentId, setSelectedComponentId] = useState<string>("rev-control-hub");
  const [busFilter, setBusFilter] = useState<string>("all");
  const [componentSearch, setComponentSearch] = useState<string>("");

  // --- CALCULATOR STATE ---
  const [calcGauge, setCalcGauge] = useState<string>("18 AWG");
  const [calcLengthInches, setCalcLengthInches] = useState<number>(18);
  const [calcCurrentAmps, setCalcCurrentAmps] = useState<number>(12.0);
  const [calcSupplyVoltage, setCalcSupplyVoltage] = useState<number>(12.0);

  // --- CHECKLIST STATE ---
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({
    "chk-1": true,
    "chk-2": true,
    "chk-4": true
  });
  const [checklistFilter, setChecklistFilter] = useState<string>("all");

  const calcWireId = useId();
  const calcLengthId = useId();
  const calcCurrentId = useId();
  const calcVoltageId = useId();

  // --- CALCULATOR COMPUTATIONS ---
  const calcResults = useMemo(() => {
    const gaugeData = WIRE_GAUGES[calcGauge] || WIRE_GAUGES["18 AWG"];
    const lengthFeetOneWay = calcLengthInches / 12;
    const totalLoopFeet = lengthFeetOneWay * 2; // Positive + Negative return path
    const totalResistanceOhms = totalLoopFeet * gaugeData.ohmsPerFoot;
    const voltageDrop = calcCurrentAmps * totalResistanceOhms;
    const deliveredVoltage = Math.max(0, calcSupplyVoltage - voltageDrop);
    const percentageDrop = (voltageDrop / calcSupplyVoltage) * 100;
    const powerLossWatts = Math.pow(calcCurrentAmps, 2) * totalResistanceOhms;
    const isExceedingFTCRating = calcCurrentAmps > gaugeData.maxAmpsFTC;
    const isSevereDrop = percentageDrop > 5.0;

    return {
      totalResistanceOhms,
      voltageDrop,
      deliveredVoltage,
      percentageDrop,
      powerLossWatts,
      isExceedingFTCRating,
      isSevereDrop,
      gaugeData
    };
  }, [calcGauge, calcLengthInches, calcCurrentAmps, calcSupplyVoltage]);

  // --- SELECTED COMPONENT ---
  const selectedComponent = useMemo(() => {
    return HARDWARE_COMPONENTS.find((c) => c.id === selectedComponentId) || HARDWARE_COMPONENTS[0];
  }, [selectedComponentId]);

  // --- FILTERED COMPONENTS ---
  const filteredComponents = useMemo(() => {
    return HARDWARE_COMPONENTS.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(componentSearch.toLowerCase()) ||
        c.partNumber.toLowerCase().includes(componentSearch.toLowerCase()) ||
        c.category.toLowerCase().includes(componentSearch.toLowerCase()) ||
        c.overview.toLowerCase().includes(componentSearch.toLowerCase());
      return matchesSearch;
    });
  }, [componentSearch]);

  // --- CHECKLIST STATS ---
  const completedCount = Object.values(checkedItems).filter(Boolean).length;
  const totalChecklistCount = INITIAL_CHECKLIST.length;
  const checklistPercent = Math.round((completedCount / totalChecklistCount) * 100);

  const toggleCheckItem = (id: string) => {
    setCheckedItems((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleSelectPreset = (preset: CalcPreset) => {
    setCalcGauge(preset.gauge);
    setCalcLengthInches(preset.lengthInches);
    setCalcCurrentAmps(preset.currentAmps);
    setCalcSupplyVoltage(preset.supplyVoltage);
  };

  const checkAllItems = () => {
    const allChecked: Record<string, boolean> = {};
    INITIAL_CHECKLIST.forEach((item) => {
      allChecked[item.id] = true;
    });
    setCheckedItems(allChecked);
  };

  const resetAllItems = () => {
    setCheckedItems({});
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-obsidian text-marble selection:bg-ares-red selection:text-white">
      <SEO
        title="Robot Hardware & Electrical Architecture"
        description="Inspect the REV Robotics Control Hub architecture, 12V power distribution, sensor pinouts, wire gauge voltage drop calculator, and circuit diagnostics for ARES #23247."
      />

      {/* HERO HEADER */}
      <section className="py-20 bg-obsidian relative overflow-hidden flex items-center border-b border-white/10">
        <GreekMeander variant="thin" opacity="opacity-25" className="absolute top-0 left-0" />
        <div className="max-w-7xl mx-auto px-6 relative z-10 w-full">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="bg-ares-red text-white text-[10px] font-black uppercase px-3 py-1 font-heading tracking-widest ares-cut-sm flex items-center gap-1.5 shadow-lg">
                  <Zap size={12} className="animate-pulse" /> Electrical Architecture
                </span>
                <span className="text-ares-gold uppercase tracking-[0.3em] text-[10px] font-black font-heading">
                  FTC #23247 Hardware Engineering
                </span>
              </div>
              <h1 className="text-3xl md:text-6xl font-black text-white uppercase tracking-tight font-heading">
                Robot Hardware & <span className="text-ares-red">Wiring</span> Inspector
              </h1>
              <p className="text-marble/80 text-sm md:text-base max-w-3xl leading-relaxed mt-4">
                An interactive engineering overview of ARES #23247&apos;s competition electrical architecture. Explore REV Control & Expansion Hub bus topology, 12V power isolation, 90 FPS Limelight 3A vision pipeline, dead-wheel odometry pinouts, and our real-time wire gauge voltage drop calculator.
              </p>
            </div>

            {/* Quick Metrics Badge */}
            <div className="bg-black/40 border border-white/10 p-5 ares-cut-sm min-w-[260px] flex flex-col gap-2 shrink-0">
              <div className="text-[10px] uppercase font-bold tracking-widest text-ares-bronze flex items-center gap-2">
                <Activity size={12} className="text-ares-cyan" /> Electrical Safety Rating
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white font-heading">100%</span>
                <span className="text-xs text-green-400 font-bold uppercase tracking-wider">FTC Rule Compliant</span>
              </div>
              <div className="text-[11px] text-marble/60">
                12V Isolated Bus • 20A ATO Protection • 8192 CPR Odometry
              </div>
            </div>
          </div>

          {/* PRIMARY NAVIGATION TABS */}
          <div className="mt-12 flex flex-wrap gap-2 border-b border-white/10 pb-4" role="tablist" aria-label="Hardware Inspector Sections">
            {[
              { id: "architecture", label: "Bus Topology & Circuit Diagram", icon: Workflow },
              { id: "components", label: "Component & Pinout Inspector", icon: Cpu },
              { id: "calculator", label: "Wire Gauge & Voltage Drop Calculator", icon: Gauge },
              { id: "checklist", label: "Pre-Flight Circuit Checklist", icon: ShieldCheck },
              { id: "safety", label: "FIRST Safety & Rule Disclosures", icon: ShieldAlert }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  id={`tab-${tab.id}`}
                  aria-selected={isActive}
                  aria-controls={`tabpanel-${tab.id}`}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`px-4 py-3 rounded-t-sm font-heading font-black text-xs uppercase tracking-widest flex items-center gap-2.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${
                    isActive
                      ? "bg-ares-red text-white shadow-lg border-b-2 border-ares-gold"
                      : "bg-white/5 text-marble/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon size={14} className={isActive ? "text-ares-gold" : "text-marble/50"} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* MAIN TAB CONTENT CONTAINER */}
      <main className="max-w-7xl mx-auto px-6 py-12 w-full flex-grow">
        {/* ========================================================================= */}
        {/* TAB 1: SYSTEM TOPOLOGY & BUS ARCHITECTURE */}
        {/* ========================================================================= */}
        {activeTab === "architecture" && (
          <div role="tabpanel" id="tabpanel-architecture" aria-labelledby="tab-architecture" className="space-y-10">
            {/* Intro & Filter Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-black/30 p-6 rounded border border-white/10">
              <div>
                <h2 className="text-2xl font-black uppercase text-white font-heading tracking-tight flex items-center gap-2">
                  <Workflow className="text-ares-cyan" size={24} />
                  System Topology & Signal Bus Network
                </h2>
                <p className="text-marble/70 text-xs mt-1">
                  Interactive node graph illustrating the 12V high-current bus, RS485 master-slave loop, I2C telemetry, and vision data channels.
                </p>
              </div>

              {/* Bus Signal Highlighting Filter */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase font-bold tracking-widest text-marble/50">Filter Bus:</span>
                {[
                  { id: "all", label: "All Busses", color: "bg-white/10 text-white" },
                  { id: "power", label: "12V Power Bus", color: "bg-red-950/80 text-red-400 border-red-500/40" },
                  { id: "rs485", label: "RS485 Differential", color: "bg-blue-950/80 text-blue-400 border-blue-500/40" },
                  { id: "i2c", label: "I2C Sensor Bus", color: "bg-yellow-950/80 text-yellow-400 border-yellow-500/40" },
                  { id: "vision", label: "USB / Vision", color: "bg-emerald-950/80 text-emerald-400 border-emerald-500/40" }
                ].map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setBusFilter(b.id)}
                    className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider border transition-all ${
                      busFilter === b.id
                        ? `${b.color} ring-2 ring-ares-cyan font-black`
                        : "bg-black/40 text-marble/60 border-white/5 hover:border-white/20"
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Visual SVG Circuit Diagram */}
            <div className="bg-obsidian border border-white/10 rounded-lg p-6 relative overflow-x-auto shadow-2xl">
              <div className="min-w-[900px]">
                {/* SVG Visual Schematics */}
                <svg viewBox="0 0 1000 620" className="w-full h-auto select-none" aria-label="Electrical Architecture Topology Diagram">
                  <defs>
                    <linearGradient id="powerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#ef4444" />
                      <stop offset="100%" stopColor="#f59e0b" />
                    </linearGradient>
                    <linearGradient id="rs485Grad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#06b6d4" />
                    </linearGradient>
                    <linearGradient id="i2cGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#eab308" />
                      <stop offset="100%" stopColor="#ca8a04" />
                    </linearGradient>
                    <linearGradient id="visionGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#14b8a6" />
                    </linearGradient>
                    <pattern id="gridPattern" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="1" />
                    </pattern>
                  </defs>

                  {/* Background Grid */}
                  <rect width="1000" height="620" fill="url(#gridPattern)" />

                  {/* ================= CONNECTING BUS LINES ================= */}
                  {/* Battery to 20A Fuse to Switch */}
                  <g className={`transition-opacity duration-300 ${busFilter === "all" || busFilter === "power" ? "opacity-100" : "opacity-15"}`}>
                    {/* Line 1: Battery to Fuse */}
                    <path d="M 120 180 L 220 180" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
                    <text x="170" y="170" fill="#ef4444" fontSize="9" fontWeight="bold" textAnchor="middle">12V VBAT (16 AWG)</text>

                    {/* Line 2: Fuse to Switch */}
                    <path d="M 310 180 L 390 180" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
                    <text x="350" y="170" fill="#f59e0b" fontSize="9" fontWeight="bold" textAnchor="middle">20A PROTECTED</text>

                    {/* Line 3: Switch to Control Hub */}
                    <path d="M 470 180 L 530 180 L 530 220" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />

                    {/* Line 4: Control Hub 12V Auxiliary Pass-through to Expansion Hub */}
                    <path d="M 590 350 L 590 440 L 400 440 L 400 470" stroke="#ef4444" strokeWidth="3" strokeDasharray="6,4" fill="none" />
                    <text x="495" y="432" fill="#ef4444" fontSize="9" fontWeight="bold" textAnchor="middle">12V XT30 PASS-THROUGH</text>

                    {/* Line 5: 12V Power to SparkMINI Controller */}
                    <path d="M 320 480 L 250 480 L 250 370" stroke="#ef4444" strokeWidth="3" fill="none" />
                    <text x="235" y="440" fill="#ef4444" fontSize="8" fontWeight="bold" textAnchor="middle" transform="rotate(-90 235 440)">12V MOTOR FEED</text>

                    {/* Line 6: 12V to 5V 3A Buck for Limelight */}
                    <path d="M 640 220 L 760 220 L 760 140" stroke="#ef4444" strokeWidth="3" fill="none" />
                    <text x="700" y="212" fill="#ef4444" fontSize="8" fontWeight="bold" textAnchor="middle">12V AUX FEED</text>
                  </g>

                  {/* RS485 Bus (Control Hub <-> Expansion Hub) */}
                  <g className={`transition-opacity duration-300 ${busFilter === "all" || busFilter === "rs485" ? "opacity-100" : "opacity-15"}`}>
                    <path d="M 560 350 L 560 410 L 370 410 L 370 470" stroke="url(#rs485Grad)" strokeWidth="3.5" fill="none" />
                    <circle cx="560" cy="350" r="4" fill="#3b82f6" />
                    <circle cx="370" cy="470" r="4" fill="#06b6d4" />
                    <text x="465" y="402" fill="#06b6d4" fontSize="9" fontWeight="bold" textAnchor="middle">RS485 DIFFERENTIAL SERIAL BUS</text>
                  </g>

                  {/* I2C Bus to REV Color Sensors */}
                  <g className={`transition-opacity duration-300 ${busFilter === "all" || busFilter === "i2c" ? "opacity-100" : "opacity-15"}`}>
                    {/* Control Hub to Color Sensor 1 */}
                    <path d="M 680 270 L 800 270" stroke="url(#i2cGrad)" strokeWidth="2.5" fill="none" />
                    <text x="740" y="262" fill="#eab308" fontSize="8" fontWeight="bold" textAnchor="middle">I2C BUS 0 (3.3V)</text>

                    {/* Control Hub to Color Sensor 2 */}
                    <path d="M 680 290 L 760 290 L 760 340 L 800 340" stroke="url(#i2cGrad)" strokeWidth="2.5" fill="none" />
                    <text x="750" y="332" fill="#eab308" fontSize="8" fontWeight="bold" textAnchor="middle">I2C BUS 1 (3.3V)</text>
                  </g>

                  {/* USB / Vision High Speed Stream */}
                  <g className={`transition-opacity duration-300 ${busFilter === "all" || busFilter === "vision" ? "opacity-100" : "opacity-15"}`}>
                    <path d="M 830 140 L 830 190 L 680 190 L 680 230" stroke="url(#visionGrad)" strokeWidth="3" fill="none" />
                    <circle cx="830" cy="140" r="4" fill="#10b981" />
                    <text x="755" y="182" fill="#10b981" fontSize="9" fontWeight="bold" textAnchor="middle">HIGH-SPEED USB 3.0 UVC STREAM</text>
                  </g>

                  {/* Odometry Quadrature Encoders */}
                  <g className={`transition-opacity duration-300 ${busFilter === "all" ? "opacity-100" : "opacity-25"}`}>
                    <path d="M 680 320 L 740 320 L 740 420 L 800 420" stroke="#f8fafc" strokeWidth="2" strokeDasharray="4,4" fill="none" />
                    <text x="755" y="412" fill="#f8fafc" fontSize="8" fontWeight="bold" textAnchor="middle">8192 CPR QUAD ENCODERS</text>
                  </g>

                  {/* Servo Hub Feed */}
                  <g className={`transition-opacity duration-300 ${busFilter === "all" ? "opacity-100" : "opacity-25"}`}>
                    <path d="M 440 510 L 510 510 L 510 540" stroke="#f97316" strokeWidth="2.5" fill="none" />
                    <text x="475" y="502" fill="#f97316" fontSize="8" fontWeight="bold" textAnchor="middle">PWM CONTROL</text>
                  </g>

                  {/* ================= NODES & BLOCKS ================= */}
                  {/* NODE 1: 12V 3000mAh Battery */}
                  <g
                    tabIndex={0}
                    role="button"
                    aria-label="Select Battery Node"
                    className="cursor-pointer group focus:outline-none"
                    onClick={() => { setSelectedComponentId("power-distribution-fuse"); setActiveTab("components"); }}
                  >
                    <rect x="20" y="140" width="100" height="80" rx="6" fill="#18181b" stroke="#ef4444" strokeWidth="2" className="group-hover:fill-red-950/40 transition-colors" />
                    <text x="70" y="165" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">12V 3000mAh</text>
                    <text x="70" y="180" fill="#ef4444" fontSize="9" fontWeight="bold" textAnchor="middle">NiMH Battery</text>
                    <text x="70" y="202" fill="#a1a1aa" fontSize="8" textAnchor="middle">REV-31-1302</text>
                  </g>

                  {/* NODE 2: 20A Inline Fuse */}
                  <g
                    tabIndex={0}
                    role="button"
                    aria-label="Select 20A Fuse Node"
                    className="cursor-pointer group focus:outline-none"
                    onClick={() => { setSelectedComponentId("power-distribution-fuse"); setActiveTab("components"); }}
                  >
                    <rect x="220" y="150" width="90" height="60" rx="4" fill="#18181b" stroke="#f59e0b" strokeWidth="2" className="group-hover:fill-yellow-950/40 transition-colors" />
                    <text x="265" y="175" fill="#f59e0b" fontSize="11" fontWeight="bold" textAnchor="middle">20A FUSE</text>
                    <text x="265" y="195" fill="#a1a1aa" fontSize="8" textAnchor="middle">ATO Fast-Blow</text>
                  </g>

                  {/* NODE 3: Robot Main Power Switch */}
                  <g
                    tabIndex={0}
                    role="button"
                    aria-label="Select Power Switch Node"
                    className="cursor-pointer group focus:outline-none"
                    onClick={() => { setSelectedComponentId("power-distribution-fuse"); setActiveTab("components"); }}
                  >
                    <rect x="390" y="150" width="80" height="60" rx="4" fill="#18181b" stroke="#ef4444" strokeWidth="2" className="group-hover:fill-red-950/40 transition-colors" />
                    <text x="430" y="175" fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle">MAIN SWITCH</text>
                    <text x="430" y="195" fill="#ef4444" fontSize="8" fontWeight="bold" textAnchor="middle">SPST 20A</text>
                  </g>

                  {/* NODE 4: REV Control Hub (Centerpiece) */}
                  <g
                    tabIndex={0}
                    role="button"
                    aria-label="Select REV Control Hub Node"
                    className="cursor-pointer group focus:outline-none"
                    onClick={() => { setSelectedComponentId("rev-control-hub"); setActiveTab("components"); }}
                  >
                    <rect x="520" y="220" width="160" height="130" rx="8" fill="#09090b" stroke="#3b82f6" strokeWidth="3" className="group-hover:stroke-ares-gold transition-colors" />
                    <rect x="520" y="220" width="160" height="26" fill="#1e3a8a" rx="8" />
                    <text x="600" y="238" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle">REV CONTROL HUB</text>
                    <text x="600" y="265" fill="#38bdf8" fontSize="9" fontWeight="bold" textAnchor="middle">Snapdragon 410 / ARM</text>
                    <text x="600" y="283" fill="#a1a1aa" fontSize="8" textAnchor="middle">4x DC Motors (PID Loop)</text>
                    <text x="600" y="298" fill="#a1a1aa" fontSize="8" textAnchor="middle">6x Servo Ports (5V/6V)</text>
                    <text x="600" y="313" fill="#a1a1aa" fontSize="8" textAnchor="middle">4x I2C • 8x Digital I/O</text>
                    <text x="600" y="333" fill="#eab308" fontSize="8" fontWeight="bold" textAnchor="middle">MASTER CONTROLLER</text>
                  </g>

                  {/* NODE 5: REV Expansion Hub */}
                  <g
                    tabIndex={0}
                    role="button"
                    aria-label="Select REV Expansion Hub Node"
                    className="cursor-pointer group focus:outline-none"
                    onClick={() => { setSelectedComponentId("rev-expansion-hub"); setActiveTab("components"); }}
                  >
                    <rect x="320" y="470" width="130" height="100" rx="6" fill="#09090b" stroke="#06b6d4" strokeWidth="2.5" className="group-hover:stroke-ares-cyan transition-colors" />
                    <rect x="320" y="470" width="130" height="22" fill="#0e7490" rx="6" />
                    <text x="385" y="486" fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle">EXPANSION HUB</text>
                    <text x="385" y="510" fill="#a1a1aa" fontSize="8" textAnchor="middle">4x Auxiliary Motors</text>
                    <text x="385" y="525" fill="#a1a1aa" fontSize="8" textAnchor="middle">6x Servos • 4x I2C</text>
                    <text x="385" y="545" fill="#06b6d4" fontSize="8" fontWeight="bold" textAnchor="middle">RS485 NODE (ADDR 2)</text>
                  </g>

                  {/* NODE 6: SparkMINI Motor Controller */}
                  <g
                    tabIndex={0}
                    role="button"
                    aria-label="Select SparkMINI Node"
                    className="cursor-pointer group focus:outline-none"
                    onClick={() => { setSelectedComponentId("spark-mini-controllers"); setActiveTab("components"); }}
                  >
                    <rect x="190" y="300" width="110" height="70" rx="4" fill="#18181b" stroke="#ef4444" strokeWidth="1.5" className="group-hover:fill-red-950/30 transition-colors" />
                    <text x="245" y="322" fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle">SparkMINI</text>
                    <text x="245" y="340" fill="#ef4444" fontSize="8" textAnchor="middle">12V DC Controller</text>
                    <text x="245" y="358" fill="#a1a1aa" fontSize="8" textAnchor="middle">Intake Roller Feed</text>
                  </g>

                  {/* NODE 7: GoBILDA Servo Hub */}
                  <g
                    tabIndex={0}
                    role="button"
                    aria-label="Select Servo Hub Node"
                    className="cursor-pointer group focus:outline-none"
                    onClick={() => { setSelectedComponentId("gobilda-servo-hub"); setActiveTab("components"); }}
                  >
                    <rect x="500" y="530" width="120" height="70" rx="4" fill="#18181b" stroke="#f97316" strokeWidth="1.5" className="group-hover:fill-orange-950/30 transition-colors" />
                    <text x="560" y="552" fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle">GoBILDA SERVO HUB</text>
                    <text x="560" y="570" fill="#f97316" fontSize="8" textAnchor="middle">6V/7.4V Regulated</text>
                    <text x="560" y="588" fill="#a1a1aa" fontSize="8" textAnchor="middle">Claw & Wrist Servos</text>
                  </g>

                  {/* NODE 8: Limelight 3A Vision Coprocessor */}
                  <g
                    tabIndex={0}
                    role="button"
                    aria-label="Select Limelight 3A Node"
                    className="cursor-pointer group focus:outline-none"
                    onClick={() => { setSelectedComponentId("limelight-3a-vision"); setActiveTab("components"); }}
                  >
                    <rect x="760" y="70" width="140" height="70" rx="6" fill="#09090b" stroke="#10b981" strokeWidth="2" className="group-hover:stroke-emerald-400 transition-colors" />
                    <text x="830" y="93" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle">LIMELIGHT 3A</text>
                    <text x="830" y="110" fill="#10b981" fontSize="9" fontWeight="bold" textAnchor="middle">90 FPS AprilTag Pipeline</text>
                    <text x="830" y="127" fill="#a1a1aa" fontSize="8" textAnchor="middle">5V 3A Buck Powered</text>
                  </g>

                  {/* NODE 9: REV Color Sensor Array */}
                  <g
                    tabIndex={0}
                    role="button"
                    aria-label="Select Color Sensor Node"
                    className="cursor-pointer group focus:outline-none"
                    onClick={() => { setSelectedComponentId("rev-color-sensor-v3"); setActiveTab("components"); }}
                  >
                    <rect x="800" y="240" width="130" height="110" rx="4" fill="#18181b" stroke="#eab308" strokeWidth="1.5" className="group-hover:fill-yellow-950/30 transition-colors" />
                    <text x="865" y="262" fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle">REV COLOR V3</text>
                    <text x="865" y="280" fill="#eab308" fontSize="8" textAnchor="middle">APDS-9960 Engine</text>
                    <text x="865" y="298" fill="#a1a1aa" fontSize="8" textAnchor="middle">RGB + 1-10cm IR Prox</text>
                    <text x="865" y="325" fill="#38bdf8" fontSize="8" fontWeight="bold" textAnchor="middle">Dual I2C Buses (0 & 1)</text>
                  </g>

                  {/* NODE 10: Dead-Wheel Odometry Encoders */}
                  <g
                    tabIndex={0}
                    role="button"
                    aria-label="Select Odometry Encoders Node"
                    className="cursor-pointer group focus:outline-none"
                    onClick={() => { setSelectedComponentId("odometry-encoder-pods"); setActiveTab("components"); }}
                  >
                    <rect x="800" y="390" width="130" height="70" rx="4" fill="#18181b" stroke="#f8fafc" strokeWidth="1.5" className="group-hover:fill-slate-800 transition-colors" />
                    <text x="865" y="412" fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle">ODOMETRY PODS</text>
                    <text x="865" y="430" fill="#f8fafc" fontSize="8" textAnchor="middle">8192 CPR Optical</text>
                    <text x="865" y="448" fill="#a1a1aa" fontSize="8" textAnchor="middle">X / Y / Heading Pods</text>
                  </g>
                </svg>
              </div>

              {/* Diagram Interaction Legend */}
              <div className="mt-6 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-[11px] text-marble/70">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-1 bg-red-500 rounded-full inline-block" /> 12V Power Line (16/18 AWG)</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-1 bg-blue-500 rounded-full inline-block" /> RS485 Serial Bus</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-1 bg-yellow-500 rounded-full inline-block" /> I2C Sensor Bus (3.3V)</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-1 bg-emerald-500 rounded-full inline-block" /> USB 3.0 Vision Data</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-1 bg-orange-500 rounded-full inline-block" /> PWM Servo Rail</span>
                </div>
                <div className="text-ares-gold font-semibold flex items-center gap-1">
                  <Info size={12} /> Click any block on the schematic to inspect pinout & specs
                </div>
              </div>
            </div>

            {/* Architecture Explanatory Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-black/30 border border-white/10 p-6 rounded ares-cut-sm">
                <div className="w-10 h-10 rounded bg-red-950/60 border border-red-500/30 flex items-center justify-center text-red-400 mb-4">
                  <Zap size={20} />
                </div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider font-heading mb-2">
                  12V Power & 20A Isolation
                </h3>
                <p className="text-xs text-marble/70 leading-relaxed">
                  Single-battery topology routed through an automotive 20A ATC blade fuse and industrial rocker switch. Prevents thermal overrun during high-traction pushing battles while isolating the Control Hub logic rail from motor inductive kickback.
                </p>
              </div>

              <div className="bg-black/30 border border-white/10 p-6 rounded ares-cut-sm">
                <div className="w-10 h-10 rounded bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4">
                  <Layers size={20} />
                </div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider font-heading mb-2">
                  Dual-Hub RS485 Sync
                </h3>
                <p className="text-xs text-marble/70 leading-relaxed">
                  The Control Hub acts as the system root master, broadcasting motion trajectory setpoints and receiving Expansion Hub feedback across a noise-immune RS485 differential bus clocked for sub-millisecond PID updates.
                </p>
              </div>

              <div className="bg-black/30 border border-white/10 p-6 rounded ares-cut-sm">
                <div className="w-10 h-10 rounded bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4">
                  <Eye size={20} />
                </div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider font-heading mb-2">
                  90 FPS Perception Stream
                </h3>
                <p className="text-xs text-marble/70 leading-relaxed">
                  The Limelight 3A vision coprocessor runs independent 3D AprilTag pose estimation and OpenCV color segmentation on a dedicated 5V 3A step-down regulator, fusing real-time optical localization with dead-wheel odometry.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: COMPONENT & SENSOR PINOUT INSPECTOR */}
        {/* ========================================================================= */}
        {activeTab === "components" && (
          <div role="tabpanel" id="tabpanel-components" aria-labelledby="tab-components" className="space-y-8">
            {/* Header & Filter Search */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black uppercase text-white font-heading tracking-tight flex items-center gap-2">
                  <Cpu className="text-ares-red" size={24} />
                  Component & Sensor Pinout Inspector
                </h2>
                <p className="text-marble/70 text-xs mt-1">
                  Select a module below to inspect JST-PH pinouts, wire colors, operating tolerances, and FTC regulatory disclosures.
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative min-w-[280px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-marble/40" size={16} />
                <input
                  type="text"
                  placeholder="Search components or pinouts..."
                  value={componentSearch}
                  onChange={(e) => setComponentSearch(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded pl-10 pr-4 py-2 text-xs text-white placeholder-marble/40 focus:outline-none focus:border-ares-cyan"
                />
              </div>
            </div>

            {/* Split Layout: Selector Sidebar + Detailed Inspector */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Component List */}
              <div className="lg:col-span-4 space-y-2">
                <div className="text-[10px] uppercase font-bold tracking-widest text-marble/50 mb-3">
                  Select Hardware Unit ({filteredComponents.length})
                </div>

                <div className="space-y-2 max-h-[680px] overflow-y-auto pr-1">
                  {filteredComponents.map((comp) => {
                    const isSelected = selectedComponentId === comp.id;
                    return (
                      <button
                        key={comp.id}
                        onClick={() => setSelectedComponentId(comp.id)}
                        className={`w-full text-left p-4 rounded border transition-all flex items-start gap-3.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${
                          isSelected
                            ? "bg-ares-red/15 border-ares-red text-white shadow-lg"
                            : "bg-black/30 border-white/5 text-marble/70 hover:bg-white/5 hover:border-white/15"
                        }`}
                      >
                        <div
                          className={`w-9 h-9 rounded flex items-center justify-center shrink-0 mt-0.5 ${
                            isSelected ? "bg-ares-red text-white" : "bg-white/5 text-marble/50"
                          }`}
                        >
                          <Cpu size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[9px] uppercase font-bold tracking-wider text-ares-gold">
                              {comp.category}
                            </span>
                            <span className="text-[9px] text-marble/40 font-mono">
                              {comp.partNumber}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-white truncate mt-0.5">
                            {comp.name}
                          </div>
                          <div className="text-[10px] text-marble/60 truncate mt-1">
                            {comp.voltage}
                          </div>
                        </div>
                      </button>
                    );
                  })}

                  {filteredComponents.length === 0 && (
                    <div className="text-center py-8 text-marble/40 text-xs bg-black/20 rounded border border-white/5">
                      No components found matching &ldquo;{componentSearch}&rdquo;
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Detailed Pinout & Specs Panel */}
              <div className="lg:col-span-8 space-y-6">
                <div className="bg-black/30 border border-white/10 rounded-lg p-6 sm:p-8 space-y-8 shadow-xl">
                  {/* Top Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="bg-ares-gold/20 text-ares-gold text-[9px] font-bold uppercase px-2 py-0.5 rounded font-mono">
                          {selectedComponent.partNumber}
                        </span>
                        <span className="text-[10px] text-marble/60 uppercase tracking-widest font-semibold">
                          {selectedComponent.category}
                        </span>
                      </div>
                      <h3 className="text-2xl font-black text-white uppercase font-heading tracking-tight">
                        {selectedComponent.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="bg-white/5 border border-white/10 px-3 py-1.5 rounded text-right">
                        <div className="text-[9px] uppercase tracking-widest text-marble/50 font-bold">Max Draw</div>
                        <div className="text-xs font-bold text-ares-cyan font-mono">{selectedComponent.maxCurrent}</div>
                      </div>
                      <div className="bg-white/5 border border-white/10 px-3 py-1.5 rounded text-right">
                        <div className="text-[9px] uppercase tracking-widest text-marble/50 font-bold">Voltage</div>
                        <div className="text-xs font-bold text-ares-gold font-mono">{selectedComponent.voltage.split(" ")[0]}</div>
                      </div>
                    </div>
                  </div>

                  {/* Overview Text */}
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-marble/50 mb-2 font-heading">
                      Subsystem Architecture & Function
                    </h4>
                    <p className="text-xs sm:text-sm text-marble/85 leading-relaxed bg-white/[0.02] p-4 rounded border border-white/5">
                      {selectedComponent.overview}
                    </p>
                  </div>

                  {/* Electrical Characteristics Matrix */}
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-marble/50 mb-3 font-heading flex items-center gap-2">
                      <Activity size={14} className="text-ares-cyan" /> Electrical Characteristics & Interfaces
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {Object.entries(selectedComponent.electricalSpecs).map(([key, val]) => (
                        <div key={key} className="bg-black/40 border border-white/5 p-3 rounded flex flex-col justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-ares-bronze">{key}</span>
                          <span className="text-xs text-white font-medium mt-1">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Detailed Pinout Table */}
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-marble/50 mb-3 font-heading flex items-center gap-2">
                      <Cable size={14} className="text-ares-gold" /> Pin Assignment & Wire Color Standard
                    </h4>
                    <div className="overflow-x-auto rounded border border-white/10">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-white/5 text-marble/60 uppercase font-bold text-[10px] tracking-wider border-b border-white/10">
                            <th className="py-2.5 px-3">Pin</th>
                            <th className="py-2.5 px-3">Signal Name</th>
                            <th className="py-2.5 px-3">Standard Wire Color</th>
                            <th className="py-2.5 px-3">Type</th>
                            <th className="py-2.5 px-3">Signal Function & Voltage Level</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 font-mono">
                          {selectedComponent.pinout.map((p, idx) => (
                            <tr key={idx} className="hover:bg-white/[0.03] transition-colors">
                              <td className="py-2.5 px-3 font-bold text-white">{p.pin}</td>
                              <td className="py-2.5 px-3 font-bold text-ares-cyan">{p.name}</td>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0 inline-block shadow"
                                    style={{ backgroundColor: p.wireHex }}
                                  />
                                  <span className="text-marble/90 font-sans text-xs">{p.color}</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 font-sans">
                                <span
                                  className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                    p.type === "Power"
                                      ? "bg-red-950/80 text-red-400 border border-red-500/30"
                                      : p.type === "Ground"
                                      ? "bg-slate-900 text-slate-300 border border-slate-700"
                                      : p.type === "I2C"
                                      ? "bg-yellow-950/80 text-yellow-400 border border-yellow-500/30"
                                      : p.type === "PWM"
                                      ? "bg-orange-950/80 text-orange-400 border border-orange-500/30"
                                      : p.type === "Differential"
                                      ? "bg-blue-950/80 text-blue-400 border border-blue-500/30"
                                      : "bg-emerald-950/80 text-emerald-400 border border-emerald-500/30"
                                  }`}
                                >
                                  {p.type}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-marble/80 font-sans text-xs">{p.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* FIRST Rules & Team Best Practices Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/10">
                    {/* FTC Rule Disclosures */}
                    <div className="bg-red-950/20 border border-red-500/20 p-4 rounded ares-cut-sm">
                      <div className="text-[10px] uppercase font-bold tracking-widest text-red-400 flex items-center gap-1.5 mb-2.5">
                        <ShieldAlert size={12} /> FIRST Competition Rules
                      </div>
                      <ul className="space-y-2 text-xs text-marble/80">
                        {selectedComponent.ftcRules.map((rule, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-red-400 font-bold">•</span>
                            <span>{rule}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* ARES Best Practices */}
                    <div className="bg-cyan-950/20 border border-cyan-500/20 p-4 rounded ares-cut-sm">
                      <div className="text-[10px] uppercase font-bold tracking-widest text-cyan-400 flex items-center gap-1.5 mb-2.5">
                        <ShieldCheck size={12} /> ARES Engineering Standard
                      </div>
                      <ul className="space-y-2 text-xs text-marble/80">
                        {selectedComponent.bestPractices.map((bp, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-cyan-400 font-bold">•</span>
                            <span>{bp}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: WIRE GAUGE & VOLTAGE DROP CALCULATOR */}
        {/* ========================================================================= */}
        {activeTab === "calculator" && (
          <div role="tabpanel" id="tabpanel-calculator" aria-labelledby="tab-calculator" className="space-y-10">
            {/* Header */}
            <div>
              <h2 className="text-2xl font-black uppercase text-white font-heading tracking-tight flex items-center gap-2">
                <Gauge className="text-ares-gold" size={24} />
                Wire Gauge & Voltage Drop Calculator
              </h2>
              <p className="text-marble/70 text-xs mt-1 max-w-3xl">
                Simulate resistive losses, thermal power dissipation, and delivered terminal voltage across custom wire gauges (16, 18, 20, and 22 AWG copper lines) under competition stall and continuous current loads.
              </p>
            </div>

            {/* Quick Presets Bar */}
            <div className="bg-black/30 border border-white/10 p-5 rounded space-y-3">
              <div className="text-[10px] uppercase font-bold tracking-widest text-ares-gold flex items-center gap-2">
                <Sliders size={12} /> Rapid Subsystem Presets
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {CALC_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectPreset(preset)}
                    className="p-3 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-ares-gold/40 rounded text-left transition-all group focus:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                  >
                    <div className="text-xs font-bold text-white group-hover:text-ares-gold transition-colors flex items-center justify-between">
                      <span>{preset.label}</span>
                      <ChevronRight size={12} className="text-marble/40 group-hover:translate-x-1 transition-transform" />
                    </div>
                    <div className="text-[10px] text-marble/60 mt-1 line-clamp-1">
                      {preset.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Calculator Grid: Inputs (Left) & Results (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Inputs Form */}
              <div className="lg:col-span-5 bg-black/40 border border-white/10 rounded-lg p-6 space-y-6 shadow-xl">
                <h3 className="text-base font-bold uppercase text-white font-heading tracking-wider border-b border-white/10 pb-3 flex items-center gap-2">
                  <Cable size={18} className="text-ares-cyan" /> Circuit Parameters
                </h3>

                {/* Wire Gauge Selector */}
                <div className="space-y-2">
                  <label htmlFor={calcWireId} className="block text-xs font-bold uppercase tracking-wider text-marble/80">
                    Conductor Wire Gauge (AWG)
                  </label>
                  <select
                    id={calcWireId}
                    value={calcGauge}
                    onChange={(e) => setCalcGauge(e.target.value)}
                    className="w-full bg-obsidian border border-white/15 rounded px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-ares-cyan"
                  >
                    {Object.keys(WIRE_GAUGES).map((g) => (
                      <option key={g} value={g}>
                        {g} ({WIRE_GAUGES[g].typicalUse})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-marble/50">
                    Resistance: {(WIRE_GAUGES[calcGauge].ohmsPerFoot * 1000).toFixed(2)} mΩ/ft • Max FTC Load: {WIRE_GAUGES[calcGauge].maxAmpsFTC}A
                  </p>
                </div>

                {/* Wire Length (Inches) */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-marble/80">
                    <label htmlFor={calcLengthId}>One-Way Wire Length</label>
                    <span className="font-mono text-ares-gold">{calcLengthInches} inches ({(calcLengthInches / 12).toFixed(2)} ft)</span>
                  </div>
                  <input
                    id={calcLengthId}
                    type="range"
                    min="4"
                    max="72"
                    step="1"
                    value={calcLengthInches}
                    onChange={(e) => setCalcLengthInches(Number(e.target.value))}
                    className="w-full accent-ares-red cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-marble/40 font-mono">
                    <span>4 in</span>
                    <span>36 in (3 ft)</span>
                    <span>72 in (6 ft)</span>
                  </div>
                </div>

                {/* Load Current (Amps) */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-marble/80">
                    <label htmlFor={calcCurrentId}>Current Load</label>
                    <span className="font-mono text-ares-cyan">{calcCurrentAmps.toFixed(1)} Amps</span>
                  </div>
                  <input
                    id={calcCurrentId}
                    type="range"
                    min="0.1"
                    max="22.0"
                    step="0.1"
                    value={calcCurrentAmps}
                    onChange={(e) => setCalcCurrentAmps(Number(e.target.value))}
                    className="w-full accent-ares-cyan cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-marble/40 font-mono">
                    <span>0.1A (Idle)</span>
                    <span>10.0A (Drive)</span>
                    <span>20.0A (Stall / Fuse Limit)</span>
                  </div>
                </div>

                {/* Supply Voltage (Volts) */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-marble/80">
                    <label htmlFor={calcVoltageId}>Supply Source Voltage</label>
                    <span className="font-mono text-green-400">{calcSupplyVoltage.toFixed(1)} V DC</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { val: 12.0, label: "12V (Main)" },
                      { val: 7.4, label: "7.4V (Servo)" },
                      { val: 5.0, label: "5V (Logic)" },
                      { val: 3.3, label: "3.3V (I2C)" }
                    ].map((v) => (
                      <button
                        key={v.val}
                        type="button"
                        onClick={() => setCalcSupplyVoltage(v.val)}
                        className={`py-1.5 px-2 rounded text-[10px] font-bold uppercase transition-all ${
                          calcSupplyVoltage === v.val
                            ? "bg-green-600 text-white shadow"
                            : "bg-white/5 text-marble/60 hover:bg-white/10"
                        }`}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Output Results Dashboard */}
              <div className="lg:col-span-7 space-y-6">
                <div className="bg-black/30 border border-white/10 rounded-lg p-6 sm:p-8 space-y-6 shadow-xl">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <h3 className="text-base font-bold uppercase text-white font-heading tracking-wider flex items-center gap-2">
                      <Activity size={18} className="text-ares-gold" /> Calculated Circuit Telemetry
                    </h3>
                    <span className="text-[10px] text-marble/50 uppercase font-mono">
                      Round-trip loop: {((calcLengthInches / 12) * 2).toFixed(2)} ft
                    </span>
                  </div>

                  {/* Primary Outputs Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Voltage Drop Card */}
                    <div className="bg-black/50 border border-white/10 p-4 rounded ares-cut-sm">
                      <div className="text-[10px] uppercase font-bold tracking-widest text-marble/50">Voltage Drop (ΔV)</div>
                      <div className="text-3xl font-black font-mono text-white mt-1">
                        {calcResults.voltageDrop.toFixed(3)} <span className="text-sm font-sans font-bold text-marble/60">V</span>
                      </div>
                      <div className="text-xs font-semibold text-ares-bronze mt-1">
                        {calcResults.percentageDrop.toFixed(2)}% of source voltage
                      </div>
                    </div>

                    {/* Delivered Terminal Voltage */}
                    <div className="bg-black/50 border border-white/10 p-4 rounded ares-cut-sm">
                      <div className="text-[10px] uppercase font-bold tracking-widest text-marble/50">Delivered Voltage</div>
                      <div className="text-3xl font-black font-mono text-ares-gold mt-1">
                        {calcResults.deliveredVoltage.toFixed(3)} <span className="text-sm font-sans font-bold text-marble/60">V</span>
                      </div>
                      <div className="text-xs text-marble/60 mt-1">
                        At load actuator terminals
                      </div>
                    </div>

                    {/* Loop Resistance */}
                    <div className="bg-black/50 border border-white/10 p-4 rounded ares-cut-sm">
                      <div className="text-[10px] uppercase font-bold tracking-widest text-marble/50">Total Loop Resistance (R)</div>
                      <div className="text-2xl font-black font-mono text-ares-cyan mt-1">
                        {(calcResults.totalResistanceOhms * 1000).toFixed(2)} <span className="text-sm font-sans font-bold text-marble/60">mΩ</span>
                      </div>
                      <div className="text-xs text-marble/60 mt-1">
                        Positive lead + ground return path
                      </div>
                    </div>

                    {/* Thermal Power Dissipation */}
                    <div className="bg-black/50 border border-white/10 p-4 rounded ares-cut-sm">
                      <div className="text-[10px] uppercase font-bold tracking-widest text-marble/50 flex items-center gap-1.5">
                        <Flame size={12} className="text-red-400" /> Heat Power Loss (I²R)
                      </div>
                      <div className="text-2xl font-black font-mono text-red-400 mt-1">
                        {calcResults.powerLossWatts.toFixed(2)} <span className="text-sm font-sans font-bold text-marble/60">Watts</span>
                      </div>
                      <div className="text-xs text-marble/60 mt-1">
                        Thermal dissipation along cable
                      </div>
                    </div>
                  </div>

                  {/* Safety & Compliance Status Banner */}
                  <div
                    className={`p-4 rounded border flex items-start gap-3.5 ${
                      calcResults.isExceedingFTCRating
                        ? "bg-red-950/40 border-red-500 text-red-300"
                        : calcResults.isSevereDrop
                        ? "bg-yellow-950/40 border-yellow-500 text-yellow-300"
                        : "bg-green-950/40 border-green-500 text-green-300"
                    }`}
                  >
                    {calcResults.isExceedingFTCRating ? (
                      <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={20} />
                    ) : calcResults.isSevereDrop ? (
                      <AlertTriangle className="text-yellow-400 shrink-0 mt-0.5" size={20} />
                    ) : (
                      <CheckCircle2 className="text-green-400 shrink-0 mt-0.5" size={20} />
                    )}

                    <div className="space-y-1 text-xs">
                      <div className="font-bold uppercase tracking-wider">
                        {calcResults.isExceedingFTCRating
                          ? "FTC Rule Warning: Over-Current on Selected Gauge"
                          : calcResults.isSevereDrop
                          ? "Performance Advisory: High Voltage Drop (>5%)"
                          : "Circuit Status: Optimal & FTC Rule Compliant"}
                      </div>
                      <p className="text-marble/80 leading-relaxed">
                        {calcResults.isExceedingFTCRating
                          ? `FTC rule <RE04> prohibits drawing ${calcCurrentAmps}A through ${calcGauge}. Minimum 18 AWG is mandatory for all main power lines and DC motor leads exceeding 5A.`
                          : calcResults.isSevereDrop
                          ? `A ${calcResults.percentageDrop.toFixed(1)}% voltage drop under load can cause Control Hub brownouts, resetting the Android coprocessor during sudden acceleration. Consider shortening wire run or upgrading to 16/18 AWG.`
                          : `Operating well within safe thermal thresholds. Voltage drop is under 5% (${calcResults.percentageDrop.toFixed(2)}%), ensuring maximum motor torque output and clean sensor logic levels.`}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: PRE-FLIGHT CIRCUIT DIAGNOSTIC CHECKLIST */}
        {/* ========================================================================= */}
        {activeTab === "checklist" && (
          <div role="tabpanel" id="tabpanel-checklist" aria-labelledby="tab-checklist" className="space-y-8">
            {/* Header & Score Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-black/40 border border-white/10 p-6 rounded-lg">
              <div>
                <h2 className="text-2xl font-black uppercase text-white font-heading tracking-tight flex items-center gap-2">
                  <ShieldCheck className="text-green-400" size={24} />
                  Pre-Flight Electrical & Diagnostic Checklist
                </h2>
                <p className="text-marble/70 text-xs mt-1">
                  Standard 10-point electrical verification executed by ARES #23247 drive pit technicians before queuing for qualification and elimination matches.
                </p>
              </div>

              {/* Progress Tracker */}
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right">
                  <div className="text-xs font-bold text-white font-heading uppercase tracking-wider">
                    {completedCount} of {totalChecklistCount} Verified
                  </div>
                  <div className="text-[10px] text-marble/50">
                    {checklistPercent === 100 ? "Ready for Match Queuing" : "Inspection in Progress"}
                  </div>
                </div>
                <div className="w-16 h-16 rounded-full border-4 border-white/10 flex items-center justify-center font-black text-sm font-heading relative">
                  <div
                    className={`absolute inset-0 rounded-full border-4 ${
                      checklistPercent === 100 ? "border-green-500" : "border-ares-red"
                    }`}
                    style={{ clipPath: `polygon(0 0, 100% 0, 100% ${checklistPercent}%, 0 ${checklistPercent}%)` }}
                  />
                  <span className={checklistPercent === 100 ? "text-green-400" : "text-white"}>
                    {checklistPercent}%
                  </span>
                </div>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              {/* Category Filter */}
              <div className="flex items-center gap-2 flex-wrap">
                {["all", "Power & Isolation", "Bus Communication", "Motors & Servos", "Sensors & Vision"].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setChecklistFilter(cat)}
                    className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wider transition-all ${
                      checklistFilter === cat
                        ? "bg-ares-red text-white"
                        : "bg-white/5 text-marble/60 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {cat === "all" ? "All Categories" : cat}
                  </button>
                ))}
              </div>

              {/* Bulk Toggle Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={checkAllItems}
                  className="px-3 py-1 rounded text-xs font-bold uppercase tracking-wider bg-white/5 hover:bg-white/10 text-marble hover:text-white flex items-center gap-1.5 border border-white/10"
                >
                  <CheckSquare size={14} /> Verify All
                </button>
                <button
                  onClick={resetAllItems}
                  className="px-3 py-1 rounded text-xs font-bold uppercase tracking-wider bg-white/5 hover:bg-white/10 text-marble hover:text-white flex items-center gap-1.5 border border-white/10"
                >
                  <RotateCcw size={14} /> Reset
                </button>
              </div>
            </div>

            {/* Checklist Items */}
            <div className="space-y-3">
              {INITIAL_CHECKLIST.filter((item) => checklistFilter === "all" || item.category === checklistFilter)
                .map((item) => {
                  const isChecked = !!checkedItems[item.id];
                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleCheckItem(item.id)}
                      className={`p-5 rounded-lg border transition-all cursor-pointer flex items-start gap-4 ${
                        isChecked
                          ? "bg-green-950/15 border-green-500/40 text-white"
                          : "bg-black/30 border-white/10 text-marble/80 hover:bg-white/[0.03]"
                      }`}
                    >
                      <button
                        type="button"
                        aria-label={`Toggle check for ${item.title}`}
                        className={`w-6 h-6 rounded flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                          isChecked ? "bg-green-600 text-white" : "border border-white/30 text-transparent"
                        }`}
                      >
                        <CheckCircle2 size={16} className={isChecked ? "opacity-100" : "opacity-0"} />
                      </button>

                      <div className="flex-1 space-y-1">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black uppercase tracking-wider text-white font-heading">
                              {item.title}
                            </span>
                            <span className="text-[9px] font-bold font-mono px-2 py-0.5 rounded bg-white/5 text-ares-gold">
                              {item.ruleRef}
                            </span>
                          </div>
                          <span className="text-[10px] uppercase tracking-widest text-marble/40 font-semibold">
                            {item.category}
                          </span>
                        </div>
                        <p className="text-xs text-marble/80 leading-relaxed">
                          {item.description}
                        </p>
                        <div className="text-[11px] text-marble/60 flex items-start gap-1.5 pt-1">
                          <span className="text-ares-cyan font-bold uppercase text-[9px] shrink-0">Remediation:</span>
                          <span>{item.remediation}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: FIRST SAFETY & RULES COMPLIANCE DISCLOSURES */}
        {/* ========================================================================= */}
        {activeTab === "safety" && (
          <div role="tabpanel" id="tabpanel-safety" aria-labelledby="tab-safety" className="space-y-10">
            {/* Header */}
            <div>
              <h2 className="text-2xl font-black uppercase text-white font-heading tracking-tight flex items-center gap-2">
                <ShieldAlert className="text-ares-red" size={24} />
                FIRST Tech Challenge Electrical Safety & Rules Compliance
              </h2>
              <p className="text-marble/70 text-xs mt-1 max-w-3xl">
                Formal regulatory disclosures detailing ARES #23247&apos;s compliance with FIRST Tech Challenge Game Manual Part 1 / Competition Manual robot electrical and pneumatic safety rules.
              </p>
            </div>

            {/* Rules Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                {
                  rule: "<RE01> Single Approved 12V Battery Pack",
                  status: "Compliant",
                  details: "ARES #23247 solely utilizes genuine REV-31-1302 12V 3000mAh NiMH slim battery packs. Battery packs are secured via heavy-duty double-threaded retention straps and inspected for swelling or thermal degradation after every match."
                },
                {
                  rule: "<RE02> Robot Main Power Switch Placement",
                  status: "Compliant",
                  details: "A single heavy-duty 20A SPST switch (REV-31-1387) isolates all power on the robot. The switch is mounted rigidly to the top exterior chassis plate, labeled with official FIRST decals, and reachable within 2 seconds by field referees without reaching past actuators."
                },
                {
                  rule: "<RE03> 20A Over-Current Circuit Protection",
                  status: "Compliant",
                  details: "A single 20A automotive blade fuse (ATO/ATC fast-acting) is installed in series directly between the battery positive terminal and the main switch. No bypassing or parallel fuses exist anywhere in the electrical network."
                },
                {
                  rule: "<RE04> Wire Gauge Minimum Standards",
                  status: "Compliant",
                  details: "All primary 12V DC power lines (battery, switch, Control Hub, Expansion Hub, and DC motors) are strictly wired with 18 AWG or 16 AWG ultra-flexible high-strand silicone copper wire. 20 AWG is used for servo power rails, and 22 AWG is restricted to low-current I2C/analog/digital sensors."
                },
                {
                  rule: "<RE05> Chassis Isolation & Zero Frame Grounding",
                  status: "Compliant",
                  details: "The conductive aluminum chassis is completely isolated from all electrical paths (>100 kΩ measured resistance to both +12V and GND). The chassis frame is never used as an electrical return path."
                },
                {
                  rule: "<RE06> Controller & Expansion Hub Limits",
                  status: "Compliant",
                  details: "Exactly one (1) REV Robotics Control Hub and one (1) REV Robotics Expansion Hub are utilized. Communication between hubs occurs solely through the dedicated differential RS485 bus."
                },
                {
                  rule: "<RE07> Maximum DC Motor Allotment",
                  status: "Compliant",
                  details: "Robot utilizes seven (7) DC motors across the two hubs (4x drivetrain mecanum motors, 2x dual-spool linear slides, 1x active roller intake). Total motor count remains strictly under the regulatory ceiling of eight (8)."
                },
                {
                  rule: "<RE15> External Coprocessors & Vision Regulations",
                  status: "Compliant",
                  details: "The Limelight 3A vision coprocessor is powered through a dedicated 5V 3A step-down regulator tapped from the Hub auxiliary port. All perception communication passes over high-speed USB-C; no banned laser emitters or RF transmitters are installed."
                }
              ].map((item, idx) => (
                <div key={idx} className="bg-black/30 border border-white/10 p-6 rounded-lg space-y-3 ares-cut-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase font-heading text-white tracking-wider">
                      {item.rule}
                    </span>
                    <span className="bg-green-950/80 text-green-400 border border-green-500/30 text-[9px] font-bold uppercase px-2 py-0.5 rounded font-mono">
                      {item.status}
                    </span>
                  </div>
                  <p className="text-xs text-marble/80 leading-relaxed">
                    {item.details}
                  </p>
                </div>
              ))}
            </div>

            {/* ESD & Carpet Static Mitigation */}
            <div className="bg-cyan-950/20 border border-cyan-500/30 p-6 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-cyan-400 font-bold uppercase text-xs font-heading tracking-wider">
                <ShieldCheck size={16} /> Electrostatic Discharge (ESD) & Carpet Field Mitigation Standard
              </div>
              <p className="text-xs text-marble/80 leading-relaxed">
                To prevent high-voltage electrostatic discharge from competition foam tiles jumping into Control Hub I2C ports, ARES #23247 incorporates conductive drag chains, ferrite choke cores on long servo extensions, and opto-isolated level shifters on dead-wheel quadrature encoder lines.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
