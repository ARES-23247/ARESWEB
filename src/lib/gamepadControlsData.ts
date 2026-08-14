export type DriverId = "driver1" | "driver2";

export type InputType =
  | "analog_stick"
  | "analog_trigger"
  | "digital_button"
  | "dpad";

export type ControlCategory =
  | "Drivetrain"
  | "Intake"
  | "Scoring"
  | "Elevator"
  | "Endgame"
  | "Automation"
  | "System";

export type ResponseCurve =
  | "Linear"
  | "Cubic Exponential (x³)"
  | "Quadratic (x²)"
  | "Stepped Discrete"
  | "Direct Digital";

export type ButtonLocation =
  | "left_stick"
  | "right_stick"
  | "dpad_up"
  | "dpad_down"
  | "dpad_left"
  | "dpad_right"
  | "button_a"
  | "button_b"
  | "button_x"
  | "button_y"
  | "left_bumper"
  | "right_bumper"
  | "left_trigger"
  | "right_trigger"
  | "button_back"
  | "button_start";

export interface DriverProfile {
  id: DriverId;
  name: string;
  title: string;
  callsign: string;
  badgeLabel: string;
  description: string;
  primaryFocus: string;
  subsystems: string[];
  themeColor: string;
  secondaryColor: string;
}

export interface ControlMapping {
  id: string;
  buttonId: ButtonLocation;
  buttonLabel: string;
  driverId: DriverId;
  actionName: string;
  category: ControlCategory;
  description: string;
  technicalDetails: string;
  inputType: InputType;
  deadband: string;
  safetyInterlocks: string[];
  responseCurve: ResponseCurve;
  hardwareTarget: string;
  telemetryKey?: string;
  emergencyNotes?: string;
}

export interface ButtonMeta {
  id: ButtonLocation;
  name: string;
  shortLabel: string;
  group: "sticks" | "dpad" | "face_buttons" | "shoulders" | "center";
}

export const CONTROLLER_BUTTONS: ButtonMeta[] = [
  { id: "left_stick", name: "Left Thumbstick", shortLabel: "LS", group: "sticks" },
  { id: "right_stick", name: "Right Thumbstick", shortLabel: "RS", group: "sticks" },
  { id: "dpad_up", name: "D-Pad Up", shortLabel: "D-Up", group: "dpad" },
  { id: "dpad_down", name: "D-Pad Down", shortLabel: "D-Down", group: "dpad" },
  { id: "dpad_left", name: "D-Pad Left", shortLabel: "D-Left", group: "dpad" },
  { id: "dpad_right", name: "D-Pad Right", shortLabel: "D-Right", group: "dpad" },
  { id: "button_a", name: "Button A", shortLabel: "A", group: "face_buttons" },
  { id: "button_b", name: "Button B", shortLabel: "B", group: "face_buttons" },
  { id: "button_x", name: "Button X", shortLabel: "X", group: "face_buttons" },
  { id: "button_y", name: "Button Y", shortLabel: "Y", group: "face_buttons" },
  { id: "left_bumper", name: "Left Bumper", shortLabel: "LB", group: "shoulders" },
  { id: "right_bumper", name: "Right Bumper", shortLabel: "RB", group: "shoulders" },
  { id: "left_trigger", name: "Left Trigger", shortLabel: "LT", group: "shoulders" },
  { id: "right_trigger", name: "Right Trigger", shortLabel: "RT", group: "shoulders" },
  { id: "button_back", name: "Back / Select", shortLabel: "Back", group: "center" },
  { id: "button_start", name: "Start / Menu", shortLabel: "Start", group: "center" },
];

export const DRIVERS: Record<DriverId, DriverProfile> = {
  driver1: {
    id: "driver1",
    name: "Driver 1",
    title: "Chassis Drivetrain & Field Navigation Pilot",
    callsign: "Pilot",
    badgeLabel: "DRIVER 1 · FIELD PILOT",
    description:
      "Responsible for holonomic field-centric chassis translation, dynamic yaw orientation, heading alignment, sprint throttling, and emergency field braking.",
    primaryFocus: "Mecanum Drivetrain, IMU Heading, Field Navigation, Auto-Align Assist",
    subsystems: ["4x Gobilda 5203 Yellowjacket", "BNO055 IMU", "SparkFun OTOS Odometry", "Limelight 3G"],
    themeColor: "from-blue-600 to-cyan-500",
    secondaryColor: "text-ares-cyan",
  },
  driver2: {
    id: "driver2",
    name: "Driver 2",
    title: "Subsystems & Manipulator Operator",
    callsign: "Operator",
    badgeLabel: "DRIVER 2 · SYSTEMS OPERATOR",
    description:
      "Responsible for dual linear slide elevator height presets, active compliance roller intake, high-torque claw articulation, specimen wall loading, and endgame climb lock.",
    primaryFocus: "Dual Viper Slides, Multi-Axis Claw Wrist, Intake Roller, Specimen Hang, Endgame Ratchet",
    subsystems: ["2x Gobilda 1150RPM Dual Slides", "Axon Mini Programmable Servos", "Rev UltraPlanetary", "REV Color Sensor V3"],
    themeColor: "from-ares-red to-amber-500",
    secondaryColor: "text-ares-gold",
  },
};

export const CONTROL_MAPPINGS: ControlMapping[] = [
  // ================= DRIVER 1 (Pilot) MAPPINGS =================
  {
    id: "d1-left-stick",
    buttonId: "left_stick",
    buttonLabel: "Left Thumbstick (Axes X/Y + Click)",
    driverId: "driver1",
    actionName: "Field-Centric Drivetrain (Translation & Strafe)",
    category: "Drivetrain",
    description:
      "Translates the robot in any 2D vector across the field relative to the driver station reference frame. Click toggles 30% precision creep mode.",
    technicalDetails:
      "Holonomic inverse kinematics matrix applied across 4x Mecanum wheels with closed-loop velocity PID. Click acts as momentary precision scaler toggle.",
    inputType: "analog_stick",
    deadband: "0.08 (8% radial deadband)",
    safetyInterlocks: [
      "Slew rate acceleration limiter (2.8 m/s²) prevents wheel slip and excessive current draw",
      "Dynamic throttle reduction when elevator slides are elevated above 50% height",
    ],
    responseCurve: "Cubic Exponential (x³)",
    hardwareTarget: "4x GoBILDA 5203 Yellowjacket Planetary Motors (312 RPM, 19.2:1)",
    telemetryKey: "drive_vec_translation",
    emergencyNotes: "Release sticks to zero drive output; dynamic regenerative braking activates automatically.",
  },
  {
    id: "d1-right-stick",
    buttonId: "right_stick",
    buttonLabel: "Right Thumbstick (Yaw Axis + Click)",
    driverId: "driver1",
    actionName: "Chassis Yaw & Heading Lock",
    category: "Drivetrain",
    description:
      "Controls angular rotational velocity (spinning left/right) independent of translation. Click activates auto-snap to nearest 90° cardinal heading.",
    technicalDetails:
      "Feedforward + PID yaw velocity controller mapped to gyro angular rate. Right stick click engages Heading Lock mode with ±0.5° target tolerance.",
    inputType: "analog_stick",
    deadband: "0.08 (8% radial deadband)",
    safetyInterlocks: [
      "Anti-tip rotational speed damping active when high-altitude slide extension is detected",
      "Auto-snap disables if IMU drift exceeds 10°/minute fault threshold",
    ],
    responseCurve: "Cubic Exponential (x³)",
    hardwareTarget: "4x GoBILDA Yellowjacket Mecanum + BNO055 IMU",
    telemetryKey: "drive_yaw_velocity",
  },
  {
    id: "d1-button-a",
    buttonId: "button_a",
    buttonLabel: "Button A (South)",
    driverId: "driver1",
    actionName: "Auto-Align to Scoring Submersible / Basket",
    category: "Automation",
    description:
      "Computer vision trajectory tracking locks heading and strafe alignment to the closest alliance scoring target (Sample Submersible or High Basket).",
    technicalDetails:
      "Executes AprilTag / Limelight 3G optical pipeline with continuous pursuit algorithm for sub-inch docking position.",
    inputType: "digital_button",
    deadband: "N/A",
    safetyInterlocks: [
      "Driver stick input > 15% immediately aborts autonomous alignment routine",
      "Timeout safety abort if target vision lock is lost for > 400ms",
    ],
    responseCurve: "Direct Digital",
    hardwareTarget: "Limelight 3G Vision Processing + OTOS Odometry",
    telemetryKey: "vision_align_active",
  },
  {
    id: "d1-button-b",
    buttonId: "button_b",
    buttonLabel: "Button B (East)",
    driverId: "driver1",
    actionName: "Emergency Field Brake (X-Lock Wheels)",
    category: "Drivetrain",
    description:
      "Turns all four mecanum wheels inward at 45° angles into an X-formation, locking robot position against defensive pushing or slope roll.",
    technicalDetails:
      "Sets motor zero-power behavior to BRAKE with closed-loop PID holding wheel encoder zero-offsets.",
    inputType: "digital_button",
    deadband: "N/A",
    safetyInterlocks: [
      "Instantly cuts all translation power and commands maximum holding torque",
      "Auto-releases immediately when driver commands stick throttle > 25%",
    ],
    responseCurve: "Direct Digital",
    hardwareTarget: "4x GoBILDA 5203 Electronic Braking Mode",
    telemetryKey: "drive_brake_xlock",
    emergencyNotes: "Primary defense stabilization lock against collisions.",
  },
  {
    id: "d1-button-x",
    buttonId: "button_x",
    buttonLabel: "Button X (West)",
    driverId: "driver1",
    actionName: "Auto-Align Specimen Rung (Chamber Perpendicular)",
    category: "Automation",
    description:
      "Autonomous assist aligns the chassis exactly perpendicular to the specimen submersible chamber for rapid human-player and scoring cycles.",
    technicalDetails:
      "Fuses optical distance sensors and OTOS position estimate to compute shortest orthogonal vector to chamber bar.",
    inputType: "digital_button",
    deadband: "N/A",
    safetyInterlocks: [
      "Stops 4 inches before contact if front ToF laser rangefinder reads barrier obstructed",
      "Manual stick override clears trajectory instantly",
    ],
    responseCurve: "Direct Digital",
    hardwareTarget: "REV 2m Laser Distance Sensor + Drive PID",
    telemetryKey: "specimen_dock_assist",
  },
  {
    id: "d1-button-y",
    buttonId: "button_y",
    buttonLabel: "Button Y (North)",
    driverId: "driver1",
    actionName: "Gyro IMU Zero / Field-Centric Reset",
    category: "System",
    description:
      "Re-calibrates the field-centric 0° forward axis to match the robot's current physical heading on the field.",
    technicalDetails:
      "Recalculates offset angle in IMU heading coordinate transform: offset = rawHeading - allianceReference.",
    inputType: "digital_button",
    deadband: "N/A",
    safetyInterlocks: [
      "Safety interlock: Robot translational velocity must be < 0.05 m/s (stationary) to prevent skewed heading bias",
      "Requires 250ms press debounce to avoid accidental in-match resets",
    ],
    responseCurve: "Direct Digital",
    hardwareTarget: "Internal 6-Axis BNO055 IMU / NavX Sensor",
    telemetryKey: "imu_heading_zero",
  },
  {
    id: "d1-left-bumper",
    buttonId: "left_bumper",
    buttonLabel: "Left Bumper (LB)",
    driverId: "driver1",
    actionName: "Slow / Precision Maneuver Hold (40% Speed)",
    category: "Drivetrain",
    description:
      "Scales max translational and rotational power down to 40% while held, ideal for millimeter-precision sample alignment.",
    technicalDetails:
      "Applies 0.40x multiplier to joyTranslation and joyYaw before kinematic motor distribution.",
    inputType: "digital_button",
    deadband: "N/A",
    safetyInterlocks: [
      "Instantly overrides and cancels Turbo Boost mode if both bumpers are pressed",
    ],
    responseCurve: "Direct Digital",
    hardwareTarget: "Software Motor Speed Scaler",
    telemetryKey: "speed_mode_slow",
  },
  {
    id: "d1-right-bumper",
    buttonId: "right_bumper",
    buttonLabel: "Right Bumper (RB)",
    driverId: "driver1",
    actionName: "Turbo Boost / Max Velocity Sprint (100% Speed)",
    category: "Drivetrain",
    description:
      "Bypasses standard 80% current-saving power cap to allow 100% full-throttle sprints across open field lanes.",
    technicalDetails:
      "Sets maximum allowed duty cycle to 1.0 (12V nominal output) while monitoring battery bus voltage.",
    inputType: "digital_button",
    deadband: "N/A",
    safetyInterlocks: [
      "Auto-inhibited if main 12V battery drops below 11.2V under load to avoid brownout",
      "Inhibited if elevator slide height is > 200mm above resting position",
    ],
    responseCurve: "Direct Digital",
    hardwareTarget: "Direct Battery Bus Drive Delivery",
    telemetryKey: "speed_mode_turbo",
  },
  {
    id: "d1-left-trigger",
    buttonId: "left_trigger",
    buttonLabel: "Left Trigger (LT - Analog)",
    driverId: "driver1",
    actionName: "Analog Dynamic Progressive Brake",
    category: "Drivetrain",
    description:
      "Provides smooth, analog-controlled deceleration from 0% to 100% dynamic braking resistance to avoid tipping under momentum.",
    technicalDetails:
      "Calculates proportional motor counter-torque based on trigger displacement depth.",
    inputType: "analog_trigger",
    deadband: "0.05 (5% trigger deadband)",
    safetyInterlocks: [
      "Progressive brake command overrides forward throttle commands above 50% trigger pull",
    ],
    responseCurve: "Linear",
    hardwareTarget: "4x Drive Motor Controllers (Dynamic Regenerative Resistance)",
    telemetryKey: "analog_brake_depth",
  },
  {
    id: "d1-right-trigger",
    buttonId: "right_trigger",
    buttonLabel: "Right Trigger (RT - Analog)",
    driverId: "driver1",
    actionName: "Straight-Line Sprint Lock (Heading Stabilized)",
    category: "Drivetrain",
    description:
      "Locks heading to current direction and drives straight forward with analog speed control, eliminating driver drift during long runs.",
    technicalDetails:
      "PID heading controller applies micro-yaw corrections to keep lateral drift < 0.25 inches over 12 feet.",
    inputType: "analog_trigger",
    deadband: "0.05 (5% trigger deadband)",
    safetyInterlocks: [
      "Heading stabilization auto-corrects wheel slippage via optical odometry",
    ],
    responseCurve: "Linear",
    hardwareTarget: "SparkFun OTOS Odometry + Drivetrain PID",
    telemetryKey: "straight_sprint_active",
  },
  {
    id: "d1-dpad-up",
    buttonId: "dpad_up",
    buttonLabel: "D-Pad Up",
    driverId: "driver1",
    actionName: "Micro-Step Forward (2.0 Inches)",
    category: "Drivetrain",
    description:
      "Pulses the drivetrain exactly 2.0 inches forward at low velocity for millimeter-precise docking.",
    technicalDetails:
      "Executes trapezoidal motion profile targeting +2.0 inches in robot coordinates.",
    inputType: "dpad",
    deadband: "N/A",
    safetyInterlocks: [
      "Debounced at 250ms interval to prevent accidental rapid repeat triggers",
    ],
    responseCurve: "Stepped Discrete",
    hardwareTarget: "Drive Wheel Optical Encoders",
    telemetryKey: "micro_step_y_pos",
  },
  {
    id: "d1-dpad-down",
    buttonId: "dpad_down",
    buttonLabel: "D-Pad Down",
    driverId: "driver1",
    actionName: "Micro-Step Backward (2.0 Inches)",
    category: "Drivetrain",
    description:
      "Pulses the drivetrain exactly 2.0 inches backward at low velocity.",
    technicalDetails:
      "Executes trapezoidal motion profile targeting -2.0 inches in robot coordinates.",
    inputType: "dpad",
    deadband: "N/A",
    safetyInterlocks: [
      "Debounced at 250ms interval",
    ],
    responseCurve: "Stepped Discrete",
    hardwareTarget: "Drive Wheel Optical Encoders",
    telemetryKey: "micro_step_y_neg",
  },
  {
    id: "d1-dpad-left",
    buttonId: "dpad_left",
    buttonLabel: "D-Pad Left",
    driverId: "driver1",
    actionName: "Micro-Step Strafe Left (2.0 Inches)",
    category: "Drivetrain",
    description:
      "Pulses the chassis sideways 2.0 inches to the left without rotating heading.",
    technicalDetails:
      "Executes holonomic strafe motion profile targeting -2.0 inches along X-axis.",
    inputType: "dpad",
    deadband: "N/A",
    safetyInterlocks: [
      "Debounced at 250ms interval",
    ],
    responseCurve: "Stepped Discrete",
    hardwareTarget: "Drive Wheel Optical Encoders",
    telemetryKey: "micro_step_x_neg",
  },
  {
    id: "d1-dpad-right",
    buttonId: "dpad_right",
    buttonLabel: "D-Pad Right",
    driverId: "driver1",
    actionName: "Micro-Step Strafe Right (2.0 Inches)",
    category: "Drivetrain",
    description:
      "Pulses the chassis sideways 2.0 inches to the right without rotating heading.",
    technicalDetails:
      "Executes holonomic strafe motion profile targeting +2.0 inches along X-axis.",
    inputType: "dpad",
    deadband: "N/A",
    safetyInterlocks: [
      "Debounced at 250ms interval",
    ],
    responseCurve: "Stepped Discrete",
    hardwareTarget: "Drive Wheel Optical Encoders",
    telemetryKey: "micro_step_x_pos",
  },
  {
    id: "d1-button-back",
    buttonId: "button_back",
    buttonLabel: "Back / Select Button",
    driverId: "driver1",
    actionName: "Driver Station Telemetry HUD Page Cycle",
    category: "System",
    description:
      "Cycles the active telemetry diagnostics view on the Driver Station phone/tablet (Voltage, Temperatures, Loop Frequency, Motor Amperages).",
    technicalDetails:
      "Emits HUD switch packet over FTC Wi-Fi Direct socket; returns haptic gamepad rumble on acknowledgment.",
    inputType: "digital_button",
    deadband: "N/A",
    safetyInterlocks: [
      "Read-only command; cannot interrupt active motor control loops",
    ],
    responseCurve: "Direct Digital",
    hardwareTarget: "FTC Dashboard & Driver Station Telemetry",
    telemetryKey: "hud_page_index",
  },
  {
    id: "d1-button-start",
    buttonId: "button_start",
    buttonLabel: "Start / Menu Button",
    driverId: "driver1",
    actionName: "Drive Coach Status Acknowledge / Clear Alerts",
    category: "System",
    description:
      "Acknowledges non-critical sensor warnings and confirms drive team ready state for autonomous and tele-op transitions.",
    technicalDetails:
      "Clears transient fault flags in team telemetry register.",
    inputType: "digital_button",
    deadband: "N/A",
    safetyInterlocks: [
      "Does not override critical hardware stall protection or emergency motor cutoffs",
    ],
    responseCurve: "Direct Digital",
    hardwareTarget: "ARES State Machine Controller",
    telemetryKey: "fault_ack_state",
  },

  // ================= DRIVER 2 (Operator) MAPPINGS =================
  {
    id: "d2-left-stick",
    buttonId: "left_stick",
    buttonLabel: "Left Thumbstick (Elevator Y-Axis + Arm Reach X-Axis)",
    driverId: "driver2",
    actionName: "Manual Slide Elevation & Extension Override",
    category: "Elevator",
    description:
      "Manual proportional control of vertical dual linear slides (Y-axis) and horizontal reach extension (X-axis). Click calibrates zero position.",
    technicalDetails:
      "Applies PID velocity feedforward to dual spool motors. Click commands low-speed descent until magnetic limit switch trips, zeroing encoder ticks.",
    inputType: "analog_stick",
    deadband: "0.10 (10% radial deadband)",
    safetyInterlocks: [
      "Software soft-limits (0mm to 980mm) prevent mechanical binding at travel extremes",
      "Current-limiting stall protection cuts power if motor exceeds 9.5A for > 150ms",
    ],
    responseCurve: "Quadratic (x²)",
    hardwareTarget: "2x GoBILDA 1150 RPM Yellowjacket Motors + String Potentiometer",
    telemetryKey: "slide_manual_override",
    emergencyNotes: "Slide brake holds position when stick returns to center.",
  },
  {
    id: "d2-right-stick",
    buttonId: "right_stick",
    buttonLabel: "Right Thumbstick (Wrist Pitch Y-Axis + Claw Roll X-Axis)",
    driverId: "driver2",
    actionName: "Intake Wrist Pitch & Claw Roll Articulation",
    category: "Intake",
    description:
      "Controls fine pitch angle (tilt up/down) and continuous axial roll (twist left/right) of the manipulator wrist. Click resets wrist to center pose.",
    technicalDetails:
      "Dual servo PWM interpolation mapped across 0°–270° range. Click smoothly interpolates claw to 45° neutral transit pose in 120ms.",
    inputType: "analog_stick",
    deadband: "0.08 (8% radial deadband)",
    safetyInterlocks: [
      "Collision safeguard: Prevents wrist tuck when claw contains sample larger than 3.5 inches",
      "Prevents roll rotation when elevator slides are fully compressed inside perimeter",
    ],
    responseCurve: "Linear",
    hardwareTarget: "2x Axon Mini High-Speed Programmable Servos",
    telemetryKey: "wrist_pitch_roll_angles",
  },
  {
    id: "d2-button-a",
    buttonId: "button_a",
    buttonLabel: "Button A (South)",
    driverId: "driver2",
    actionName: "Intake Ground Pickup Sequence (Macro)",
    category: "Intake",
    description:
      "One-touch automated sequence: Lowers wrist to ground angle, opens claw fingers, and starts active intake roller.",
    technicalDetails:
      "Coordinates 3-step state machine with color sensor trigger to auto-clamp sample on entry.",
    inputType: "digital_button",
    deadband: "N/A",
    safetyInterlocks: [
      "REV Color Sensor proximity detector auto-stops roller and closes claw when sample is detected in chamber",
      "Macro aborts if slide is extended above 150mm",
    ],
    responseCurve: "Direct Digital",
    hardwareTarget: "Wrist Servo + Roller Motor + REV Color Sensor V3",
    telemetryKey: "intake_macro_state",
  },
  {
    id: "d2-button-b",
    buttonId: "button_b",
    buttonLabel: "Button B (East)",
    driverId: "driver2",
    actionName: "Specimen Wall Loading Pose",
    category: "Scoring",
    description:
      "Positions claw at the exact height, angle, and orientation for seamless pickup from the human player wall loading zone.",
    technicalDetails:
      "Pre-sets slide height to 210mm, wrist pitch to 90° horizontal, and opens gripper to 110mm span.",
    inputType: "digital_button",
    deadband: "N/A",
    safetyInterlocks: [
      "Maintains level gripper angle independent of slight field floor irregularities",
    ],
    responseCurve: "Direct Digital",
    hardwareTarget: "Axon Servos + Slide Encoder PID",
    telemetryKey: "wall_load_preset",
  },
  {
    id: "d2-button-x",
    buttonId: "button_x",
    buttonLabel: "Button X (West)",
    driverId: "driver2",
    actionName: "High Basket Scoring Preset (920mm Slide)",
    category: "Scoring",
    description:
      "Rapidly extends vertical slides to high basket height (920mm) and tilts bucket manipulator to 45° deposit angle.",
    technicalDetails:
      "Motion-profiled trapezoidal slide velocity curve (max 1.8 m/s) with active PID position hold.",
    inputType: "digital_button",
    deadband: "N/A",
    safetyInterlocks: [
      "Safety interlock: Commands Driver 1 chassis drive speed governor (capped at 40%) to prevent robot tipping while elevated",
      "Requires claw sample verified loaded before slide extension",
    ],
    responseCurve: "Direct Digital",
    hardwareTarget: "Dual Viper Slides + Axon Max Pitch Servo",
    telemetryKey: "high_basket_preset",
  },
  {
    id: "d2-button-y",
    buttonId: "button_y",
    buttonLabel: "Button Y (North)",
    driverId: "driver2",
    actionName: "High Specimen Chamber Hang Preset (680mm)",
    category: "Scoring",
    description:
      "Elevates specimen clamp to 680mm to clear the high chamber bar, followed by automated pull-down clip sequence upon release.",
    technicalDetails:
      "Positions specimen bracket above bar; releasing triggers 150mm downward snap for firm clip engagement.",
    inputType: "digital_button",
    deadband: "N/A",
    safetyInterlocks: [
      "Safety interlock: Requires specimen clamp sensor in confirmed LOCKED state",
      "Emits audible buzzer alert if operator triggers hang with empty claw",
    ],
    responseCurve: "Direct Digital",
    hardwareTarget: "Dual Viper Slides & Axon Max Servo",
    telemetryKey: "high_chamber_preset",
  },
  {
    id: "d2-left-bumper",
    buttonId: "left_bumper",
    buttonLabel: "Left Bumper (LB)",
    driverId: "driver2",
    actionName: "Claw Gripper Actuation (Toggle Clamp / Release)",
    category: "Scoring",
    description:
      "Toggles titanium gear servo between clamped grip (holding sample/specimen) and fully open release.",
    technicalDetails:
      "Closed-loop servo current feedback holds constant 24N grip force without motor overheating.",
    inputType: "digital_button",
    deadband: "N/A",
    safetyInterlocks: [
      "Hold-force current monitor throttles PWM duty cycle if stall current exceeds 2.2A for > 2.0s",
    ],
    responseCurve: "Direct Digital",
    hardwareTarget: "High-Torque Titanium Gear Servo",
    telemetryKey: "claw_grip_state",
  },
  {
    id: "d2-right-bumper",
    buttonId: "right_bumper",
    buttonLabel: "Right Bumper (RB)",
    driverId: "driver2",
    actionName: "Active Roller Intake (In / Stop / Reverse Cycle)",
    category: "Intake",
    description:
      "Cycles high-speed compliance roller between Intake (inward), Neutral (off), and Eject (reverse) modes.",
    technicalDetails:
      "Drives REV UltraPlanetary motor at 420 RPM with active current-spike stall detection.",
    inputType: "digital_button",
    deadband: "N/A",
    safetyInterlocks: [
      "Automatic anti-jam auto-reverse: If current spike > 4.5A detected, reverses roller for 120ms then re-engages",
    ],
    responseCurve: "Direct Digital",
    hardwareTarget: "REV UltraPlanetary Planetary Motor",
    telemetryKey: "intake_roller_mode",
  },
  {
    id: "d2-left-trigger",
    buttonId: "left_trigger",
    buttonLabel: "Left Trigger (LT - Analog)",
    driverId: "driver2",
    actionName: "Analog Progressive Slide Lowering",
    category: "Elevator",
    description:
      "Provides fine analog control to lower the linear slides with smooth dynamic deceleration.",
    technicalDetails:
      "Maps trigger pull to downward slide velocity with soft deceleration cushion in lowest 50mm travel zone.",
    inputType: "analog_trigger",
    deadband: "0.05 (5% trigger deadband)",
    safetyInterlocks: [
      "Magnetic limit switch hardware cut immediately stops downward power when home point reached",
    ],
    responseCurve: "Linear",
    hardwareTarget: "Dual Viper Slide Motors",
    telemetryKey: "analog_slide_down",
  },
  {
    id: "d2-right-trigger",
    buttonId: "right_trigger",
    buttonLabel: "Right Trigger (RT - Analog)",
    driverId: "driver2",
    actionName: "Analog Progressive Slide Raising",
    category: "Elevator",
    description:
      "Provides fine analog control to raise the linear slides with variable velocity.",
    technicalDetails:
      "Maps trigger pull to upward slide velocity with electronic soft-stop at 980mm ceiling.",
    inputType: "analog_trigger",
    deadband: "0.05 (5% trigger deadband)",
    safetyInterlocks: [
      "Upper soft limit cuts motor power at 980mm to protect pulley cable rigging",
    ],
    responseCurve: "Linear",
    hardwareTarget: "Dual Viper Slide Motors",
    telemetryKey: "analog_slide_up",
  },
  {
    id: "d2-dpad-up",
    buttonId: "dpad_up",
    buttonLabel: "D-Pad Up",
    driverId: "driver2",
    actionName: "Preset Level 3: High Chamber Hook (710mm)",
    category: "Scoring",
    description:
      "Fast preset to 710mm height for high chamber specimen latching with auto-hook clip profile.",
    technicalDetails:
      "Sets PID setpoint to 710mm with 2000 tick/sec maximum velocity.",
    inputType: "dpad",
    deadband: "N/A",
    safetyInterlocks: [
      "Requires specimen grip confirmed before moving to chamber height",
    ],
    responseCurve: "Stepped Discrete",
    hardwareTarget: "Dual Slide Encoders + PID",
    telemetryKey: "preset_high_chamber",
  },
  {
    id: "d2-dpad-down",
    buttonId: "dpad_down",
    buttonLabel: "D-Pad Down",
    driverId: "driver2",
    actionName: "Preset Level 0: Full Retract & Perimeter Stow (0mm)",
    category: "Elevator",
    description:
      "Fully retracts vertical slides and folds manipulator wrist inside 18x18x18 FTC perimeter sizing envelope.",
    technicalDetails:
      "Coordinated two-phase motion: Folds wrist tuck angle first, then lowers slides to mechanical home.",
    inputType: "dpad",
    deadband: "N/A",
    safetyInterlocks: [
      "Safety interlock: Wrist tuck angle verified before slide enters lowest 100mm frame travel",
    ],
    responseCurve: "Stepped Discrete",
    hardwareTarget: "Slide Encoders + Wrist Servo Interlock",
    telemetryKey: "preset_stow_home",
  },
  {
    id: "d2-dpad-left",
    buttonId: "dpad_left",
    buttonLabel: "D-Pad Left",
    driverId: "driver2",
    actionName: "Preset Level 1: Low Basket Deposit (450mm)",
    category: "Scoring",
    description:
      "Elevates slides to 450mm for low basket scoring clearance, optimal for alliance partner coexistence.",
    technicalDetails:
      "Targets 450mm setpoint and tilts bucket 35° outward.",
    inputType: "dpad",
    deadband: "N/A",
    safetyInterlocks: [
      "Debounced at 200ms interval",
    ],
    responseCurve: "Stepped Discrete",
    hardwareTarget: "Dual Slide Motors + Pitch Servo",
    telemetryKey: "preset_low_basket",
  },
  {
    id: "d2-dpad-right",
    buttonId: "dpad_right",
    buttonLabel: "D-Pad Right",
    driverId: "driver2",
    actionName: "Preset Level 2: Low Chamber Hook (420mm)",
    category: "Scoring",
    description:
      "Positions specimen clamp for low submersible chamber bar scoring.",
    technicalDetails:
      "Targets 420mm height setpoint with level gripper pitch.",
    inputType: "dpad",
    deadband: "N/A",
    safetyInterlocks: [
      "Requires clamp closed state",
    ],
    responseCurve: "Stepped Discrete",
    hardwareTarget: "Dual Slide Motors",
    telemetryKey: "preset_low_chamber",
  },
  {
    id: "d2-button-back",
    buttonId: "button_back",
    buttonLabel: "Back / Select Button",
    driverId: "driver2",
    actionName: "Sample Color Filter Selector (Red / Blue / Yellow)",
    category: "Automation",
    description:
      "Cycles the optical sensor sample classification filter between Alliance Red, Alliance Blue, and Neutral Yellow.",
    technicalDetails:
      "Adjusts RGB HSV color classifier tolerance bands in REV Color Sensor V3 pipeline.",
    inputType: "digital_button",
    deadband: "N/A",
    safetyInterlocks: [
      "Prevents ingestion of opposing alliance samples by auto-reversing roller if wrong color detected",
    ],
    responseCurve: "Direct Digital",
    hardwareTarget: "REV Color Sensor V3 Optical Classifier",
    telemetryKey: "active_color_target",
  },
  {
    id: "d2-button-start",
    buttonId: "button_start",
    buttonLabel: "Start / Menu Button",
    driverId: "driver2",
    actionName: "Endgame Climb Lock Mechanism (Safety Interlock)",
    category: "Endgame",
    description:
      "Releases spring-loaded endgame climb hooks and engages mechanical one-way ratchets for Level 2/3 ascent.",
    technicalDetails:
      "Fires high-force release servo and shifts slide motors into high-torque winch mode.",
    inputType: "digital_button",
    deadband: "N/A",
    safetyInterlocks: [
      "Safety interlock: Two-button hold required — Must hold Button Start + Button Back simultaneously for 1.0s to trigger",
      "Software locked during the first 90 seconds of match; automatically arms in final 30 seconds of tele-op",
    ],
    responseCurve: "Direct Digital",
    hardwareTarget: "Pneumatic / Servo Climb Ratchet Lock + Winch Gears",
    telemetryKey: "endgame_climb_armed",
    emergencyNotes: "Once engaged, mechanical ratchets prevent robot from falling even on power loss.",
  },
];

export function getMappingsForDriver(driverId: DriverId): ControlMapping[] {
  return CONTROL_MAPPINGS.filter((mapping) => mapping.driverId === driverId);
}

export function getMappingForButton(
  driverId: DriverId,
  buttonId: ButtonLocation | string,
): ControlMapping | undefined {
  return CONTROL_MAPPINGS.find(
    (mapping) => mapping.driverId === driverId && mapping.buttonId === buttonId,
  );
}

export function filterMappings(
  driverId: DriverId,
  query = "",
  category: ControlCategory | "All" = "All",
): ControlMapping[] {
  const normalizedQuery = query.trim().toLowerCase();
  return CONTROL_MAPPINGS.filter((mapping) => {
    if (mapping.driverId !== driverId) return false;
    if (category !== "All" && mapping.category !== category) return false;
    if (!normalizedQuery) return true;

    return (
      mapping.actionName.toLowerCase().includes(normalizedQuery) ||
      mapping.buttonLabel.toLowerCase().includes(normalizedQuery) ||
      mapping.description.toLowerCase().includes(normalizedQuery) ||
      mapping.category.toLowerCase().includes(normalizedQuery) ||
      mapping.hardwareTarget.toLowerCase().includes(normalizedQuery) ||
      mapping.safetyInterlocks.some((safety) =>
        safety.toLowerCase().includes(normalizedQuery),
      )
    );
  });
}

export function getAvailableCategories(driverId: DriverId): ControlCategory[] {
  const mappings = getMappingsForDriver(driverId);
  const categories = new Set<ControlCategory>();
  for (const m of mappings) {
    categories.add(m.category);
  }
  return Array.from(categories);
}

export function getSafetyInterlockSummary(driverId: DriverId): {
  count: number;
  items: { action: string; interlocks: string[] }[];
} {
  const mappings = getMappingsForDriver(driverId).filter(
    (m) => m.safetyInterlocks && m.safetyInterlocks.length > 0,
  );
  return {
    count: mappings.length,
    items: mappings.map((m) => ({
      action: m.actionName,
      interlocks: m.safetyInterlocks,
    })),
  };
}
