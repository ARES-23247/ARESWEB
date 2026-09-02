import { authenticatedFetch } from "@/lib/api";
import type { BuzzelloBoard, BuzzelloPlayer } from "@/lib/buzzello";

export type OnlineBuzzelloStatus = "waiting" | "active" | "finished";

export interface OnlineBuzzelloHistoryEntry {
  player: BuzzelloPlayer;
  index: number;
  flippedCount: number;
}

export interface OnlineBuzzelloGame {
  gameId: string;
  status: OnlineBuzzelloStatus;
  youAre: BuzzelloPlayer;
  board: BuzzelloBoard;
  currentPlayer: BuzzelloPlayer;
  version: number;
  moveNumber: number;
  history: OnlineBuzzelloHistoryEntry[];
  winner: BuzzelloPlayer | "draw" | null;
  lastMove: (OnlineBuzzelloHistoryEntry & { flipped: number[] }) | null;
  passedPlayer: BuzzelloPlayer | null;
  scores: Record<BuzzelloPlayer, number>;
  opponentConnected: boolean;
  expiresAt: string;
  syncsRemaining: number;
}

export interface OnlineBuzzelloSession {
  playerToken: string;
  game: OnlineBuzzelloGame;
}

export class BuzzelloOnlineError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "BuzzelloOnlineError";
  }
}

function isPlayer(value: unknown): value is BuzzelloPlayer {
  return value === "yellow" || value === "black";
}

function parseHistoryEntry(value: unknown): OnlineBuzzelloHistoryEntry | null {
  if (typeof value !== "object" || value === null) return null;
  const entry = value as Record<string, unknown>;
  if (
    !isPlayer(entry.player) ||
    !Number.isInteger(entry.index) ||
    (entry.index as number) < 0 ||
    (entry.index as number) > 60 ||
    !Number.isInteger(entry.flippedCount) ||
    (entry.flippedCount as number) < 1 ||
    (entry.flippedCount as number) > 60
  ) {
    return null;
  }
  return {
    player: entry.player,
    index: entry.index as number,
    flippedCount: entry.flippedCount as number,
  };
}

export function parseOnlineBuzzelloGame(value: unknown): OnlineBuzzelloGame {
  if (typeof value !== "object" || value === null) {
    throw new BuzzelloOnlineError(
      "The server returned an invalid match.",
      "INVALID_RESPONSE",
      502,
    );
  }
  const game = value as Record<string, unknown>;
  const state = game.state as Record<string, unknown> | undefined;
  const board = state?.board;
  const history = state?.history;
  const scores = state?.scores as Record<string, unknown> | undefined;
  const lastMove = state?.lastMove;
  if (
    typeof game.gameId !== "string" ||
    game.gameId.length < 20 ||
    game.gameType !== "buzzello" ||
    !["waiting", "active", "finished"].includes(String(game.status)) ||
    !isPlayer(game.youAre) ||
    !Number.isInteger(game.playerIndex) ||
    !Number.isInteger(game.playerCount) ||
    !Number.isInteger(game.desiredPlayers) ||
    game.desiredPlayers !== 2 ||
    !Number.isInteger(game.actionSequence) ||
    !Array.isArray(board) ||
    board.length !== 61 ||
    board.some((cell) => cell !== null && !isPlayer(cell)) ||
    !isPlayer(state?.currentPlayer) ||
    !Number.isInteger(game.version) ||
    !Number.isInteger(state?.moveNumber) ||
    !Array.isArray(history) ||
    history.length > 55 ||
    !history.every((entry) => parseHistoryEntry(entry) !== null) ||
    (state?.winner !== null &&
      state?.winner !== "draw" &&
      !isPlayer(state?.winner)) ||
    (state?.passedPlayer !== null && !isPlayer(state?.passedPlayer)) ||
    typeof game.expiresAt !== "string" ||
    !Number.isFinite(Date.parse(game.expiresAt)) ||
    !Number.isInteger(game.syncsRemaining) ||
    (game.syncsRemaining as number) < 0 ||
    !scores ||
    !Number.isInteger(scores.yellow) ||
    !Number.isInteger(scores.black)
  ) {
    throw new BuzzelloOnlineError(
      "The server returned an invalid match.",
      "INVALID_RESPONSE",
      502,
    );
  }

  let parsedLastMove: OnlineBuzzelloGame["lastMove"] = null;
  if (lastMove !== null) {
    const entry = parseHistoryEntry(lastMove);
    const flipped = (lastMove as Record<string, unknown>)?.flipped;
    if (
      !entry ||
      !Array.isArray(flipped) ||
      flipped.length < 1 ||
      flipped.some(
        (index) => !Number.isInteger(index) || index < 0 || index > 60,
      )
    ) {
      throw new BuzzelloOnlineError(
        "The server returned an invalid match.",
        "INVALID_RESPONSE",
        502,
      );
    }
    parsedLastMove = { ...entry, flipped: [...flipped] as number[] };
  }

  return {
    gameId: game.gameId,
    status: game.status as OnlineBuzzelloStatus,
    youAre: game.youAre,
    board: [...board] as BuzzelloBoard,
    currentPlayer: state.currentPlayer,
    version: game.version as number,
    moveNumber: state.moveNumber as number,
    history: history.map((entry) => parseHistoryEntry(entry)!),
    winner: state.winner as OnlineBuzzelloGame["winner"],
    lastMove: parsedLastMove,
    passedPlayer: state.passedPlayer as BuzzelloPlayer | null,
    scores: {
      yellow: scores.yellow as number,
      black: scores.black as number,
    },
    opponentConnected: game.playerCount === game.desiredPlayers,
    expiresAt: game.expiresAt,
    syncsRemaining: game.syncsRemaining as number,
  };
}

async function requestBuzzello(
  path: string,
  body: Record<string, unknown>,
  playerToken?: string,
): Promise<Record<string, unknown>> {
  const response = await authenticatedFetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(playerToken ? { "X-Game-Player": playerToken } : {}),
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!response.ok) {
    throw new BuzzelloOnlineError(
      typeof payload?.error === "string"
        ? payload.error
        : "The online match request failed.",
      typeof payload?.code === "string"
        ? payload.code
        : `HTTP_${response.status}`,
      response.status,
    );
  }
  if (!payload || typeof payload !== "object") {
    throw new BuzzelloOnlineError(
      "The server returned an invalid match.",
      "INVALID_RESPONSE",
      502,
    );
  }
  return payload;
}

function parseOnlineBuzzelloSession(
  payload: Record<string, unknown>,
): OnlineBuzzelloSession {
  if (
    typeof payload.playerToken !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/u.test(payload.playerToken)
  ) {
    throw new BuzzelloOnlineError(
      "The server returned an invalid match session.",
      "INVALID_RESPONSE",
      502,
    );
  }
  return {
    playerToken: payload.playerToken,
    game: parseOnlineBuzzelloGame(payload.game),
  };
}

export async function createOnlineBuzzelloGame(): Promise<{
  inviteCode: string;
  playerToken: string;
  game: OnlineBuzzelloGame;
}> {
  const payload = await requestBuzzello("/api/buzzello/games", {});
  if (
    typeof payload.inviteCode !== "string" ||
    payload.inviteCode.length !== 8 ||
    typeof payload.playerToken !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/u.test(payload.playerToken)
  ) {
    throw new BuzzelloOnlineError(
      "The server returned an invalid invite.",
      "INVALID_RESPONSE",
      502,
    );
  }
  return {
    inviteCode: payload.inviteCode,
    playerToken: payload.playerToken,
    game: parseOnlineBuzzelloGame(payload.game),
  };
}

export async function joinOnlineBuzzelloGame(
  code: string,
): Promise<OnlineBuzzelloSession> {
  const payload = await requestBuzzello("/api/buzzello/join", {
    code: code.trim().toUpperCase(),
  });
  return parseOnlineBuzzelloSession(payload);
}

export async function findOnlineBuzzelloMatch(): Promise<OnlineBuzzelloSession> {
  const payload = await requestBuzzello("/api/buzzello/matchmaking", {});
  return parseOnlineBuzzelloSession(payload);
}

export async function findTeamBuzzelloMatch(): Promise<OnlineBuzzelloSession> {
  const payload = await requestBuzzello("/api/buzzello/matchmaking/team", {});
  return parseOnlineBuzzelloSession(payload);
}

export async function syncOnlineBuzzelloGame(
  gameId: string,
  playerToken: string,
): Promise<OnlineBuzzelloGame> {
  const payload = await requestBuzzello(
    `/api/buzzello/games/${encodeURIComponent(gameId)}/sync`,
    {},
    playerToken,
  );
  return parseOnlineBuzzelloGame(payload.game);
}

export async function playOnlineBuzzelloMove(
  gameId: string,
  index: number,
  expectedVersion: number,
  playerToken: string,
): Promise<OnlineBuzzelloGame> {
  const payload = await requestBuzzello(
    `/api/buzzello/games/${encodeURIComponent(gameId)}/moves`,
    { index, expectedVersion },
    playerToken,
  );
  return parseOnlineBuzzelloGame(payload.game);
}
