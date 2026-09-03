import { authenticatedFetch } from "@/lib/api";
import { BUZZLE_CELL_COUNT, type BuzzleBoardTile, type BuzzlePlacement, type BuzzleTile } from "@/lib/buzzle";

export type OnlineBuzzleStatus = "waiting" | "active" | "finished";
export type OnlineBuzzleAction =
  | { type: "play"; placements: Array<{ index: number; tileId: string; assignedLetter?: string }> }
  | { type: "exchange"; tileIds: string[] }
  | { type: "pass" };

export interface OnlineBuzzleGame {
  gameId: string;
  status: OnlineBuzzleStatus;
  youAre: "player-1" | "player-2";
  playerIndex: number;
  playerCount: number;
  desiredPlayers: 2;
  version: number;
  actionSequence: number;
  expiresAt: string;
  syncsRemaining: number;
  board: Array<BuzzleBoardTile | null>;
  rack: BuzzleTile[];
  players: Array<{ score: number; rackCount: number }>;
  currentPlayer: number;
  turn: number;
  consecutivePasses: number;
  bagCount: number;
  finished: boolean;
  winner: number | "draw" | null;
}

export interface OnlineBuzzleSession { playerToken: string; game: OnlineBuzzleGame }
export type OnlineBuzzleSyncResult =
  | { unchanged: false; game: OnlineBuzzleGame }
  | { unchanged: true; syncsRemaining: number; expiresAt: string };

const WAITING_DELAYS = [6_000, 8_000, 12_000] as const;
const OPPONENT_DELAYS = [4_000, 6_000, 8_000, 12_000] as const;

export class BuzzleOnlineError extends Error {
  constructor(message: string, public readonly code: string, public readonly status: number) {
    super(message);
    this.name = "BuzzleOnlineError";
  }
}

export function getOnlineBuzzlePollDelay(game: OnlineBuzzleGame, unchangedPolls: number): number | null {
  if (game.status === "finished" || (game.status === "active" && game.currentPlayer === game.playerIndex)) return null;
  const delays = game.status === "waiting" ? WAITING_DELAYS : OPPONENT_DELAYS;
  const index = Math.min(Math.max(0, Math.floor(Number.isFinite(unchangedPolls) ? unchangedPolls : 0)), delays.length - 1);
  return delays[index];
}

function parseTile(value: unknown, boardTile = false): BuzzleTile | BuzzleBoardTile | null {
  if (value === null && boardTile) return null;
  if (typeof value !== "object" || value === null) return null;
  const tile = value as Record<string, unknown>;
  if (typeof tile.id !== "string" || !/^[A-Z?]-\d{1,2}$/u.test(tile.id) ||
      typeof tile.letter !== "string" || !/^[A-Z?]$/u.test(tile.letter) ||
      !Number.isInteger(tile.points) || (tile.points as number) < 0 || (tile.points as number) > 10 ||
      typeof tile.blank !== "boolean" || (boardTile && (!Number.isInteger(tile.playedBy) || (tile.playedBy as number) < 0 || (tile.playedBy as number) > 1))) return null;
  const parsed: BuzzleTile = { id: tile.id, letter: tile.letter, points: tile.points as number, blank: tile.blank };
  return boardTile ? { ...parsed, playedBy: tile.playedBy as number } : parsed;
}

export function parseOnlineBuzzleGame(value: unknown): OnlineBuzzleGame {
  if (typeof value !== "object" || value === null) throw new BuzzleOnlineError("The server returned an invalid match.", "INVALID_RESPONSE", 502);
  const game = value as Record<string, unknown>;
  const state = typeof game.state === "object" && game.state !== null
    ? game.state as Record<string, unknown>
    : {};
  const board = state.board;
  const rack = state.rack;
  const players = state.players;
  if (typeof game.gameId !== "string" || game.gameId.length < 20 || game.gameType !== "buzzle" ||
      !["waiting", "active", "finished"].includes(String(game.status)) ||
      (game.youAre !== "player-1" && game.youAre !== "player-2") ||
      !Number.isInteger(game.playerIndex) || (game.playerIndex as number) < 0 || (game.playerIndex as number) > 1 ||
      !Number.isInteger(game.playerCount) || (game.playerCount as number) < 1 || (game.playerCount as number) > 2 ||
      game.desiredPlayers !== 2 || !Number.isInteger(game.version) || !Number.isInteger(game.actionSequence) ||
      typeof game.expiresAt !== "string" || !Number.isFinite(Date.parse(game.expiresAt)) ||
      !Number.isInteger(game.syncsRemaining) || (game.syncsRemaining as number) < 0 ||
      !Array.isArray(board) || board.length !== BUZZLE_CELL_COUNT || board.some((tile) => parseTile(tile, true) === null && tile !== null) ||
      !Array.isArray(rack) || rack.length > 7 || rack.some((tile) => parseTile(tile) === null) ||
      !Array.isArray(players) || players.length !== 2 || players.some((player) => typeof player !== "object" || player === null ||
        !Number.isInteger((player as Record<string, unknown>).score) || !Number.isInteger((player as Record<string, unknown>).rackCount)) ||
      !Number.isInteger(state.currentPlayer) || (state.currentPlayer as number) < 0 || (state.currentPlayer as number) > 1 ||
      !Number.isInteger(state.turn) || !Number.isInteger(state.consecutivePasses) || !Number.isInteger(state.bagCount) ||
      typeof state.finished !== "boolean" || (state.winner !== null && state.winner !== "draw" && state.winner !== 0 && state.winner !== 1)) {
    throw new BuzzleOnlineError("The server returned an invalid match.", "INVALID_RESPONSE", 502);
  }
  return {
    gameId: game.gameId, status: game.status as OnlineBuzzleStatus, youAre: game.youAre,
    playerIndex: game.playerIndex as number, playerCount: game.playerCount as number, desiredPlayers: 2,
    version: game.version as number, actionSequence: game.actionSequence as number,
    expiresAt: game.expiresAt, syncsRemaining: game.syncsRemaining as number,
    board: board.map((tile) => parseTile(tile, true) as BuzzleBoardTile | null),
    rack: rack.map((tile) => parseTile(tile) as BuzzleTile),
    players: players.map((player) => ({ score: (player as Record<string, number>).score, rackCount: (player as Record<string, number>).rackCount })),
    currentPlayer: state.currentPlayer as number, turn: state.turn as number,
    consecutivePasses: state.consecutivePasses as number, bagCount: state.bagCount as number,
    finished: state.finished, winner: state.winner as number | "draw" | null,
  };
}

async function request(path: string, body: Record<string, unknown>, playerToken?: string): Promise<Record<string, unknown>> {
  const response = await authenticatedFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(playerToken ? { "X-Game-Player": playerToken } : {}) },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) throw new BuzzleOnlineError(
    typeof payload?.error === "string" ? payload.error : "The online match request failed.",
    typeof payload?.code === "string" ? payload.code : `HTTP_${response.status}`,
    response.status,
  );
  if (!payload) throw new BuzzleOnlineError("The server returned an invalid match.", "INVALID_RESPONSE", 502);
  return payload;
}

function parseSession(payload: Record<string, unknown>): OnlineBuzzleSession {
  if (typeof payload.playerToken !== "string" || !/^[A-Za-z0-9_-]{43}$/u.test(payload.playerToken)) {
    throw new BuzzleOnlineError("The server returned an invalid match session.", "INVALID_RESPONSE", 502);
  }
  return { playerToken: payload.playerToken, game: parseOnlineBuzzleGame(payload.game) };
}

export async function createOnlineBuzzleGame() {
  const payload = await request("/api/buzzle/games", {});
  const session = parseSession(payload);
  if (typeof payload.inviteCode !== "string" || !/^[2-9A-HJ-NP-Z]{8}$/u.test(payload.inviteCode)) {
    throw new BuzzleOnlineError("The server returned an invalid invite.", "INVALID_RESPONSE", 502);
  }
  return { ...session, inviteCode: payload.inviteCode };
}
export async function joinOnlineBuzzleGame(code: string) { return parseSession(await request("/api/buzzle/join", { code: code.trim().toUpperCase() })); }
export async function findOnlineBuzzleMatch() { return parseSession(await request("/api/buzzle/matchmaking", {})); }
export async function findTeamBuzzleMatch() { return parseSession(await request("/api/buzzle/matchmaking/team", {})); }

export async function syncOnlineBuzzleGame(known: OnlineBuzzleGame, playerToken: string): Promise<OnlineBuzzleSyncResult> {
  const payload = await request(`/api/buzzle/games/${encodeURIComponent(known.gameId)}/sync`, {
    knownVersion: known.version, knownStatus: known.status, knownPlayerCount: known.playerCount,
  }, playerToken);
  if (payload.unchanged === true) {
    if (!Number.isInteger(payload.syncsRemaining) || typeof payload.expiresAt !== "string") throw new BuzzleOnlineError("The server returned an invalid match.", "INVALID_RESPONSE", 502);
    return { unchanged: true, syncsRemaining: payload.syncsRemaining as number, expiresAt: payload.expiresAt };
  }
  return { unchanged: false, game: parseOnlineBuzzleGame(payload.game) };
}

export async function playOnlineBuzzleAction(game: OnlineBuzzleGame, playerToken: string, action: OnlineBuzzleAction): Promise<OnlineBuzzleGame> {
  const payload = await request(`/api/buzzle/games/${encodeURIComponent(game.gameId)}/actions`, {
    expectedVersion: game.version, action,
  }, playerToken);
  return parseOnlineBuzzleGame(payload.game);
}

export function placementsToOnlineAction(placements: ReadonlyArray<BuzzlePlacement>): OnlineBuzzleAction {
  return { type: "play", placements: placements.map(({ index, tile, assignedLetter }) => ({
    index, tileId: tile.id, ...(assignedLetter ? { assignedLetter } : {}),
  })) };
}
