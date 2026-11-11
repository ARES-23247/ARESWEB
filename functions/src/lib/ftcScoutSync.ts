import { ApiError } from "../middleware/errorHandler";

export interface FtcScoutOprEntry {
  teamNumber: string;
  teamName: string;
  opr: number;
  autoOpr: number | null;
  teleopOpr: number | null;
  endgameOpr: number | null;
  rank: number | null;
}

export interface FtcScoutNormalizedMatch {
  matchNumber: string;
  alliance: "red" | "blue";
  partner: string;
  opponents: string[];
  scoreSelf: number | null;
  scoreOpponent: number | null;
  result: "won" | "lost" | "tie" | "upcoming";
  completed: boolean;
}

export interface FtcScoutEventSyncResult {
  ftcSeason: number;
  ftcEventCode: string;
  eventName: string | null;
  eventDate: string | null;
  eventLocation: string | null;
  oprList: FtcScoutOprEntry[];
  aresOpr: number | null;
  aresRank: number | null;
  wins: number | null;
  losses: number | null;
  ties: number | null;
  aresMatches: FtcScoutNormalizedMatch[];
}

const ALLOWED_SEASONS: ReadonlyMap<number, string> = new Map(
  Array.from({ length: 82 }, (_, idx) => [2019 + idx, String(2019 + idx)]),
);
const EVENT_CODE_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function sanitizeFtcEventCode(rawCode: string): string {
  const upper = rawCode.trim().toUpperCase();
  if (!/^[A-Z0-9]{2,20}$/.test(upper)) {
    throw new ApiError(400, "FTC event code must contain 2–20 alphanumeric characters.", "FTCSCOUT_CODE_INVALID");
  }
  let sanitized = "";
  for (let i = 0; i < upper.length; i += 1) {
    const charIndex = EVENT_CODE_ALPHABET.indexOf(upper[i] ?? "");
    if (charIndex < 0) {
      throw new ApiError(400, "FTC event code must contain 2–20 alphanumeric characters.", "FTCSCOUT_CODE_INVALID");
    }
    sanitized += EVENT_CODE_ALPHABET[charIndex];
  }
  return sanitized;
}

function buildFtcScoutUrl(safeSeason: string, safeCode: string, suffix = ""): string {
  const url = new URL(`/rest/v1/events/${safeSeason}/${safeCode}${suffix}`, "https://api.ftcscout.org");
  if (url.protocol !== "https:" || url.hostname !== "api.ftcscout.org" || url.port !== "") {
    throw new ApiError(400, "Invalid FTCScout request target.", "FTCSCOUT_TARGET_INVALID");
  }
  return url.toString();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function roundTenth(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.round(value * 10) / 10);
}

function nonNegativeInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.trunc(value);
}

function formatLocation(rawLocation: unknown): string | null {
  const loc = asRecord(rawLocation);
  if (!loc) return typeof rawLocation === "string" && rawLocation.trim() ? rawLocation.trim().slice(0, 240) : null;
  const parts = [loc.venue, loc.city, loc.state]
    .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    .map((entry) => entry.trim());
  return parts.length > 0 ? parts.join(", ").slice(0, 240) : null;
}

function formatMatchNumber(matchRecord: Record<string, unknown>, fallbackIndex: number): string {
  const level = typeof matchRecord.tournamentLevel === "string" ? matchRecord.tournamentLevel.toLowerCase() : "quals";
  const series = nonNegativeInt(matchRecord.series) ?? 0;
  const matchNum = nonNegativeInt(matchRecord.matchNum) ?? (fallbackIndex + 1);
  if (level.includes("doubleelim")) {
    return `M${series > 0 ? series : matchNum}`;
  }
  if (level.includes("semi")) {
    return series > 0 ? `SF${series}-${matchNum}` : `SF${matchNum}`;
  }
  if (level.includes("final")) {
    return `F${matchNum}`;
  }
  return `QM${matchNum}`;
}

function extractAllianceScore(scoresRecord: Record<string, unknown> | null, alliance: "red" | "blue"): number | null {
  if (!scoresRecord) return null;
  const side = scoresRecord[alliance];
  if (typeof side === "number") return nonNegativeInt(side);
  const sideObj = asRecord(side);
  return nonNegativeInt(sideObj?.totalPoints ?? sideObj?.totalPointsNp);
}

export function normalizeFtcScoutPayload(
  season: number,
  eventCode: string,
  eventRaw: unknown,
  teamsRaw: unknown,
  matchesRaw: unknown,
  targetTeamNumber = 23247,
): FtcScoutEventSyncResult {
  const normalizedCode = eventCode.trim().toUpperCase();
  const eventObj = asRecord(eventRaw);
  const eventName = typeof eventObj?.name === "string" && eventObj.name.trim()
    ? eventObj.name.trim().slice(0, 160)
    : null;
  const startRaw = typeof eventObj?.start === "string" ? eventObj.start.slice(0, 10) : "";
  const eventDate = /^\d{4}-\d{2}-\d{2}$/u.test(startRaw) ? startRaw : null;
  const eventLocation = formatLocation(eventObj?.location);

  const oprList: FtcScoutOprEntry[] = [];
  let aresOpr: number | null = null;
  let aresRank: number | null = null;
  let statsWins: number | null = null;
  let statsLosses: number | null = null;
  let statsTies: number | null = null;

  const teamItems = Array.isArray(teamsRaw) ? teamsRaw.slice(0, 100) : [];
  for (const item of teamItems) {
    const entry = asRecord(item);
    const num = nonNegativeInt(entry?.teamNumber);
    if (!entry || num === null || num <= 0) continue;

    const teamInfo = asRecord(entry.team);
    const rawTeamName = typeof teamInfo?.nameShort === "string" && teamInfo.nameShort.trim()
      ? teamInfo.nameShort.trim()
      : typeof teamInfo?.nameFull === "string" && teamInfo.nameFull.trim()
        ? teamInfo.nameFull.trim()
        : typeof entry.team === "string" && entry.team.trim()
          ? entry.team.trim()
          : `Team ${num}`;

    const stats = asRecord(entry.stats);
    const oprObj = asRecord(stats?.opr);
    const totalOpr = roundTenth(
      oprObj?.totalPointsNp ?? oprObj?.totalPoints ?? stats?.opr ?? 0,
    ) ?? 0;
    const autoOpr = roundTenth(oprObj?.autoPoints);
    const teleopOpr = roundTenth(oprObj?.dcPoints);
    const endgameOpr = roundTenth(oprObj?.egPoints);
    const rank = nonNegativeInt(stats?.rank);

    if (num === targetTeamNumber) {
      aresOpr = totalOpr;
      aresRank = rank && rank > 0 ? rank : null;
      statsWins = nonNegativeInt(stats?.wins);
      statsLosses = nonNegativeInt(stats?.losses);
      statsTies = nonNegativeInt(stats?.ties);
    }

    oprList.push({
      teamNumber: String(num),
      teamName: rawTeamName.slice(0, 120),
      opr: totalOpr,
      autoOpr,
      teleopOpr,
      endgameOpr,
      rank: rank && rank > 0 ? rank : null,
    });
  }

  oprList.sort((a, b) => b.opr - a.opr);

  const aresMatches: FtcScoutNormalizedMatch[] = [];
  const matchItems = Array.isArray(matchesRaw) ? matchesRaw.slice(0, 250) : [];
  matchItems.forEach((rawMatch, index) => {
    const matchObj = asRecord(rawMatch);
    const participants = Array.isArray(matchObj?.teams) ? matchObj.teams : [];
    if (!matchObj || participants.length === 0) return;

    const redTeams: string[] = [];
    const blueTeams: string[] = [];
    let selfAlliance: "red" | "blue" | null = null;

    for (const participant of participants) {
      const partObj = asRecord(participant);
      const tNum = nonNegativeInt(partObj?.teamNumber);
      const side = typeof partObj?.alliance === "string" ? partObj.alliance.toLowerCase() : "";
      if (tNum === null || tNum <= 0) continue;
      if (side.startsWith("red")) {
        redTeams.push(String(tNum));
        if (tNum === targetTeamNumber) selfAlliance = "red";
      } else if (side.startsWith("blue")) {
        blueTeams.push(String(tNum));
        if (tNum === targetTeamNumber) selfAlliance = "blue";
      }
    }

    if (!selfAlliance) return;

    const mySide = selfAlliance === "red" ? redTeams : blueTeams;
    const otherSide = selfAlliance === "red" ? blueTeams : redTeams;
    const partner = mySide.find((num) => num !== String(targetTeamNumber)) ?? "TBD";
    const opponents = otherSide.length > 0 ? otherSide.slice(0, 6) : ["TBD"];

    const played = matchObj.hasBeenPlayed === true;
    const scoresRecord = asRecord(matchObj.scores);
    const scoreSelf = played ? extractAllianceScore(scoresRecord, selfAlliance) : null;
    const scoreOpponent = played
      ? extractAllianceScore(scoresRecord, selfAlliance === "red" ? "blue" : "red")
      : null;

    let result: "won" | "lost" | "tie" | "upcoming" = "upcoming";
    if (played && scoreSelf !== null && scoreOpponent !== null) {
      if (scoreSelf > scoreOpponent) result = "won";
      else if (scoreSelf < scoreOpponent) result = "lost";
      else result = "tie";
    }

    aresMatches.push({
      matchNumber: formatMatchNumber(matchObj, index),
      alliance: selfAlliance,
      partner,
      opponents,
      scoreSelf,
      scoreOpponent,
      result,
      completed: played,
    });
  });

  const playedMatches = aresMatches.filter((m) => m.completed && m.result !== "upcoming");
  const wins = statsWins ?? (playedMatches.length > 0 ? playedMatches.filter((m) => m.result === "won").length : null);
  const losses = statsLosses ?? (playedMatches.length > 0 ? playedMatches.filter((m) => m.result === "lost").length : null);
  const ties = statsTies ?? (playedMatches.length > 0 ? playedMatches.filter((m) => m.result === "tie").length : null);

  return {
    ftcSeason: season,
    ftcEventCode: normalizedCode,
    eventName,
    eventDate,
    eventLocation,
    oprList,
    aresOpr,
    aresRank,
    wins,
    losses,
    ties,
    aresMatches,
  };
}

export async function fetchFtcScoutEventData(
  season: number,
  eventCode: string,
  targetTeamNumber = 23247,
  fetchImpl: typeof fetch = fetch,
): Promise<FtcScoutEventSyncResult> {
  const safeSeason = Number.isInteger(season) ? ALLOWED_SEASONS.get(season) : undefined;
  if (!safeSeason) {
    throw new ApiError(400, "FTC season must be a valid kickoff year (2019–2100).", "FTCSCOUT_SEASON_INVALID");
  }
  const normalizedCode = sanitizeFtcEventCode(eventCode);

  const eventUrl = buildFtcScoutUrl(safeSeason, normalizedCode);
  const teamsUrl = buildFtcScoutUrl(safeSeason, normalizedCode, "/teams");
  const matchesUrl = buildFtcScoutUrl(safeSeason, normalizedCode, "/matches");
  const requestInit: RequestInit = {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  };

  const [eventRes, teamsRes, matchesRes] = await Promise.all([
    fetchImpl(eventUrl, requestInit),
    fetchImpl(teamsUrl, requestInit),
    fetchImpl(matchesUrl, requestInit),
  ]);

  if (eventRes.status === 404) {
    throw new ApiError(
      404,
      `FTCScout event ${season} / ${normalizedCode} was not found. Check the kickoff year and event code.`,
      "FTCSCOUT_EVENT_NOT_FOUND",
    );
  }
  if (!eventRes.ok || !teamsRes.ok || !matchesRes.ok) {
    throw new ApiError(
      502,
      "Upstream FTCScout service returned an error. Try again shortly or use manual entry.",
      "FTCSCOUT_UPSTREAM_ERROR",
    );
  }

  const [eventJson, teamsJson, matchesJson] = await Promise.all([
    eventRes.json(),
    teamsRes.json(),
    matchesRes.json(),
  ]);

  return normalizeFtcScoutPayload(season, normalizedCode, eventJson, teamsJson, matchesJson, targetTeamNumber);
}
