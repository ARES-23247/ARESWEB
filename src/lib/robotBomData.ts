/**
 * Robot Bill of Materials (BOM) & Inventory Data Structures and Helper Utilities
 * Team ARES 23247 FIRST® Tech Challenge Engineering Portal
 */

export type SubsystemCategory =
  | "Chassis & Drivetrain"
  | "Horizontal Linear Slides"
  | "Specimen Lift & Claw"
  | "Intake Roller & Tilt"
  | "Electrical & Sensors";

export type Vendor =
  | "goBILDA"
  | "REV Robotics"
  | "AndyMark"
  | "SendCutSend"
  | "McMaster-Carr";

export type ComponentCategory =
  | "Actuator"
  | "Mechanical"
  | "Hardware"
  | "Electrical"
  | "Sensor"
  | "Raw Material";

export interface BomItem {
  id: string;
  name: string;
  partNumber: string;
  subsystem: SubsystemCategory;
  vendor: Vendor;
  category: ComponentCategory;
  quantity: number;
  unitWeightGrams: number;
  unitCostUsd: number;
  description: string;
  specUrl?: string;
  cadModelAvailable?: boolean;
}

export const SUBSYSTEM_CATEGORIES: readonly SubsystemCategory[] = [
  "Chassis & Drivetrain",
  "Horizontal Linear Slides",
  "Specimen Lift & Claw",
  "Intake Roller & Tilt",
  "Electrical & Sensors",
] as const;

export const VENDORS: readonly Vendor[] = [
  "goBILDA",
  "REV Robotics",
  "AndyMark",
  "SendCutSend",
  "McMaster-Carr",
] as const;

export const FTC_ROBOT_WEIGHT_LIMIT_LBS = 42.0;
export const GRAMS_PER_POUND = 453.59237;
export const OUNCES_PER_POUND = 16.0;
export const GRAMS_PER_OUNCE = 28.349523125;

export interface WeightTally {
  grams: number;
  lbs: number;
  oz: number;
  cost: number;
  itemCount: number;
}

export interface RobotTotalTally {
  grams: number;
  lbs: number;
  oz: number;
  totalCost: number;
  totalParts: number;
  percentOfLimit: number;
  isLegal: boolean;
  marginLbs: number;
}

/**
 * Converts grams to pounds rounded to 2 decimal places by default.
 */
export function convertGramsToLbs(grams: number, decimals: number = 2): number {
  if (isNaN(grams) || grams < 0) return 0;
  const lbs = grams / GRAMS_PER_POUND;
  return Number(lbs.toFixed(decimals));
}

/**
 * Converts grams to ounces rounded to 2 decimal places by default.
 */
export function convertGramsToOz(grams: number, decimals: number = 2): number {
  if (isNaN(grams) || grams < 0) return 0;
  const oz = grams / GRAMS_PER_OUNCE;
  return Number(oz.toFixed(decimals));
}

/**
 * Converts pounds to grams.
 */
export function convertLbsToGrams(lbs: number, decimals: number = 1): number {
  if (isNaN(lbs) || lbs < 0) return 0;
  const grams = lbs * GRAMS_PER_POUND;
  return Number(grams.toFixed(decimals));
}

/**
 * Calculate weight and cost tally for a specific subsystem.
 */
export function calculateSubsystemWeight(
  items: readonly BomItem[],
  subsystem: SubsystemCategory,
): WeightTally {
  const subsystemItems = items.filter((item) => item.subsystem === subsystem);
  let totalGrams = 0;
  let totalCost = 0;
  let itemCount = 0;

  for (const item of subsystemItems) {
    const qty = Math.max(0, item.quantity);
    totalGrams += item.unitWeightGrams * qty;
    totalCost += item.unitCostUsd * qty;
    itemCount += qty;
  }

  return {
    grams: Number(totalGrams.toFixed(1)),
    lbs: convertGramsToLbs(totalGrams),
    oz: convertGramsToOz(totalGrams),
    cost: Number(totalCost.toFixed(2)),
    itemCount,
  };
}

/**
 * Calculate total robot weight, cost, parts tally, and FTC legal compliance.
 */
export function calculateTotalWeight(
  items: readonly BomItem[],
  weightLimitLbs: number = FTC_ROBOT_WEIGHT_LIMIT_LBS,
): RobotTotalTally {
  let totalGrams = 0;
  let totalCost = 0;
  let totalParts = 0;

  for (const item of items) {
    const qty = Math.max(0, item.quantity);
    totalGrams += item.unitWeightGrams * qty;
    totalCost += item.unitCostUsd * qty;
    totalParts += qty;
  }

  const lbs = convertGramsToLbs(totalGrams);
  const oz = convertGramsToOz(totalGrams);
  const percentOfLimit = weightLimitLbs > 0 ? Number(((lbs / weightLimitLbs) * 100).toFixed(1)) : 0;
  const isLegal = lbs <= weightLimitLbs;
  const marginLbs = Number((weightLimitLbs - lbs).toFixed(2));

  return {
    grams: Number(totalGrams.toFixed(1)),
    lbs,
    oz,
    totalCost: Number(totalCost.toFixed(2)),
    totalParts,
    percentOfLimit,
    isLegal,
    marginLbs,
  };
}

/**
 * Escape an RFC-4180 CSV cell value.
 */
function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return "";
  let str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * Export items to standard RFC-4180 compliant CSV format.
 */
export function exportBomToCsv(items: readonly BomItem[]): string {
  const headers = [
    "Subsystem",
    "Part Name",
    "Part Number",
    "Vendor",
    "Category",
    "Quantity",
    "Unit Weight (g)",
    "Total Weight (g)",
    "Total Weight (lbs)",
    "Unit Cost (USD)",
    "Total Cost (USD)",
    "Description",
  ];

  const rows: string[] = [headers.map(escapeCsvValue).join(",")];

  for (const item of items) {
    const qty = Math.max(0, item.quantity);
    const totalGrams = item.unitWeightGrams * qty;
    const totalLbs = convertGramsToLbs(totalGrams);
    const totalCost = Number((item.unitCostUsd * qty).toFixed(2));

    const row = [
      item.subsystem,
      item.name,
      item.partNumber,
      item.vendor,
      item.category,
      qty,
      item.unitWeightGrams,
      Number(totalGrams.toFixed(1)),
      totalLbs,
      item.unitCostUsd.toFixed(2),
      totalCost.toFixed(2),
      item.description,
    ];

    rows.push(row.map(escapeCsvValue).join(","));
  }

  return rows.join("\r\n");
}

export interface FilterBomOptions {
  subsystem?: SubsystemCategory | "All";
  vendor?: Vendor | "All";
  searchQuery?: string;
  category?: ComponentCategory | "All";
}

/**
 * Filter items by subsystem, vendor, component category, or search query.
 */
export function filterBomItems(
  items: readonly BomItem[],
  options: FilterBomOptions = {},
): BomItem[] {
  const {
    subsystem = "All",
    vendor = "All",
    searchQuery = "",
    category = "All",
  } = options;

  const query = searchQuery.trim().toLowerCase();

  return items.filter((item) => {
    if (subsystem !== "All" && item.subsystem !== subsystem) return false;
    if (vendor !== "All" && item.vendor !== vendor) return false;
    if (category !== "All" && item.category !== category) return false;

    if (query) {
      const matchName = item.name.toLowerCase().includes(query);
      const matchPart = item.partNumber.toLowerCase().includes(query);
      const matchDesc = item.description.toLowerCase().includes(query);
      const matchVendor = item.vendor.toLowerCase().includes(query);
      const matchSubsystem = item.subsystem.toLowerCase().includes(query);
      if (!matchName && !matchPart && !matchDesc && !matchVendor && !matchSubsystem) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Canonical default Bill of Materials inventory for ARES 23247 competition robots.
 */
export const DEFAULT_ROBOT_BOM_ITEMS: readonly BomItem[] = [
  // 1. Chassis & Drivetrain
  {
    id: "chassis-gobilda-yellowjacket-312",
    name: "goBILDA Yellowjacket Planetary Gear Motor (312 RPM, 19.2:1)",
    partNumber: "5202-0002-0019",
    subsystem: "Chassis & Drivetrain",
    vendor: "goBILDA",
    category: "Actuator",
    quantity: 4,
    unitWeightGrams: 350,
    unitCostUsd: 42.99,
    description: "High-torque 12V planetary drive motor powering the Strafer 4-wheel drive system.",
    specUrl: "https://www.gobilda.com/5202-series-yellow-jacket-planetary-gear-motor-19-2-1-ratio-24mm-length-8mm-rex-shaft-312-rpm-3-3-5v-encoder/",
    cadModelAvailable: true,
  },
  {
    id: "chassis-gobilda-strafer-channel",
    name: "goBILDA 1120 Series Pattern U-Channel (432mm, 17 Hole)",
    partNumber: "1120-0017-0432",
    subsystem: "Chassis & Drivetrain",
    vendor: "goBILDA",
    category: "Mechanical",
    quantity: 4,
    unitWeightGrams: 236,
    unitCostUsd: 14.99,
    description: "Rigid 6061-T6 aluminum extrusion side channels forming the perimeter chassis frame.",
    specUrl: "https://www.gobilda.com/1120-series-u-channel-17-hole-432mm-length/",
    cadModelAvailable: true,
  },
  {
    id: "chassis-andymark-compliant-wheels-4in",
    name: "AndyMark Compliant Wheels (4 in. OD, 35A Durometer, 1/2 in. Hex)",
    partNumber: "am-3079_35A",
    subsystem: "Chassis & Drivetrain",
    vendor: "AndyMark",
    category: "Mechanical",
    quantity: 4,
    unitWeightGrams: 110,
    unitCostUsd: 8.5,
    description: "High-traction compliant rubber drive wheels providing maximum field grip on foam tiles.",
    specUrl: "https://www.andymark.com/products/4-in-compliant-wheel-1-2-in-hex-bore",
    cadModelAvailable: true,
  },
  {
    id: "chassis-gobilda-miter-gears",
    name: "goBILDA 14-Tooth Bevel Gear Set (1:1 Ratio, M0.8, 8mm REX)",
    partNumber: "2315-0014-0008",
    subsystem: "Chassis & Drivetrain",
    vendor: "goBILDA",
    category: "Mechanical",
    quantity: 4,
    unitWeightGrams: 42,
    unitCostUsd: 13.99,
    description: "Case-hardened steel bevel gear pairs for right-angle drive transmission inside channel.",
    specUrl: "https://www.gobilda.com/bevel-gear-set-1-1-ratio-m0-8-14-tooth-8mm-rex-bore/",
    cadModelAvailable: true,
  },
  {
    id: "chassis-scs-polycarbonate-bellypan",
    name: "CNC Polycarbonate Chassis Bellypan & Drivetrain Gussets (1/4 in. Lexan)",
    partNumber: "SCS-LEX-BP-01",
    subsystem: "Chassis & Drivetrain",
    vendor: "SendCutSend",
    category: "Raw Material",
    quantity: 2,
    unitWeightGrams: 380,
    unitCostUsd: 38.5,
    description: "Precision CNC milled clear polycarbonate bottom armor and diagonal chassis cross-bracing.",
    specUrl: "https://sendcutsend.com/materials/polycarbonate/",
    cadModelAvailable: true,
  },
  {
    id: "chassis-mcmaster-ss-m4-fasteners",
    name: "McMaster-Carr 18-8 Stainless Steel Button Head Screws (M4 x 10mm)",
    partNumber: "92095A212",
    subsystem: "Chassis & Drivetrain",
    vendor: "McMaster-Carr",
    category: "Hardware",
    quantity: 48,
    unitWeightGrams: 2.1,
    unitCostUsd: 0.18,
    description: "Corrosion-resistant high-tensile stainless steel socket screws for structural channel assembly.",
    specUrl: "https://www.mcmaster.com/92095A212/",
    cadModelAvailable: false,
  },

  // 2. Horizontal Linear Slides
  {
    id: "slides-rev-ultraplanetary-gearbox",
    name: "REV UltraPlanetary Gearbox Kit (Dual Stage 3:1 + 4:1 Cartridge)",
    partNumber: "REV-41-1600",
    subsystem: "Horizontal Linear Slides",
    vendor: "REV Robotics",
    category: "Mechanical",
    quantity: 2,
    unitWeightGrams: 215,
    unitCostUsd: 39.5,
    description: "Configurable modular planetary gearbox providing 12:1 reduction for rapid slide extension.",
    specUrl: "https://www.revrobotics.com/rev-41-1600/",
    cadModelAvailable: true,
  },
  {
    id: "slides-gobilda-yellowjacket-1150",
    name: "goBILDA Yellowjacket Planetary Gear Motor (1150 RPM, 5.2:1)",
    partNumber: "5202-0002-0005",
    subsystem: "Horizontal Linear Slides",
    vendor: "goBILDA",
    category: "Actuator",
    quantity: 1,
    unitWeightGrams: 320,
    unitCostUsd: 42.99,
    description: "Ultra-fast extension drive motor optimized for low-inertia horizontal extension stroke.",
    specUrl: "https://www.gobilda.com/5202-series-yellow-jacket-planetary-gear-motor-5-2-1-ratio-24mm-length-8mm-rex-shaft-1150-rpm-3-3-5v-encoder/",
    cadModelAvailable: true,
  },
  {
    id: "slides-gobilda-viper-stages",
    name: "goBILDA Viper Slide Kit (4-Stage Ball Bearing, 336mm Draw)",
    partNumber: "7500-0004-0336",
    subsystem: "Horizontal Linear Slides",
    vendor: "goBILDA",
    category: "Mechanical",
    quantity: 2,
    unitWeightGrams: 485,
    unitCostUsd: 59.99,
    description: "Precision cascading ball-bearing linear slides delivering ultra-smooth horizontal reach.",
    specUrl: "https://www.gobilda.com/viper-slide-kit-lead-screw-driven-336mm-stroke/",
    cadModelAvailable: true,
  },
  {
    id: "slides-mcmaster-gt2-timing-belts",
    name: "McMaster-Carr GT2 Neoprene Timing Belt (6mm Wide, 2mm Pitch, 1200mm)",
    partNumber: "7959K18",
    subsystem: "Horizontal Linear Slides",
    vendor: "McMaster-Carr",
    category: "Hardware",
    quantity: 2,
    unitWeightGrams: 28,
    unitCostUsd: 9.4,
    description: "Fiberglass-reinforced neoprene synchronous timing belt for backlash-free slide staging.",
    specUrl: "https://www.mcmaster.com/7959K18/",
    cadModelAvailable: false,
  },
  {
    id: "slides-scs-polycarbonate-carriage-plates",
    name: "CNC Polycarbonate Slide Carriage Mounting Plates (1/8 in. Polycarbonate)",
    partNumber: "SCS-LEX-CP-04",
    subsystem: "Horizontal Linear Slides",
    vendor: "SendCutSend",
    category: "Raw Material",
    quantity: 4,
    unitWeightGrams: 75,
    unitCostUsd: 14.2,
    description: "Lightweight CNC laser cut polycarbonate mounting adapter plates between slide stages.",
    specUrl: "https://sendcutsend.com/materials/polycarbonate/",
    cadModelAvailable: true,
  },

  // 3. Specimen Lift & Claw
  {
    id: "lift-axon-max-servo",
    name: "Axon MAX High-Torque Programmable Brushless Smart Servo",
    partNumber: "AXON-MAX-01",
    subsystem: "Specimen Lift & Claw",
    vendor: "goBILDA",
    category: "Actuator",
    quantity: 2,
    unitWeightGrams: 78,
    unitCostUsd: 74.99,
    description: "High-torque (35 kg-cm) steel-geared brushless smart servo with absolute magnetic encoder for claw articulation.",
    specUrl: "https://axon-robotics.com/products/max",
    cadModelAvailable: true,
  },
  {
    id: "lift-gobilda-yellowjacket-435",
    name: "goBILDA Yellowjacket Planetary Gear Motor (435 RPM, 13.7:1)",
    partNumber: "5202-0002-0014",
    subsystem: "Specimen Lift & Claw",
    vendor: "goBILDA",
    category: "Actuator",
    quantity: 2,
    unitWeightGrams: 345,
    unitCostUsd: 42.99,
    description: "Dual-motor high-speed vertical lift drive with closed-loop PID position holding.",
    specUrl: "https://www.gobilda.com/5202-series-yellow-jacket-planetary-gear-motor-13-7-1-ratio-24mm-length-8mm-rex-shaft-435-rpm-3-3-5v-encoder/",
    cadModelAvailable: true,
  },
  {
    id: "lift-rev-ultraplanetary-spool-rigging",
    name: "REV UltraPlanetary 1/2 in. Hex Shaft Spool & Dyneema Rigging Cable",
    partNumber: "REV-41-1647",
    subsystem: "Specimen Lift & Claw",
    vendor: "REV Robotics",
    category: "Mechanical",
    quantity: 2,
    unitWeightGrams: 68,
    unitCostUsd: 15.0,
    description: "Machined aluminum hex winch spool with 300 lb test ultra-high-molecular-weight polyethylene line.",
    specUrl: "https://www.revrobotics.com/rev-41-1647/",
    cadModelAvailable: true,
  },
  {
    id: "lift-scs-polycarbonate-claw-fingers",
    name: "CNC Polycarbonate Specimen Claw Fingers (1/4 in. Clear Polycarbonate)",
    partNumber: "SCS-CLAW-02",
    subsystem: "Specimen Lift & Claw",
    vendor: "SendCutSend",
    category: "Raw Material",
    quantity: 2,
    unitWeightGrams: 64,
    unitCostUsd: 12.75,
    description: "Custom compliant dual-action specimen gripper jaws CNC milled by SendCutSend.",
    specUrl: "https://sendcutsend.com/materials/polycarbonate/",
    cadModelAvailable: true,
  },
  {
    id: "lift-mcmaster-silicone-tubing-grippers",
    name: "McMaster-Carr High-Grip Silicone Tubing for Claw Gripper Tips (1/4 in. ID)",
    partNumber: "5236K512",
    subsystem: "Specimen Lift & Claw",
    vendor: "McMaster-Carr",
    category: "Hardware",
    quantity: 4,
    unitWeightGrams: 12,
    unitCostUsd: 3.2,
    description: "50A durometer high-friction silicone elastomer sleeves slipped over claw tips.",
    specUrl: "https://www.mcmaster.com/5236K512/",
    cadModelAvailable: false,
  },

  // 4. Intake Roller & Tilt
  {
    id: "intake-axon-max-servo-tilt",
    name: "Axon MAX Smart Servo (Intake Arm Articulation / Wrist Tilt)",
    partNumber: "AXON-MAX-02",
    subsystem: "Intake Roller & Tilt",
    vendor: "goBILDA",
    category: "Actuator",
    quantity: 2,
    unitWeightGrams: 78,
    unitCostUsd: 74.99,
    description: "Direct-drive servo articulation for intake deployment angle and floor alignment.",
    specUrl: "https://axon-robotics.com/products/max",
    cadModelAvailable: true,
  },
  {
    id: "intake-andymark-compliant-wheels-2in",
    name: "AndyMark Compliant Wheels (2 in. OD, 35A Durometer, 1/2 in. Hex Core)",
    partNumber: "am-3814_35A",
    subsystem: "Intake Roller & Tilt",
    vendor: "AndyMark",
    category: "Mechanical",
    quantity: 8,
    unitWeightGrams: 32,
    unitCostUsd: 5.75,
    description: "Ultra-soft compliant roller wheels for instant sample acquisition without jamming.",
    specUrl: "https://www.andymark.com/products/2-in-compliant-wheel-1-2-in-hex-bore",
    cadModelAvailable: true,
  },
  {
    id: "intake-rev-hex-shafting",
    name: "REV 5mm Hex Shafting & High-Speed Geared Motor Core",
    partNumber: "REV-41-1347",
    subsystem: "Intake Roller & Tilt",
    vendor: "REV Robotics",
    category: "Mechanical",
    quantity: 2,
    unitWeightGrams: 95,
    unitCostUsd: 18.5,
    description: "Hardened stainless steel hex drive shaft spinning the active roller bar assembly.",
    specUrl: "https://www.revrobotics.com/rev-41-1347/",
    cadModelAvailable: true,
  },
  {
    id: "intake-scs-polycarbonate-sideplates",
    name: "CNC Polycarbonate Intake Side Plates & Funnel Guides (1/8 in. Lexan)",
    partNumber: "SCS-INTK-01",
    subsystem: "Intake Roller & Tilt",
    vendor: "SendCutSend",
    category: "Raw Material",
    quantity: 2,
    unitWeightGrams: 110,
    unitCostUsd: 19.8,
    description: "Laser cut polycarbonate side shields directing game elements into central intake hopper.",
    specUrl: "https://sendcutsend.com/materials/polycarbonate/",
    cadModelAvailable: true,
  },
  {
    id: "intake-mcmaster-hex-bearings",
    name: "McMaster-Carr Flanged Ball Bearings (1/2 in. Hex Bore, Shielded)",
    partNumber: "6455K11",
    subsystem: "Intake Roller & Tilt",
    vendor: "McMaster-Carr",
    category: "Hardware",
    quantity: 6,
    unitWeightGrams: 14,
    unitCostUsd: 4.85,
    description: "Shielded chrome steel flanged ball bearings supporting active spinner hex shafts.",
    specUrl: "https://www.mcmaster.com/6455K11/",
    cadModelAvailable: false,
  },

  // 5. Electrical & Sensors
  {
    id: "elec-rev-control-hub",
    name: "REV Control Hub (Integrated Android OS, 9-Axis IMU, 4 Motor / 6 Servo Ports)",
    partNumber: "REV-31-1595",
    subsystem: "Electrical & Sensors",
    vendor: "REV Robotics",
    category: "Electrical",
    quantity: 1,
    unitWeightGrams: 310,
    unitCostUsd: 360.0,
    description: "Main robot computer running the Android OS, FTC SDK, hardware interfaces, and 5GHz Wi-Fi.",
    specUrl: "https://www.revrobotics.com/rev-31-1595/",
    cadModelAvailable: true,
  },
  {
    id: "elec-rev-expansion-hub",
    name: "REV Expansion Hub (Secondary 4-Channel Actuator Controller)",
    partNumber: "REV-31-1153",
    subsystem: "Electrical & Sensors",
    vendor: "REV Robotics",
    category: "Electrical",
    quantity: 1,
    unitWeightGrams: 280,
    unitCostUsd: 220.0,
    description: "RS-485 linked auxiliary module expanding motor ports, servo channels, and I2C buses.",
    specUrl: "https://www.revrobotics.com/rev-31-1153/",
    cadModelAvailable: true,
  },
  {
    id: "elec-rev-color-sensor-v3",
    name: "REV Color Sensor V3 (I2C Proximity & RGB Color Detector)",
    partNumber: "REV-31-1557",
    subsystem: "Electrical & Sensors",
    vendor: "REV Robotics",
    category: "Sensor",
    quantity: 2,
    unitWeightGrams: 18,
    unitCostUsd: 24.0,
    description: "Digital color and proximity sensors for autonomous sample discrimination and alignment.",
    specUrl: "https://www.revrobotics.com/rev-31-1557/",
    cadModelAvailable: true,
  },
  {
    id: "elec-rev-touch-sensors",
    name: "REV Magnetic Limit Switch & Digital Touch Sensors",
    partNumber: "REV-31-1425",
    subsystem: "Electrical & Sensors",
    vendor: "REV Robotics",
    category: "Sensor",
    quantity: 4,
    unitWeightGrams: 12,
    unitCostUsd: 12.5,
    description: "Hall-effect and tactile homing switches for zero-calibrating slide and lift coordinates.",
    specUrl: "https://www.revrobotics.com/rev-31-1425/",
    cadModelAvailable: true,
  },
  {
    id: "elec-andymark-12v-battery",
    name: "AndyMark 12V 3000mAh NiMH Slim Robot Battery Pack w/ XT30",
    partNumber: "am-3062b",
    subsystem: "Electrical & Sensors",
    vendor: "AndyMark",
    category: "Electrical",
    quantity: 1,
    unitWeightGrams: 580,
    unitCostUsd: 49.0,
    description: "Legal competition 10-cell 12V battery providing sustained peak current for 8 motors.",
    specUrl: "https://www.andymark.com/products/12v-3000mah-nimh-battery",
    cadModelAvailable: true,
  },
  {
    id: "elec-rev-power-switch",
    name: "REV Main Robot Power Switch & 20A Circuit Breaker",
    partNumber: "REV-31-1387",
    subsystem: "Electrical & Sensors",
    vendor: "REV Robotics",
    category: "Electrical",
    quantity: 1,
    unitWeightGrams: 62,
    unitCostUsd: 16.0,
    description: "Master safety power cutoff switch and resettable 20A overcurrent thermal breaker.",
    specUrl: "https://www.revrobotics.com/rev-31-1387/",
    cadModelAvailable: true,
  },
  {
    id: "elec-mcmaster-wire-loom-anchors",
    name: "McMaster-Carr Braided Cable Sleeving & Zip-Tie Anchor Mounts",
    partNumber: "9170K43",
    subsystem: "Electrical & Sensors",
    vendor: "McMaster-Carr",
    category: "Hardware",
    quantity: 1,
    unitWeightGrams: 45,
    unitCostUsd: 14.5,
    description: "Abrasion-resistant expandable PET wire looming and adhesive cable routing fixtures.",
    specUrl: "https://www.mcmaster.com/9170K43/",
    cadModelAvailable: false,
  },
] as const;
