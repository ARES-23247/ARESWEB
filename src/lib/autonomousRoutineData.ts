/**
 * Autonomous Routine Catalog & Pre-Match Configurator Models for ARES 23247
 * Season: FIRST Tech Challenge - INTO THE DEEP (2024-2025)
 */

export type AllianceColor = 'red' | 'blue';

export type StartingTileId =
  | 'red-submersible'
  | 'red-observation'
  | 'blue-submersible'
  | 'blue-observation';

export interface StartingTile {
  id: StartingTileId;
  alliance: AllianceColor;
  name: string;
  shortName: string;
  zone: 'submersible' | 'observation';
  description: string;
  coordinates: { xInches: number; yInches: number };
  recommendedHeadingDeg: number;
  fieldTileCoordinate: string;
}

export interface PreloadOrientation {
  id: string;
  name: string;
  shortLabel: string;
  gamePiece: 'Specimen' | 'Sample' | 'None';
  description: string;
  intakeState: string;
}

export interface TimelineStep {
  id: string;
  title: string;
  description: string;
  startOffsetSec: number;
  durationSec: number;
  pointsDelta: {
    specimens: number;
    samples: number;
    park: number;
    total: number;
  };
  fieldZone: 'Submersible' | 'Chamber' | 'Observation Zone' | 'Basket' | 'Perimeter';
  actionType: 'clip' | 'intake' | 'score_basket' | 'push' | 'park' | 'transit' | 'wait';
}

export interface AutonomousRoutine {
  id: string;
  name: string;
  shortName: string;
  description: string;
  allianceSupport: 'red' | 'blue' | 'both';
  defaultStartingTileId: StartingTileId;
  allowedTiles: StartingTileId[];
  targetPieces: {
    specimens: number;
    samples: number;
  };
  parkType: 'Observation Zone' | 'Submersible Ascent L1' | 'Submersible Gate';
  basePoints: number;
  maxPoints: number;
  nominalDurationSec: number;
  complexity: 'Standard' | 'Advanced' | 'Elite';
  riskRating: 'Low' | 'Moderate' | 'High';
  defaultPreloadId: string;
  defaultHeadingDeg: number;
  steps: TimelineStep[];
  strategicNotes: string[];
}

export interface GyroCalibrationState {
  targetHeadingDeg: number;
  calibratedHeadingDeg: number;
  isCalibrated: boolean;
  offsetDeg: number;
  calibrationMethod: string;
  lastCheckedAt: string | null;
}

export interface MatchConfiguration {
  matchNumber: string;
  alliance: AllianceColor;
  routineId: string;
  startingTileId: StartingTileId;
  preloadOrientationId: string;
  delaySeconds: number;
  gyroCalibration: GyroCalibrationState;
  driverNotes: string;
}

export interface PointCalculationResult {
  basePoints: number;
  effectivePoints: number;
  lostPointsDueToDelay: number;
  specimensScored: number;
  samplesScored: number;
  parkPoints: number;
  totalDurationSec: number;
  timeRemainingSec: number;
  isOvertime: boolean;
  accuracyMultiplier: number;
  breakdown: {
    specimenPoints: number;
    samplePoints: number;
    parkPoints: number;
    total: number;
  };
}

export interface AdjustedTimelineStep extends TimelineStep {
  adjustedStartSec: number;
  adjustedEndSec: number;
  isTruncatedByTimeLimit: boolean;
  isDelayStep?: boolean;
}

export interface RiskAnalysis {
  overallRisk: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  collisionRiskPct: number;
  gyroDriftRiskPct: number;
  timingMarginSec: number;
  successProbabilityPct: number;
  riskFactors: {
    level: 'low' | 'medium' | 'high';
    title: string;
    description: string;
  }[];
  mitigationStrategies: string[];
}

// -----------------------------------------------------------------------------
// CONSTANT DATA CATALOGS
// -----------------------------------------------------------------------------

export const STARTING_TILES: Record<StartingTileId, StartingTile> = {
  'red-submersible': {
    id: 'red-submersible',
    alliance: 'red',
    name: 'Red Alliance — Submersible Side',
    shortName: 'Red Submersible',
    zone: 'submersible',
    description: 'Aligns along audience-right red perimeter facing the Submersible entrance. Optimal for Basket sample cycling.',
    coordinates: { xInches: 24, yInches: 120 },
    recommendedHeadingDeg: 0,
    fieldTileCoordinate: 'Tile F2',
  },
  'red-observation': {
    id: 'red-observation',
    alliance: 'red',
    name: 'Red Alliance — Observation Zone Side',
    shortName: 'Red Observation',
    zone: 'observation',
    description: 'Aligns along audience-left red perimeter nearest to the human player observation station. Optimal for Chamber Rush.',
    coordinates: { xInches: 120, yInches: 120 },
    recommendedHeadingDeg: 180,
    fieldTileCoordinate: 'Tile F5',
  },
  'blue-submersible': {
    id: 'blue-submersible',
    alliance: 'blue',
    name: 'Blue Alliance — Submersible Side',
    shortName: 'Blue Submersible',
    zone: 'submersible',
    description: 'Aligns along audience-left blue perimeter facing the Submersible entrance. Optimal for Basket sample cycling.',
    coordinates: { xInches: 120, yInches: 24 },
    recommendedHeadingDeg: 0,
    fieldTileCoordinate: 'Tile A5',
  },
  'blue-observation': {
    id: 'blue-observation',
    alliance: 'blue',
    name: 'Blue Alliance — Observation Zone Side',
    shortName: 'Blue Observation',
    zone: 'observation',
    description: 'Aligns along audience-right blue perimeter nearest to the human player observation station. Optimal for Chamber Rush.',
    coordinates: { xInches: 24, yInches: 24 },
    recommendedHeadingDeg: 180,
    fieldTileCoordinate: 'Tile A2',
  },
};

export const PRELOAD_ORIENTATIONS: PreloadOrientation[] = [
  {
    id: 'specimen-chamber-forward',
    name: 'High Chamber Specimen (Claw Forward)',
    shortLabel: 'Specimen Forward Clamp',
    gamePiece: 'Specimen',
    description: 'Specimen gripped firmly in front optical claw, oriented at 45° angle ready for instant lift extension and high chamber clip.',
    intakeState: 'Front Claw Engaged (Closed, 45° Pitch)',
  },
  {
    id: 'sample-basket-rear',
    name: 'High Basket Sample (Bucket Loaded)',
    shortLabel: 'Sample Rear Bucket',
    gamePiece: 'Sample',
    description: 'Yellow sample pre-loaded in rear motorized bucket chute, ready for vertical 42-inch stage ascent to High Basket.',
    intakeState: 'Bucket Latched (Zero Retraction)',
  },
  {
    id: 'specimen-hook-vertical',
    name: 'Specimen Vertical Hook Orientation',
    shortLabel: 'Specimen Vertical Hook',
    gamePiece: 'Specimen',
    description: 'Specimen hanging on vertical linear slider hook for rapid drop-clip on high bar with zero drive-forward overshoot.',
    intakeState: 'Vertical Hook Staged (Top Bar Release Ready)',
  },
  {
    id: 'neutral-intake',
    name: 'Neutral Active Roller Pre-Load',
    shortLabel: 'Neutral Active Roller',
    gamePiece: 'Sample',
    description: 'Sample held in compliance active intake rollers ready for instant spit-out into observation zone or bucket transfer.',
    intakeState: 'Active Rollers Pinched (Holding)',
  },
];

export const ROUTINE_CATALOG: AutonomousRoutine[] = [
  {
    id: '5-specimen-chamber-rush',
    name: '5-Specimen Red/Blue Chamber Rush',
    shortName: '5-Specimen Rush',
    description: 'High-speed competitive specimen cycling routine scoring 5 specimens on the High Chamber with precision human-player handoffs and optical wall re-centering.',
    allianceSupport: 'both',
    defaultStartingTileId: 'red-observation',
    allowedTiles: [
      'red-observation',
      'red-submersible',
      'blue-observation',
      'blue-submersible',
    ],
    targetPieces: {
      specimens: 5,
      samples: 0,
    },
    parkType: 'Observation Zone',
    basePoints: 53,
    maxPoints: 53,
    nominalDurationSec: 27.0,
    complexity: 'Elite',
    riskRating: 'High',
    defaultPreloadId: 'specimen-chamber-forward',
    defaultHeadingDeg: 180,
    steps: [
      {
        id: 'step-1',
        title: 'Preload High Chamber Clip',
        description: 'Sprint to submersible chamber, elevate 3-stage lift, and clip preload specimen to high bar.',
        startOffsetSec: 0.0,
        durationSec: 2.8,
        pointsDelta: { specimens: 1, samples: 0, park: 0, total: 10 },
        fieldZone: 'Chamber',
        actionType: 'clip',
      },
      {
        id: 'step-2',
        title: 'Push Spike Sample 1 to Observation',
        description: 'Vector drive across spike mark 1, pushing neutral sample into observation zone for human player.',
        startOffsetSec: 2.8,
        durationSec: 3.2,
        pointsDelta: { specimens: 0, samples: 0, park: 0, total: 0 },
        fieldZone: 'Observation Zone',
        actionType: 'push',
      },
      {
        id: 'step-3',
        title: 'Push Spike Sample 2 to Observation',
        description: 'Sweep spike mark 2 sample into observation zone with rear compliance plow.',
        startOffsetSec: 6.0,
        durationSec: 3.0,
        pointsDelta: { specimens: 0, samples: 0, park: 0, total: 0 },
        fieldZone: 'Observation Zone',
        actionType: 'push',
      },
      {
        id: 'step-4',
        title: 'Push Spike Sample 3 & Intake Specimen 2',
        description: 'Sweep spike mark 3 and dock at observation wall; human player loads specimen 2 into optical claw.',
        startOffsetSec: 9.0,
        durationSec: 3.5,
        pointsDelta: { specimens: 0, samples: 0, park: 0, total: 0 },
        fieldZone: 'Observation Zone',
        actionType: 'intake',
      },
      {
        id: 'step-5',
        title: 'Score Specimen 2 High Chamber',
        description: 'High-speed cross-field sprint to submersible; clip specimen 2 on high chamber.',
        startOffsetSec: 12.5,
        durationSec: 3.5,
        pointsDelta: { specimens: 1, samples: 0, park: 0, total: 10 },
        fieldZone: 'Chamber',
        actionType: 'clip',
      },
      {
        id: 'step-6',
        title: 'Intake & Score Specimen 3',
        description: 'Transit to observation wall, grab specimen 3, and clip onto high chamber.',
        startOffsetSec: 16.0,
        durationSec: 3.6,
        pointsDelta: { specimens: 1, samples: 0, park: 0, total: 10 },
        fieldZone: 'Chamber',
        actionType: 'clip',
      },
      {
        id: 'step-7',
        title: 'Intake & Score Specimen 4',
        description: 'Transit to observation wall, grab specimen 4, and clip onto high chamber.',
        startOffsetSec: 19.6,
        durationSec: 3.6,
        pointsDelta: { specimens: 1, samples: 0, park: 0, total: 10 },
        fieldZone: 'Chamber',
        actionType: 'clip',
      },
      {
        id: 'step-8',
        title: 'Intake, Score Specimen 5 & Park',
        description: 'Grab final specimen 5, clip on high chamber, and park fully inside the observation zone boundary.',
        startOffsetSec: 23.2,
        durationSec: 3.8,
        pointsDelta: { specimens: 1, samples: 0, park: 1, total: 13 },
        fieldZone: 'Observation Zone',
        actionType: 'park',
      },
    ],
    strategicNotes: [
      'Human player must have specimen 2 positioned on observation wall by T+10.0s.',
      'Requires optical wall alignment lasers enabled to compensate for wheel slip on rubber matting.',
      'If alliance partner path crosses observation corridor, set autonomous delay to 1.5s.',
    ],
  },
  {
    id: '4-sample-high-basket',
    name: '4-Sample High Basket Pre-load',
    shortName: '4-Sample Basket',
    description: 'Sample-centric autonomous sequence elevating 4 samples into the High Basket followed by a Level 1 Ascent hook onto the Submersible low bar.',
    allianceSupport: 'both',
    defaultStartingTileId: 'red-submersible',
    allowedTiles: [
      'red-submersible',
      'blue-submersible',
      'red-observation',
      'blue-observation',
    ],
    targetPieces: {
      specimens: 0,
      samples: 4,
    },
    parkType: 'Submersible Ascent L1',
    basePoints: 35,
    maxPoints: 35,
    nominalDurationSec: 25.5,
    complexity: 'Advanced',
    riskRating: 'Moderate',
    defaultPreloadId: 'sample-basket-rear',
    defaultHeadingDeg: 0,
    steps: [
      {
        id: 'step-1',
        title: 'Preload High Basket Deposit',
        description: 'Drive to basket corner, elevate 42-inch lift, and deposit preload yellow sample into High Basket.',
        startOffsetSec: 0.0,
        durationSec: 3.5,
        pointsDelta: { specimens: 0, samples: 1, park: 0, total: 8 },
        fieldZone: 'Basket',
        actionType: 'score_basket',
      },
      {
        id: 'step-2',
        title: 'Intake Submersible Spike 1 & Score Basket',
        description: 'Extend horizontal slide, active roller intake spike sample 1, transfer to bucket, elevate and score.',
        startOffsetSec: 3.5,
        durationSec: 5.5,
        pointsDelta: { specimens: 0, samples: 1, park: 0, total: 8 },
        fieldZone: 'Basket',
        actionType: 'score_basket',
      },
      {
        id: 'step-3',
        title: 'Intake Submersible Spike 2 & Score Basket',
        description: 'Align to spike sample 2, intake, bucket transfer, elevate and score in High Basket.',
        startOffsetSec: 9.0,
        durationSec: 5.5,
        pointsDelta: { specimens: 0, samples: 1, park: 0, total: 8 },
        fieldZone: 'Basket',
        actionType: 'score_basket',
      },
      {
        id: 'step-4',
        title: 'Intake Submersible Spike 3 & Score Basket',
        description: 'Align to spike sample 3, intake, bucket transfer, elevate and score in High Basket.',
        startOffsetSec: 14.5,
        durationSec: 5.5,
        pointsDelta: { specimens: 0, samples: 1, park: 0, total: 8 },
        fieldZone: 'Basket',
        actionType: 'score_basket',
      },
      {
        id: 'step-5',
        title: 'Submersible Level 1 Ascent Hook',
        description: 'Drive into submersible perimeter, hook passive climbing bracket on low horizontal rung for Level 1 Ascent.',
        startOffsetSec: 20.0,
        durationSec: 5.5,
        pointsDelta: { specimens: 0, samples: 0, park: 1, total: 3 },
        fieldZone: 'Submersible',
        actionType: 'park',
      },
    ],
    strategicNotes: [
      'Avoids center chamber congestion completely; excellent when partner is running Specimen Chamber Rush.',
      'Check slide tensioning before match to avoid extension sag on 3rd sample intake.',
      'Ensure preload sample is seated firmly against rear bucket sensor.',
    ],
  },
  {
    id: 'observation-push-park',
    name: 'Observation Zone Push & Park',
    shortName: 'Push & Park',
    description: 'Highly reliable partner-enabling routine that clips 1 preload specimen, sweeps all 3 spike mark samples into the observation zone for rapid tele-op cycling, and establishes full park.',
    allianceSupport: 'both',
    defaultStartingTileId: 'red-observation',
    allowedTiles: [
      'red-observation',
      'blue-observation',
      'red-submersible',
      'blue-submersible',
    ],
    targetPieces: {
      specimens: 1,
      samples: 0,
    },
    parkType: 'Observation Zone',
    basePoints: 13,
    maxPoints: 19,
    nominalDurationSec: 18.0,
    complexity: 'Standard',
    riskRating: 'Low',
    defaultPreloadId: 'specimen-chamber-forward',
    defaultHeadingDeg: 180,
    steps: [
      {
        id: 'step-1',
        title: 'Preload High Chamber Clip',
        description: 'Drive to high chamber and clip preloaded specimen onto high bar.',
        startOffsetSec: 0.0,
        durationSec: 3.2,
        pointsDelta: { specimens: 1, samples: 0, park: 0, total: 10 },
        fieldZone: 'Chamber',
        actionType: 'clip',
      },
      {
        id: 'step-2',
        title: 'Sweep Spike Sample 1 to Observation',
        description: 'Drive behind spike sample 1 and plow it cleanly into observation zone.',
        startOffsetSec: 3.2,
        durationSec: 4.2,
        pointsDelta: { specimens: 0, samples: 0, park: 0, total: 0 },
        fieldZone: 'Observation Zone',
        actionType: 'push',
      },
      {
        id: 'step-3',
        title: 'Sweep Spike Sample 2 to Observation',
        description: 'Plow spike sample 2 cleanly across the tape into observation zone.',
        startOffsetSec: 7.4,
        durationSec: 3.8,
        pointsDelta: { specimens: 0, samples: 0, park: 0, total: 0 },
        fieldZone: 'Observation Zone',
        actionType: 'push',
      },
      {
        id: 'step-4',
        title: 'Sweep Spike Sample 3 to Observation',
        description: 'Plow spike sample 3 into observation zone for human player loading.',
        startOffsetSec: 11.2,
        durationSec: 3.8,
        pointsDelta: { specimens: 0, samples: 0, park: 0, total: 0 },
        fieldZone: 'Observation Zone',
        actionType: 'push',
      },
      {
        id: 'step-5',
        title: 'Observation Zone Full Chassis Park',
        description: 'Back robot completely inside the observation zone boundary perimeter.',
        startOffsetSec: 15.0,
        durationSec: 3.0,
        pointsDelta: { specimens: 0, samples: 0, park: 1, total: 3 },
        fieldZone: 'Observation Zone',
        actionType: 'park',
      },
    ],
    strategicNotes: [
      'Ultra-stable fallback routine when autonomous odometry calibration is uncertain.',
      'Delivers 3 fresh samples directly to human player ready for TeleOp specimen conversions.',
      'Leaves center chamber clear by T+4.0s for alliance partner autonomous.',
    ],
  },
  {
    id: 'submersible-gate-clearance',
    name: 'Submersible Gate Clearance',
    shortName: 'Gate Clearance',
    description: 'Defensive and space-clearing pathing routine scoring 1 high chamber specimen, clearing neutral pieces through the center submersible gate, and docking with Level 1 Ascent contact.',
    allianceSupport: 'both',
    defaultStartingTileId: 'red-submersible',
    allowedTiles: [
      'red-submersible',
      'blue-submersible',
      'red-observation',
      'blue-observation',
    ],
    targetPieces: {
      specimens: 1,
      samples: 0,
    },
    parkType: 'Submersible Gate',
    basePoints: 13,
    maxPoints: 13,
    nominalDurationSec: 15.0,
    complexity: 'Standard',
    riskRating: 'Low',
    defaultPreloadId: 'specimen-chamber-forward',
    defaultHeadingDeg: 0,
    steps: [
      {
        id: 'step-1',
        title: 'Preload High Chamber Clip',
        description: 'Rapid straight-line traversal to high chamber; clip preload specimen.',
        startOffsetSec: 0.0,
        durationSec: 3.0,
        pointsDelta: { specimens: 1, samples: 0, park: 0, total: 10 },
        fieldZone: 'Chamber',
        actionType: 'clip',
      },
      {
        id: 'step-2',
        title: 'Submersible Gate Navigation & Deconfliction',
        description: 'Drive through center submersible gate, clearing obstacle samples to alliance side.',
        startOffsetSec: 3.0,
        durationSec: 4.5,
        pointsDelta: { specimens: 0, samples: 0, park: 0, total: 0 },
        fieldZone: 'Submersible',
        actionType: 'transit',
      },
      {
        id: 'step-3',
        title: 'Sample Relocation & Clearance',
        description: 'Displace opposing neutral samples away from submersible entry zone.',
        startOffsetSec: 7.5,
        durationSec: 3.5,
        pointsDelta: { specimens: 0, samples: 0, park: 0, total: 0 },
        fieldZone: 'Submersible',
        actionType: 'push',
      },
      {
        id: 'step-4',
        title: 'Level 1 Ascent Bar Touch',
        description: 'Maintain solid contact against low horizontal rung for autonomous ascent park credit.',
        startOffsetSec: 11.0,
        durationSec: 4.0,
        pointsDelta: { specimens: 0, samples: 0, park: 1, total: 3 },
        fieldZone: 'Submersible',
        actionType: 'park',
      },
    ],
    strategicNotes: [
      'Guarantees that the submersible corridor is cleared of blockages before TeleOp begins.',
      'Minimal risk of foul penalties or field element boundary infractions.',
      'Can easily accommodate up to 8 seconds of starting delay timer.',
    ],
  },
];

// -----------------------------------------------------------------------------
// CALCULATION & TRANSFORMATION FUNCTIONS
// -----------------------------------------------------------------------------

export const AUTONOMOUS_PERIOD_LIMIT_SEC = 30.0;

export function getRoutineById(id: string): AutonomousRoutine {
  const found = ROUTINE_CATALOG.find((r) => r.id === id);
  return found || ROUTINE_CATALOG[0];
}

export function getStartingTileById(id: StartingTileId): StartingTile {
  return STARTING_TILES[id] || STARTING_TILES['red-observation'];
}

export function generateAdjustedTimeline(
  routine: AutonomousRoutine,
  delaySeconds: number
): AdjustedTimelineStep[] {
  const safeDelay = Math.max(0, Math.min(10, delaySeconds || 0));
  const adjusted: AdjustedTimelineStep[] = [];

  if (safeDelay > 0) {
    adjusted.push({
      id: 'delay-step',
      title: `Autonomous Start Delay (${safeDelay.toFixed(1)}s)`,
      description: 'Robot stationary holding position to deconflict transit paths with alliance partner.',
      startOffsetSec: 0,
      durationSec: safeDelay,
      pointsDelta: { specimens: 0, samples: 0, park: 0, total: 0 },
      fieldZone: 'Perimeter',
      actionType: 'wait',
      adjustedStartSec: 0,
      adjustedEndSec: safeDelay,
      isTruncatedByTimeLimit: false,
      isDelayStep: true,
    });
  }

  let currentCursor = safeDelay;

  for (const step of routine.steps) {
    const stepStart = currentCursor;
    const stepEnd = currentCursor + step.durationSec;
    const isTruncated = stepStart >= AUTONOMOUS_PERIOD_LIMIT_SEC;

    adjusted.push({
      ...step,
      adjustedStartSec: Number(stepStart.toFixed(1)),
      adjustedEndSec: Number(stepEnd.toFixed(1)),
      isTruncatedByTimeLimit: isTruncated,
      isDelayStep: false,
    });

    currentCursor = stepEnd;
  }

  return adjusted;
}

export function calculateAutonomousScore(
  routine: AutonomousRoutine,
  delaySeconds: number,
  isGyroCalibrated: boolean
): PointCalculationResult {
  const safeDelay = Math.max(0, Math.min(10, delaySeconds || 0));
  const timeline = generateAdjustedTimeline(routine, safeDelay);

  let specimenPoints = 0;
  let samplePoints = 0;
  let parkPoints = 0;
  let specimensScored = 0;
  let samplesScored = 0;
  let lostPointsDueToDelay = 0;

  for (const step of timeline) {
    if (step.isDelayStep) continue;

    if (step.adjustedEndSec <= AUTONOMOUS_PERIOD_LIMIT_SEC) {
      specimenPoints += step.pointsDelta.specimens * 10;
      samplePoints += step.pointsDelta.samples * 8;
      parkPoints += step.pointsDelta.park * 3;
      specimensScored += step.pointsDelta.specimens;
      samplesScored += step.pointsDelta.samples;
    } else if (step.adjustedStartSec < AUTONOMOUS_PERIOD_LIMIT_SEC) {
      lostPointsDueToDelay += step.pointsDelta.total;
    } else {
      lostPointsDueToDelay += step.pointsDelta.total;
    }
  }

  const effectiveTotal = specimenPoints + samplePoints + parkPoints;
  const totalDurationSec = Number((routine.nominalDurationSec + safeDelay).toFixed(1));
  const timeRemainingSec = Math.max(0, Number((AUTONOMOUS_PERIOD_LIMIT_SEC - totalDurationSec).toFixed(1)));
  const isOvertime = totalDurationSec > AUTONOMOUS_PERIOD_LIMIT_SEC;
  const accuracyMultiplier = isGyroCalibrated ? 1.0 : 0.85;

  return {
    basePoints: routine.basePoints,
    effectivePoints: Math.round(effectiveTotal * accuracyMultiplier),
    lostPointsDueToDelay,
    specimensScored,
    samplesScored,
    parkPoints,
    totalDurationSec,
    timeRemainingSec,
    isOvertime,
    accuracyMultiplier,
    breakdown: {
      specimenPoints,
      samplePoints,
      parkPoints,
      total: effectiveTotal,
    },
  };
}

export function calculateRiskProfile(
  routine: AutonomousRoutine,
  delaySeconds: number,
  isGyroCalibrated: boolean,
  startingTileId: StartingTileId
): RiskAnalysis {
  const safeDelay = Math.max(0, Math.min(10, delaySeconds || 0));
  const totalDuration = routine.nominalDurationSec + safeDelay;
  const timingMargin = Number((AUTONOMOUS_PERIOD_LIMIT_SEC - totalDuration).toFixed(1));

  const tile = getStartingTileById(startingTileId);
  const isSubmersibleTile = tile.zone === 'submersible';

  let collisionRiskPct = isSubmersibleTile ? 35 : 20;
  if (safeDelay >= 2.0 && safeDelay <= 4.0) {
    collisionRiskPct = Math.max(5, collisionRiskPct - 15);
  } else if (safeDelay === 0) {
    collisionRiskPct += 10;
  }

  const gyroDriftRiskPct = isGyroCalibrated ? 5 : 45;

  let successProbabilityPct = 95;
  if (routine.complexity === 'Elite') successProbabilityPct -= 10;
  if (routine.complexity === 'Advanced') successProbabilityPct -= 5;
  if (!isGyroCalibrated) successProbabilityPct -= 25;
  if (timingMargin < 0) successProbabilityPct -= 30;
  else if (timingMargin < 2.0) successProbabilityPct -= 12;

  successProbabilityPct = Math.max(10, Math.min(99, successProbabilityPct));

  const riskFactors: RiskAnalysis['riskFactors'] = [];

  if (!isGyroCalibrated) {
    riskFactors.push({
      level: 'high',
      title: 'IMU / Gyro Heading Not Calibrated',
      description: 'Robot is running with unverified heading zero. Autonomous pathing may drift up to ±8° during high-speed transit.',
    });
  }

  if (timingMargin < 0) {
    riskFactors.push({
      level: 'high',
      title: 'Timeline Exceeds 30s Auto Period',
      description: `Configured delay of ${safeDelay.toFixed(1)}s causes routine to run ${totalDuration.toFixed(1)}s, losing end-of-match park points.`,
    });
  } else if (timingMargin < 2.0) {
    riskFactors.push({
      level: 'medium',
      title: 'Tight Autonomous Timing Margin',
      description: `Only ${timingMargin}s buffer remains before 30.0s buzzer. Minor intake slip could forfeit parking points.`,
    });
  }

  if (safeDelay === 0 && routine.complexity === 'Elite') {
    riskFactors.push({
      level: 'medium',
      title: 'Zero Start Delay on High-Speed Routine',
      description: 'Ensure alliance partner does not traverse across center submersible or observation corridor during opening 3.0s.',
    });
  }

  let overallRisk: RiskAnalysis['overallRisk'] = 'LOW';
  if (!isGyroCalibrated || timingMargin < -2.0) {
    overallRisk = 'CRITICAL';
  } else if (timingMargin < 0 || collisionRiskPct > 35 || routine.riskRating === 'High') {
    overallRisk = 'HIGH';
  } else if (collisionRiskPct > 20 || routine.riskRating === 'Moderate' || timingMargin < 3.0) {
    overallRisk = 'MODERATE';
  }

  const mitigationStrategies: string[] = [
    isGyroCalibrated
      ? 'Gyro Heading verified against perimeter wall.'
      : 'Perform 0° IMU calibration against the driver station wall before driver-ready signal.',
    safeDelay > 0
      ? `Delay of ${safeDelay.toFixed(1)}s gives alliance partner clear path to submersible.`
      : 'Confirm alliance partner initial heading before starting auto to avoid t-bone collisions.',
    'Verify optical claw limit switch triggers cleanly when clamping game piece.',
  ];

  return {
    overallRisk,
    collisionRiskPct,
    gyroDriftRiskPct,
    timingMarginSec: timingMargin,
    successProbabilityPct,
    riskFactors,
    mitigationStrategies,
  };
}

export function getDefaultMatchConfiguration(): MatchConfiguration {
  return {
    matchNumber: 'Q-01',
    alliance: 'red',
    routineId: '5-specimen-chamber-rush',
    startingTileId: 'red-observation',
    preloadOrientationId: 'specimen-chamber-forward',
    delaySeconds: 0,
    gyroCalibration: {
      targetHeadingDeg: 180,
      calibratedHeadingDeg: 180,
      isCalibrated: true,
      offsetDeg: 0,
      calibrationMethod: 'Perimeter Wall Alignment Laser',
      lastCheckedAt: new Date().toISOString(),
    },
    driverNotes: 'Coordinate observation push corridor with alliance partner. Verify human player specimen rack count.',
  };
}
