import { randomInt } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ApiError } from "../middleware/errorHandler";
import type { GameDefinition } from "./gameMatches";

type Multiplier = "plain" | "DL" | "TL" | "DW" | "TW" | "star";

interface Coordinate { q: number; r: number }
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

const RADIUS = 6;
const CELL_COUNT = 127;
const RACK_SIZE = 7;
const MAX_ACTIONS = 400;
const AXES: ReadonlyArray<Coordinate> = [{ q: 1, r: 0 }, { q: 0, r: 1 }, { q: 1, r: -1 }];
const DIRECTIONS: ReadonlyArray<Coordinate> = [...AXES, ...AXES.map(({ q, r }) => ({ q: -q, r: -r }))];
const DISTRIBUTION: ReadonlyArray<readonly [string, number, number]> = [
  ["E", 12, 1], ["A", 9, 1], ["I", 9, 1], ["O", 8, 1], ["N", 6, 1],
  ["R", 6, 1], ["T", 6, 1], ["L", 4, 1], ["S", 4, 1], ["U", 4, 1],
  ["D", 4, 2], ["G", 3, 2], ["B", 2, 3], ["C", 2, 3], ["M", 2, 3],
  ["P", 2, 3], ["F", 2, 4], ["H", 2, 4], ["V", 2, 4], ["W", 2, 4],
  ["Y", 2, 4], ["K", 1, 5], ["J", 1, 8], ["X", 1, 8], ["Q", 1, 10],
  ["Z", 1, 10], ["?", 2, 0],
];
const TILE_SPECS = new Map(DISTRIBUTION.map(([letter, count, points]) => [letter, { count, points }]));

const COORDINATES: Coordinate[] = [];
for (let q = -RADIUS; q <= RADIUS; q += 1) {
  for (let r = Math.max(-RADIUS, -q - RADIUS); r <= Math.min(RADIUS, -q + RADIUS); r += 1) {
    COORDINATES.push({ q, r });
  }
}
const COORDINATE_INDEX = new Map(COORDINATES.map(({ q, r }, index) => [`${q},${r}`, index]));
const TRIPLE_WORD = new Set(["0,-6", "6,-6", "6,0", "0,6", "-6,6", "-6,0"]);
const TRIPLE_LETTER = new Set(["0,-4", "4,-4", "4,0", "0,4", "-4,4", "-4,0"]);
const OUTER_DOUBLE_LETTER = new Set([
  "5,0", "-5,0", "0,5", "0,-5", "5,-5", "-5,5", "5,-2", "-5,2",
  "2,3", "-2,-3", "3,-5", "-3,5", "2,-5", "-2,5",
]);

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

function cellIndex(q: number, r: number): number | null {
  return COORDINATE_INDEX.get(`${q},${r}`) ?? null;
}

function distance({ q, r }: Coordinate): number {
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
}

function multiplier(index: number): Multiplier {
  const coordinate = COORDINATES[index];
  const key = `${coordinate.q},${coordinate.r}`;
  if (coordinate.q === 0 && coordinate.r === 0) return "star";
  if (TRIPLE_WORD.has(key)) return "TW";
  if (TRIPLE_LETTER.has(key)) return "TL";
  if (distance(coordinate) === 3) return "DW";
  if (distance(coordinate) === 2 || OUTER_DOUBLE_LETTER.has(key)) return "DL";
  return "plain";
}

function createBag(): Tile[] {
  return DISTRIBUTION.flatMap(([letter, count, points]) =>
    Array.from({ length: count }, (_, copy) => ({
      id: `${letter}-${copy + 1}`,
      letter,
      points,
      blank: letter === "?",
    })),
  );
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

function collectWord(board: Array<BoardTile | null>, additions: ReadonlyMap<number, BoardTile>, origin: number, axis: number) {
  const direction = AXES[axis];
  let cursor = COORDINATES[origin];
  const occupied = (index: number) => additions.get(index) ?? board[index] ?? null;
  while (true) {
    const previous = cellIndex(cursor.q - direction.q, cursor.r - direction.r);
    if (previous === null || !occupied(previous)) break;
    cursor = COORDINATES[previous];
  }
  const indices: number[] = [];
  const tiles: BoardTile[] = [];
  while (true) {
    const index = cellIndex(cursor.q, cursor.r);
    if (index === null) break;
    const tile = occupied(index);
    if (!tile) break;
    indices.push(index); tiles.push(tile);
    cursor = { q: cursor.q + direction.q, r: cursor.r + direction.r };
  }
  return { indices, tiles };
}

function placementAxis(indices: number[]): number {
  if (indices.length === 1) return 0;
  const coordinates = indices.map((index) => COORDINATES[index]);
  const candidates = [
    coordinates.every(({ r }) => r === coordinates[0].r),
    coordinates.every(({ q }) => q === coordinates[0].q),
    coordinates.every(({ q, r }) => q + r === coordinates[0].q + coordinates[0].r),
  ];
  const axis = candidates.findIndex(Boolean);
  if (axis < 0) throw new ApiError(400, "Place tiles in one straight hex line.", "BUZZLE_NOT_LINEAR");
  return axis;
}

function scoreWord(word: ReturnType<typeof collectWord>, placed: ReadonlySet<number>): number {
  let letters = 0;
  let wordMultiplier = 1;
  word.indices.forEach((index, offset) => {
    const tile = word.tiles[offset];
    const bonus = placed.has(index) ? multiplier(index) : "plain";
    letters += tile.points * (bonus === "DL" ? 2 : bonus === "TL" ? 3 : 1);
    if (bonus === "DW" || bonus === "star") wordMultiplier *= 2;
    if (bonus === "TW") wordMultiplier *= 3;
  });
  return letters * wordMultiplier;
}

function applyPlay(state: BuzzleGameState, playerIndex: number, action: Extract<BuzzleAction, { type: "play" }>): BuzzleGameState {
  if (action.placements.length < 1 || action.placements.length > RACK_SIZE) throw new ApiError(400, "Place between one and seven tiles.", "BUZZLE_PLACEMENT_COUNT");
  const player = state.players[playerIndex];
  const rack = new Map(player.rack.map((tile) => [tile.id, tile]));
  const additions = new Map<number, BoardTile>();
  for (const placement of action.placements) {
    const tile = rack.get(placement.tileId);
    if (!tile || !Number.isSafeInteger(placement.index) || placement.index < 0 || placement.index >= CELL_COUNT ||
        state.board[placement.index] || additions.has(placement.index)) throw new ApiError(400, "That tile placement is not legal.", "BUZZLE_ILLEGAL_PLACEMENT");
    additions.set(placement.index, normalizedTile(tile, placement.assignedLetter, playerIndex));
    rack.delete(tile.id);
  }
  const indices = [...additions.keys()];
  let axis = placementAxis(indices);
  const boardEmpty = state.board.every((tile) => tile === null);
  if (boardEmpty && !additions.has(cellIndex(0, 0)!)) throw new ApiError(400, "The opening word must cover the center star.", "BUZZLE_CENTER_REQUIRED");
  if (!boardEmpty && !indices.some((index) => DIRECTIONS.some(({ q, r }) => {
    const origin = COORDINATES[index]; const neighbor = cellIndex(origin.q + q, origin.r + r);
    return neighbor !== null && state.board[neighbor] !== null;
  }))) throw new ApiError(400, "The new word must connect to the hive.", "BUZZLE_DISCONNECTED");
  if (indices.length === 1) {
    axis = AXES.map((_, candidate) => collectWord(state.board, additions, indices[0], candidate).indices.length)
      .reduce((best, length, candidate, lengths) => length > lengths[best] ? candidate : best, 0);
  }
  const main = collectWord(state.board, additions, indices[0], axis);
  if (indices.some((index) => !main.indices.includes(index)) || main.indices.length < 2) throw new ApiError(400, "The play must form one gap-free word.", "BUZZLE_GAPPED_WORD");
  const words = new Map<string, ReturnType<typeof collectWord>>();
  for (const index of indices) for (let candidate = 0; candidate < AXES.length; candidate += 1) {
    const word = collectWord(state.board, additions, index, candidate);
    if (word.indices.length >= 2) words.set(word.indices.join(","), word);
  }
  let score = indices.length === RACK_SIZE ? 50 : 0;
  for (const word of words.values()) {
    const text = word.tiles.map(({ letter }) => letter).join("").toLowerCase();
    if (!getDictionary().has(text)) throw new ApiError(400, `${text.toUpperCase()} is not in the selected dictionary.`, "BUZZLE_WORD_NOT_FOUND");
    score += scoreWord(word, new Set(indices));
  }
  const board = [...state.board];
  for (const [index, tile] of additions) board[index] = tile;
  const bag = [...state.bag];
  const players = state.players.map((entry) => ({ score: entry.score, rack: [...entry.rack] }));
  players[playerIndex].rack = [...rack.values()];
  players[playerIndex].score += score;
  players[playerIndex].rack.push(...draw(bag, RACK_SIZE - players[playerIndex].rack.length));
  let next: BuzzleGameState = { ...state, board, bag, players, currentPlayer: (playerIndex + 1) % players.length,
    turn: state.turn + 1, consecutivePasses: 0 };
  if (bag.length === 0 && players[playerIndex].rack.length === 0) next = finish(next, playerIndex);
  return next;
}

function finish(state: BuzzleGameState, playerWhoWentOut: number | null): BuzzleGameState {
  const players = state.players.map((player) => ({ ...player, rack: [...player.rack] }));
  let award = 0;
  players.forEach((player, index) => {
    const penalty = player.rack.reduce((total, tile) => total + tile.points, 0);
    player.score -= penalty;
    if (playerWhoWentOut !== null && index !== playerWhoWentOut) award += penalty;
  });
  if (playerWhoWentOut !== null) players[playerWhoWentOut].score += award;
  const high = Math.max(...players.map(({ score }) => score));
  const leaders = players.flatMap(({ score }, index) => score === high ? [index] : []);
  return { ...state, players, finished: true, winner: leaders.length === 1 ? leaders[0] : "draw" };
}

function applyAction(state: BuzzleGameState, playerIndex: number, action: BuzzleAction): BuzzleGameState {
  if (state.finished) throw new ApiError(409, "This BUZZLE match is finished.", "BUZZLE_FINISHED");
  if (action.type === "play") return applyPlay(state, playerIndex, action);
  if (action.type === "pass") {
    const passes = state.consecutivePasses + 1;
    const next = { ...state, currentPlayer: (playerIndex + 1) % state.players.length, turn: state.turn + 1, consecutivePasses: passes };
    return passes >= state.players.length * 3 ? finish(next, null) : next;
  }
  const selected = new Set(action.tileIds);
  const player = state.players[playerIndex];
  if (selected.size < 1 || selected.size !== action.tileIds.length || selected.size > RACK_SIZE || state.bag.length < selected.size) {
    throw new ApiError(400, "Choose rack tiles that the bag can replace.", "BUZZLE_INVALID_EXCHANGE");
  }
  const returned = player.rack.filter(({ id }) => selected.has(id));
  if (returned.length !== selected.size) throw new ApiError(400, "Exchange only tiles from your rack.", "BUZZLE_INVALID_EXCHANGE");
  const bag = [...state.bag];
  const players = state.players.map((entry) => ({ score: entry.score, rack: [...entry.rack] }));
  players[playerIndex].rack = players[playerIndex].rack.filter(({ id }) => !selected.has(id));
  players[playerIndex].rack.push(...draw(bag, returned.length));
  bag.unshift(...returned);
  return { ...state, bag: shuffle(bag), players, currentPlayer: (playerIndex + 1) % players.length,
    turn: state.turn + 1, consecutivePasses: 0 };
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
