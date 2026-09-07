import { createHash } from "node:crypto";
import { z } from "zod";
import {
  parseLevelFile,
  serializeLevel,
  validateLevel,
} from "../generated/games/waggle-way/level";
import {
  pollenCounts,
  populationCounts,
} from "../generated/games/waggle-way/engine";
import {
  MAX_REPLAY_TICKS,
  replayRun,
  validateReplay,
} from "../generated/games/waggle-way/replay";

export const WAGGLE_SUBMISSION_BYTES = 768 * 1024;
export const WAGGLE_VERIFIER_VERSION = "waggle-rules-1-5@1";
export const WAGGLE_PROOF_MESSAGES = {
  payload:
    "Choose a supported level and one to three distinct completion recordings.",
  size: "The combined level and recordings must fit within 768 KiB.",
  level: "This level does not match the supported garden rules.",
  replay:
    "A recording does not match this exact garden revision or cannot be replayed.",
  incomplete:
    "Every submitted recording must reach the garden's rescue target.",
  pollen: "Deliver the advertised pollen target in a successful recording.",
  tools: "Meet the advertised tool goal in a successful recording.",
} as const;
export type WaggleProofCode = keyof typeof WAGGLE_PROOF_MESSAGES;
export class WaggleProofError extends Error {
  constructor(public readonly code: WaggleProofCode) {
    super(WAGGLE_PROOF_MESSAGES[code]);
    this.name = "WaggleProofError";
  }
}
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const count = z.number().int().min(0).max(512);
export const WaggleVerificationSchema = z
  .object({
    version: z.literal(1),
    verifierVersion: z.literal(WAGGLE_VERIFIER_VERSION),
    rulesVersion: z.number().int().min(1).max(5),
    contentHash: sha256,
    bindingHash: sha256,
    bestRescued: count.max(100),
    bestPollen: count,
    fewestTools: count,
    allBeesProven: z.boolean(),
    witnesses: z
      .array(
        z
          .object({
            replayHash: sha256,
            endTick: z.number().int().min(0).max(MAX_REPLAY_TICKS),
            rescued: count.max(100),
            pollenDelivered: count,
            peakTools: count,
          })
          .strict(),
      )
      .min(1)
      .max(3),
  })
  .strict();
export type WaggleVerification = z.infer<typeof WaggleVerificationSchema>;

/** CPU-bound verification. Call only in the isolated, deadline-limited worker. */
export function evaluateWaggleProof(payload: string): WaggleVerification {
  if (Buffer.byteLength(payload, "utf8") > WAGGLE_SUBMISSION_BYTES)
    throw new WaggleProofError("size");
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new WaggleProofError("payload");
  }
  const input = z
    .object({ level: z.unknown(), replays: z.array(z.unknown()).min(1).max(3) })
    .strict()
    .safeParse(parsed);
  if (!input.success) throw new WaggleProofError("payload");
  let level;
  let canonical: string;
  try {
    canonical = serializeLevel(validateLevel(input.data.level));
    level = parseLevelFile(canonical);
  } catch {
    throw new WaggleProofError("level");
  }
  const seen = new Set<string>();
  const witnesses = input.data.replays.map((value) => {
    let run;
    let replayHash: string;
    try {
      const replay = validateReplay(level, value);
      replayHash = hash(JSON.stringify(replay));
      if (seen.has(replayHash)) throw new WaggleProofError("payload");
      seen.add(replayHash);
      run = replayRun(level, replay);
    } catch {
      throw new WaggleProofError("replay");
    }
    const rescued = populationCounts(run).rescued;
    if (!run.won || rescued < level.rescueTarget)
      throw new WaggleProofError("incomplete");
    return {
      replayHash,
      endTick: run.tick,
      rescued,
      pollenDelivered: pollenCounts(run).delivered,
      peakTools: run.peakToolsPlaced,
    };
  });
  const bestRescued = Math.max(...witnesses.map((proof) => proof.rescued));
  const bestPollen = Math.max(
    ...witnesses.map((proof) => proof.pollenDelivered),
  );
  const fewestTools = Math.min(...witnesses.map((proof) => proof.peakTools));
  if (level.objectives && bestPollen < level.objectives.pollen)
    throw new WaggleProofError("pollen");
  if (
    level.objectives?.maxTools !== undefined &&
    fewestTools > level.objectives.maxTools
  )
    throw new WaggleProofError("tools");
  const contentHash = hash(canonical);
  return {
    version: 1,
    verifierVersion: WAGGLE_VERIFIER_VERSION,
    rulesVersion: level.rulesVersion,
    contentHash,
    bindingHash: hash(
      `${WAGGLE_VERIFIER_VERSION}\n${level.rulesVersion}\n${contentHash}`,
    ),
    bestRescued,
    bestPollen,
    fewestTools,
    allBeesProven: bestRescued === level.population,
    witnesses,
  };
}
