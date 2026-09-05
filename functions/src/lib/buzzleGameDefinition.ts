import { randomInt } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ApiError } from "../middleware/errorHandler";
import type { GameDefinition } from "./gameMatches";

import { BUZZLE_LETTER_DISTRIBUTION as DISTRIBUTION, createBuzzleTileBag as createBag, BUZZLE_ONLINE_INDICES, playBuzzleTiles, passBuzzleTurn,
  exchangeBuzzleTiles, BuzzleRuleError, type BuzzleGameState as SharedState,
} from "../generated/games/buzzle";

interface Tile { id: string; letter: string; points: number; blank: boolean }
interface BoardTile extends Tile { playedBy: number }
interface PlayerState { rack: Tile[]; score: number }

export interface BuzzleGameState {
  board: Array<BoardTile | null>;
  bag: Tile[];
  players: PlayerState[];
  currentPlayer: number;
  turn: number;
  consecutivePasses: number;
  finished: boolean;
  winner: number | "draw" | null;
}

export type BuzzleAction =
  | { type: "play"; placements: Array<{ index: number; tileId: string; assignedLetter?: string }> }
  | { type: "exchange"; tileIds: string[] }
  | { type: "pass" };

type BuzzlePlayerView = Record<string, unknown> & {
  board: Array<BoardTile | null>;
  rack: Tile[];
  players: Array<{ score: number; rackCount: number }>;
  currentPlayer: number;
  turn: number;
  consecutivePasses: number;
  bagCount: number;
  finished: boolean;
  winner: number | "draw" | null;
};

const CELL_COUNT = 217;
const RACK_SIZE = 7;
const MAX_ACTIONS = 400;
const TILE_SPECS = new Map(DISTRIBUTION.map(([letter, count, points]) => [letter, { count, points }]));

let dictionary: ReadonlySet<string> | null = null;
function getDictionary(): ReadonlySet<string> {
  dictionary ??= new Set(
    readFileSync(resolve(__dirname, "../../data/buzzle-words.txt"), "utf8")
      .split(/\r?\n/u)
      .map((word) => word.trim())
      .filter(Boolean),
  );
  return dictionary;
}

function shuffle<T>(values: T[]): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = randomInt(index + 1);
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function draw(bag: Tile[], count: number): Tile[] {
  return bag.splice(Math.max(0, bag.length - count), count);
}

function parseTile(value: unknown, boardTile: boolean, playerCount: number): Tile | BoardTile {
  if (typeof value !== "object" || value === null) throw new Error("Invalid BUZZLE tile.");
  const tile = value as Partial<BoardTile>;
  const match = typeof tile.id === "string" ? /^([A-Z?])-(\d{1,2})$/u.exec(tile.id) : null;
  const spec = match ? TILE_SPECS.get(match[1]) : undefined;
  const copy = match ? Number(match[2]) : 0;
  const blank = match?.[1] === "?";
  if (
    !match || !spec || copy < 1 || copy > spec.count || tile.points !== spec.points ||
    tile.blank !== blank || typeof tile.letter !== "string" ||
    (blank ? !/^[A-Z?]$/u.test(tile.letter) : tile.letter !== match[1]) ||
    (boardTile && (!Number.isSafeInteger(tile.playedBy) || (tile.playedBy as number) < 0 || (tile.playedBy as number) >= playerCount))
  ) throw new Error("Invalid BUZZLE tile.");
  const parsed: Tile = { id: tile.id as string, letter: tile.letter, points: tile.points, blank };
  return boardTile ? { ...parsed, playedBy: tile.playedBy as number } : parsed;
}

export function parseBuzzleGameState(value: unknown, playerCount: number): BuzzleGameState {
  if (typeof value !== "object" || value === null) throw new Error("Invalid BUZZLE state.");
  const data = value as Partial<BuzzleGameState>;
  if (!Array.isArray(data.board) || data.board.length !== CELL_COUNT || !Array.isArray(data.bag) ||
      !Array.isArray(data.players) || data.players.length !== playerCount) throw new Error("Invalid BUZZLE state.");
  const board = data.board.map((tile) => tile === null ? null : parseTile(tile, true, playerCount) as BoardTile);
  const bag = data.bag.map((tile) => parseTile(tile, false, playerCount) as Tile);
  const players = data.players.map((player) => {
    if (typeof player !== "object" || player === null || !Array.isArray(player.rack) ||
        player.rack.length > RACK_SIZE || !Number.isSafeInteger(player.score) || Math.abs(player.score) > 100_000) {
      throw new Error("Invalid BUZZLE player state.");
    }
    return { rack: player.rack.map((tile) => parseTile(tile, false, playerCount) as Tile), score: player.score };
  });
  const allTiles = [...board.filter((tile): tile is BoardTile => tile !== null), ...bag, ...players.flatMap(({ rack }) => rack)];
  if (allTiles.length !== 100 || new Set(allTiles.map(({ id }) => id)).size !== 100 ||
      !Number.isSafeInteger(data.currentPlayer) || (data.currentPlayer as number) < 0 || (data.currentPlayer as number) >= playerCount ||
      !Number.isSafeInteger(data.turn) || (data.turn as number) < 1 || (data.turn as number) > MAX_ACTIONS + 1 ||
      !Number.isSafeInteger(data.consecutivePasses) || (data.consecutivePasses as number) < 0 || (data.consecutivePasses as number) > playerCount * 3 ||
      typeof data.finished !== "boolean" || (data.winner !== null && data.winner !== "draw" &&
        (!Number.isSafeInteger(data.winner) || (data.winner as number) < 0 || (data.winner as number) >= playerCount)) ||
      data.finished !== (data.winner !== null)) throw new Error("Invalid BUZZLE state.");
  return { board, bag, players, currentPlayer: data.currentPlayer as number, turn: data.turn as number,
    consecutivePasses: data.consecutivePasses as number, finished: data.finished,
    winner: data.winner as number | "draw" | null };
}

function normalizedTile(tile: Tile, assignedLetter: string | undefined, playedBy: number): BoardTile {
  if (tile.blank) {
    const letter = assignedLetter?.trim().toUpperCase();
    if (!letter || !/^[A-Z]$/u.test(letter)) throw new ApiError(400, "Choose a letter for every blank tile.", "BUZZLE_BLANK_REQUIRED");
    return { ...tile, letter, playedBy };
  }
  if (assignedLetter !== undefined) throw new ApiError(400, "Only blank tiles can change letter.", "BUZZLE_INVALID_BLANK");
  return { ...tile, playedBy };
}

function sharedState(state: BuzzleGameState, playerIndex: number): SharedState {
  return { ...state, currentPlayer: playerIndex, board: BUZZLE_ONLINE_INDICES.map((index) => state.board[index]) };
}
function serverState(state: SharedState): BuzzleGameState {
  return { ...state, board: BUZZLE_ONLINE_INDICES.map((index) => state.board[index]) };
}
function applyAction(state: BuzzleGameState, playerIndex: number, action: BuzzleAction): BuzzleGameState {
  if (state.finished) throw new ApiError(409, "This BUZZLE match is finished.", "BUZZLE_FINISHED");
  const shared = sharedState(state, playerIndex);
  try {
    if (action.type === "pass") return serverState(passBuzzleTurn(shared));
    if (action.type === "exchange") {
      // The shared shuffle requests one bounded draw for each descending index.
      // Use the same unbiased cryptographic integer source as the online service.
      let limit = state.bag.length;
      return serverState(exchangeBuzzleTiles(shared, action.tileIds, () => {
        const draw = (randomInt(limit) + 0.5) / limit;
        limit -= 1;
        return draw;
      }));
    }
    if (action.placements.length < 1 || action.placements.length > RACK_SIZE) {
      throw new ApiError(400, "Place between one and seven tiles.", "BUZZLE_PLACEMENT_COUNT");
    }
    const rack = new Map(state.players[playerIndex].rack.map((tile) => [tile.id, tile]));
    const placements = action.placements.map((placement) => {
      const tile = rack.get(placement.tileId);
      if (!tile || !Number.isSafeInteger(placement.index) || placement.index < 0 || placement.index >= CELL_COUNT) {
        throw new ApiError(400, "That tile placement is not legal.", "BUZZLE_ILLEGAL_PLACEMENT");
      }
      // Tile identity/value comes only from the validated authoritative rack.
      normalizedTile(tile, placement.assignedLetter, playerIndex);
      rack.delete(tile.id);
      return { index: BUZZLE_ONLINE_INDICES[placement.index], tile, assignedLetter: placement.assignedLetter };
    });
    return serverState(playBuzzleTiles(shared, placements, getDictionary()).state);
  } catch (error) {
    if (error instanceof BuzzleRuleError) throw new ApiError(400, error.message, error.code);
    throw error;
  }
}

export const buzzleGameDefinition: GameDefinition<BuzzleGameState, BuzzleAction, BuzzlePlayerView, "player-1" | "player-2"> = {
  gameType: "buzzle",
  minPlayers: 2,
  maxPlayers: 2,
  defaultMatchSize: 2,
  maxActions: MAX_ACTIONS,
  actionPolicy: "sequential",
  createInitialState: () => {
    const bag = shuffle(createBag());
    const players = Array.from({ length: 2 }, () => ({ rack: draw(bag, RACK_SIZE), score: 0 }));
    return { board: Array.from({ length: CELL_COUNT }, () => null), bag, players, currentPlayer: 0,
      turn: 1, consecutivePasses: 0, finished: false, winner: null };
  },
  parseState: parseBuzzleGameState,
  activePlayerIndex: (state) => state.currentPlayer,
  applyAction,
  isFinished: (state) => state.finished,
  playerLabel: (index) => index === 0 ? "player-1" : "player-2",
  toPlayerView: (state, playerIndex) => ({
    board: state.board,
    rack: state.players[playerIndex].rack,
    players: state.players.map(({ score, rack }) => ({ score, rackCount: rack.length })),
    currentPlayer: state.currentPlayer,
    turn: state.turn,
    consecutivePasses: state.consecutivePasses,
    bagCount: state.bag.length,
    finished: state.finished,
    winner: state.winner,
  }),
};
