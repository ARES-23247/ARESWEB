import {
  HEX_DIRECTIONS,
  HEX_WORD_AXES,
  addAxial,
  axialKey,
  createHexCoordinateIndex,
  createHexCoordinates,
  negateAxial,
  type AxialCoordinate,
} from "@/lib/games/hexGrid";

export type BuzzleMultiplier = "plain" | "DL" | "TL" | "DW" | "TW" | "star";
export type BuzzleDifficulty = "easy" | "medium" | "master";

export interface BuzzleTile {
  id: string;
  letter: string;
  points: number;
  blank: boolean;
}

export interface BuzzleBoardTile extends BuzzleTile {
  playedBy: number;
}

export type BuzzleBoard = ReadonlyArray<BuzzleBoardTile | null>;

export interface BuzzlePlayerState {
  rack: BuzzleTile[];
  score: number;
}

export interface BuzzleGameState {
  board: BuzzleBoard;
  bag: BuzzleTile[];
  players: BuzzlePlayerState[];
  currentPlayer: number;
  turn: number;
  consecutivePasses: number;
  finished: boolean;
  winner: number | "draw" | null;
}

export interface BuzzlePlacement {
  index: number;
  tile: BuzzleTile;
  assignedLetter?: string;
}

export interface BuzzleScoredWord {
  word: string;
  score: number;
  indices: number[];
}

export interface BuzzlePlayAnalysis {
  score: number;
  words: BuzzleScoredWord[];
  axis: number;
  hiveFlush: boolean;
}

export const BUZZLE_RADIUS = 8;
export const BUZZLE_CELL_COUNT = 217;
export const BUZZLE_RACK_SIZE = 7;
export const BUZZLE_COORDINATES = createHexCoordinates(BUZZLE_RADIUS);
const BUZZLE_COORDINATE_INDEX = createHexCoordinateIndex(BUZZLE_COORDINATES);

const LETTER_DISTRIBUTION: ReadonlyArray<
  readonly [letter: string, count: number, points: number]
> = [
  ["E", 12, 1], ["A", 9, 1], ["I", 9, 1], ["O", 8, 1],
  ["N", 6, 1], ["R", 6, 1], ["T", 6, 1], ["L", 4, 1],
  ["S", 4, 1], ["U", 4, 1], ["D", 4, 2], ["G", 3, 2],
  ["B", 2, 3], ["C", 2, 3], ["M", 2, 3], ["P", 2, 3],
  ["F", 2, 4], ["H", 2, 4], ["V", 2, 4], ["W", 2, 4],
  ["Y", 2, 4], ["K", 1, 5], ["J", 1, 8], ["X", 1, 8],
  ["Q", 1, 10], ["Z", 1, 10], ["?", 2, 0],
];

const TRIPLE_WORD_KEYS = new Set([
  "-8,0", "0,-8", "-8,8", "8,-8", "0,8", "8,0",
]);
const TRIPLE_LETTER_KEYS = new Set([
  "-4,-4", "-8,4", "4,-8", "-4,8", "8,-4", "4,4",
]);
const DOUBLE_WORD_KEYS = new Set([
  "-6,-1", "-1,-6", "-7,1", "1,-7", "-7,6", "6,-7",
  "-6,7", "7,-6", "-1,7", "7,-1", "1,6", "6,1",
]);
const KEY_WILD_KEYS = new Set([
  "-2,-2", "-4,2", "2,-4", "-2,4", "4,-2", "2,2",
]);
const DOUBLE_LETTER_KEYS = new Set([
  "-4,-2", "-2,-4", "-6,2", "-4,0", "0,-4", "2,-6",
  "-6,4", "-1,-1", "4,-6", "-2,1", "1,-2", "-4,4",
  "4,-4", "-1,2", "2,-1", "-4,6", "1,1", "6,-4",
  "-2,6", "0,4", "4,0", "6,-2", "2,4", "4,2",
]);

export function getBuzzleCellIndex(q: number, r: number): number | null {
  return BUZZLE_COORDINATE_INDEX.get(`${q},${r}`) ?? null;
}

export function getBuzzleCoordinate(index: number): AxialCoordinate {
  const coordinate = BUZZLE_COORDINATES[index];
  if (!coordinate) throw new RangeError("Invalid BUZZLE board index.");
  return coordinate;
}

export function getBuzzleMultiplier(index: number): BuzzleMultiplier {
  const coordinate = getBuzzleCoordinate(index);
  const key = axialKey(coordinate);
  if (coordinate.q === 0 && coordinate.r === 0) return "star";
  if (TRIPLE_WORD_KEYS.has(key)) return "TW";
  if (TRIPLE_LETTER_KEYS.has(key)) return "TL";
  if (DOUBLE_WORD_KEYS.has(key) || KEY_WILD_KEYS.has(key)) return "DW";
  if (DOUBLE_LETTER_KEYS.has(key)) return "DL";
  return "plain";
}

export function createBuzzleTileBag(): BuzzleTile[] {
  const bag: BuzzleTile[] = [];
  for (const [letter, count, points] of LETTER_DISTRIBUTION) {
    for (let copy = 0; copy < count; copy += 1) {
      bag.push({
        id: `${letter}-${copy + 1}`,
        letter,
        points,
        blank: letter === "?",
      });
    }
  }
  return bag;
}

export function shuffleBuzzleTiles(
  tiles: ReadonlyArray<BuzzleTile>,
  random: () => number = Math.random,
): BuzzleTile[] {
  const shuffled = [...tiles];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

function drawTiles(bag: BuzzleTile[], count: number): BuzzleTile[] {
  return bag.splice(Math.max(0, bag.length - count), count);
}

export function createBuzzleGame(
  playerCount = 2,
  random: () => number = Math.random,
): BuzzleGameState {
  if (!Number.isSafeInteger(playerCount) || playerCount < 2 || playerCount > 4) {
    throw new RangeError("BUZZLE supports two through four players.");
  }
  const bag = shuffleBuzzleTiles(createBuzzleTileBag(), random);
  const players = Array.from({ length: playerCount }, () => ({
    rack: drawTiles(bag, BUZZLE_RACK_SIZE),
    score: 0,
  }));
  return {
    board: Array.from({ length: BUZZLE_CELL_COUNT }, () => null),
    bag,
    players,
    currentPlayer: 0,
    turn: 1,
    consecutivePasses: 0,
    finished: false,
    winner: null,
  };
}

function normalizePlacedTile(placement: BuzzlePlacement, playedBy: number): BuzzleBoardTile {
  const assigned = placement.assignedLetter?.trim().toUpperCase();
  if (placement.tile.blank) {
    if (!assigned || !/^[A-Z]$/u.test(assigned)) {
      throw new Error("Choose a letter for every blank tile.");
    }
    return { ...placement.tile, letter: assigned, points: 0, playedBy };
  }
  if (assigned && assigned !== placement.tile.letter) {
    throw new Error("Only blank tiles can change their letter.");
  }
  return { ...placement.tile, playedBy };
}

function axisForPlacements(placements: ReadonlyArray<BuzzlePlacement>): number {
  if (placements.length === 1) return 0;
  const coordinates = placements.map(({ index }) => getBuzzleCoordinate(index));
  const candidates = [
    coordinates.every(({ r }) => r === coordinates[0].r),
    coordinates.every(({ q }) => q === coordinates[0].q),
    coordinates.every(({ q, r }) => q + r === coordinates[0].q + coordinates[0].r),
  ];
  const axis = candidates.findIndex(Boolean);
  if (axis < 0) throw new Error("Place every new tile in one straight hex line.");
  return axis;
}

function occupiedTile(
  board: BuzzleBoard,
  placementMap: ReadonlyMap<number, BuzzleBoardTile>,
  index: number,
): BuzzleBoardTile | null {
  return placementMap.get(index) ?? board[index] ?? null;
}

function collectWord(
  board: BuzzleBoard,
  placementMap: ReadonlyMap<number, BuzzleBoardTile>,
  originIndex: number,
  axis: number,
): { indices: number[]; tiles: BuzzleBoardTile[] } {
  const direction = HEX_WORD_AXES[axis];
  let cursor = getBuzzleCoordinate(originIndex);
  while (true) {
    const previous = addAxial(cursor, negateAxial(direction));
    const previousIndex = getBuzzleCellIndex(previous.q, previous.r);
    if (previousIndex === null || !occupiedTile(board, placementMap, previousIndex)) break;
    cursor = previous;
  }
  const indices: number[] = [];
  const tiles: BuzzleBoardTile[] = [];
  while (true) {
    const index = getBuzzleCellIndex(cursor.q, cursor.r);
    if (index === null) break;
    const tile = occupiedTile(board, placementMap, index);
    if (!tile) break;
    indices.push(index);
    tiles.push(tile);
    cursor = addAxial(cursor, direction);
  }
  return { indices, tiles };
}

function scoreWord(
  word: { indices: number[]; tiles: BuzzleBoardTile[] },
  placementIndices: ReadonlySet<number>,
): number {
  let letters = 0;
  let wordMultiplier = 1;
  word.indices.forEach((index, offset) => {
    const tile = word.tiles[offset];
    const multiplier = placementIndices.has(index) ? getBuzzleMultiplier(index) : "plain";
    const letterMultiplier = multiplier === "DL" ? 2 : multiplier === "TL" ? 3 : 1;
    letters += tile.points * letterMultiplier;
    if (multiplier === "DW" || multiplier === "star") wordMultiplier *= 2;
    if (multiplier === "TW") wordMultiplier *= 3;
  });
  return letters * wordMultiplier;
}

export function analyzeBuzzlePlay(
  board: BuzzleBoard,
  placements: ReadonlyArray<BuzzlePlacement>,
  dictionary: ReadonlySet<string>,
  playedBy = 0,
): BuzzlePlayAnalysis {
  if (placements.length < 1 || placements.length > BUZZLE_RACK_SIZE) {
    throw new Error("Place between one and seven tiles.");
  }
  const placementMap = new Map<number, BuzzleBoardTile>();
  for (const placement of placements) {
    if (!Number.isSafeInteger(placement.index) || placement.index < 0 || placement.index >= BUZZLE_CELL_COUNT) {
      throw new Error("A tile is outside the BUZZLE board.");
    }
    if (board[placement.index] || placementMap.has(placement.index)) {
      throw new Error("Each new tile needs an empty board cell.");
    }
    placementMap.set(placement.index, normalizePlacedTile(placement, playedBy));
  }
  let axis = axisForPlacements(placements);
  const placementIndices = new Set(placementMap.keys());
  const boardIsEmpty = board.every((tile) => tile === null);
  const center = getBuzzleCellIndex(0, 0)!;
  if (boardIsEmpty && !placementIndices.has(center)) {
    throw new Error("The opening word must cover the center star.");
  }
  if (!boardIsEmpty) {
    const connected = placements.some(({ index }) => {
      const coordinate = getBuzzleCoordinate(index);
      return HEX_DIRECTIONS.some((direction) => {
        const neighbor = addAxial(coordinate, direction);
        const neighborIndex = getBuzzleCellIndex(neighbor.q, neighbor.r);
        return neighborIndex !== null && board[neighborIndex] !== null;
      });
    });
    if (!connected) throw new Error("The new word must connect to the hive.");
  }

  if (placements.length === 1) {
    axis = HEX_WORD_AXES.map((_, candidate) =>
      collectWord(board, placementMap, placements[0].index, candidate),
    ).reduce(
      (best, word, candidate) =>
        word.indices.length > best.length ? { axis: candidate, length: word.indices.length } : best,
      { axis: 0, length: 0 },
    ).axis;
  }
  const mainWord = collectWord(board, placementMap, placements[0].index, axis);
  if (placements.some(({ index }) => !mainWord.indices.includes(index))) {
    throw new Error("Words cannot contain empty gaps.");
  }
  if (mainWord.indices.length < 2) throw new Error("A play must form a word of at least two letters.");

  const words = new Map<string, BuzzleScoredWord>();
  for (const placement of placements) {
    for (let wordAxis = 0; wordAxis < HEX_WORD_AXES.length; wordAxis += 1) {
      const word = collectWord(board, placementMap, placement.index, wordAxis);
      if (word.indices.length < 2) continue;
      const key = word.indices.join(",");
      if (words.has(key)) continue;
      const text = word.tiles.map((tile) => tile.letter).join("");
      if (!dictionary.has(text.toLowerCase())) {
        throw new Error(`${text} is not in the selected dictionary.`);
      }
      words.set(key, {
        word: text,
        score: scoreWord(word, placementIndices),
        indices: word.indices,
      });
    }
  }
  if (words.size === 0) throw new Error("The play does not form a complete word.");
  const hiveFlush = placements.length === BUZZLE_RACK_SIZE;
  return {
    score: [...words.values()].reduce((total, word) => total + word.score, hiveFlush ? 50 : 0),
    words: [...words.values()],
    axis,
    hiveFlush,
  };
}

function finishBuzzleGame(state: BuzzleGameState, playerWhoWentOut: number | null): BuzzleGameState {
  const players = state.players.map((player) => ({ ...player, rack: [...player.rack] }));
  let award = 0;
  players.forEach((player, index) => {
    const penalty = player.rack.reduce((total, tile) => total + tile.points, 0);
    player.score -= penalty;
    if (playerWhoWentOut !== null && index !== playerWhoWentOut) award += penalty;
  });
  if (playerWhoWentOut !== null) players[playerWhoWentOut].score += award;
  const highScore = Math.max(...players.map((player) => player.score));
  const leaders = players.flatMap((player, index) => player.score === highScore ? [index] : []);
  return { ...state, players, finished: true, winner: leaders.length === 1 ? leaders[0] : "draw" };
}

export function playBuzzleTiles(
  state: BuzzleGameState,
  placements: ReadonlyArray<BuzzlePlacement>,
  dictionary: ReadonlySet<string>,
): { state: BuzzleGameState; analysis: BuzzlePlayAnalysis } {
  if (state.finished) throw new Error("This BUZZLE game is finished.");
  const player = state.players[state.currentPlayer];
  const rackIds = new Set(player.rack.map((tile) => tile.id));
  if (placements.some(({ tile }) => !rackIds.has(tile.id)) || new Set(placements.map(({ tile }) => tile.id)).size !== placements.length) {
    throw new Error("Every placed tile must come from the active rack.");
  }
  const analysis = analyzeBuzzlePlay(state.board, placements, dictionary, state.currentPlayer);
  const board = [...state.board];
  for (const placement of placements) {
    board[placement.index] = normalizePlacedTile(placement, state.currentPlayer);
  }
  const bag = [...state.bag];
  const players = state.players.map((entry) => ({ ...entry, rack: [...entry.rack] }));
  const usedIds = new Set(placements.map(({ tile }) => tile.id));
  players[state.currentPlayer].rack = player.rack.filter((tile) => !usedIds.has(tile.id));
  players[state.currentPlayer].score += analysis.score;
  players[state.currentPlayer].rack.push(
    ...drawTiles(bag, BUZZLE_RACK_SIZE - players[state.currentPlayer].rack.length),
  );
  let next: BuzzleGameState = {
    ...state,
    board,
    bag,
    players,
    currentPlayer: (state.currentPlayer + 1) % state.players.length,
    turn: state.turn + 1,
    consecutivePasses: 0,
  };
  if (bag.length === 0 && players[state.currentPlayer].rack.length === 0) {
    next = finishBuzzleGame(next, state.currentPlayer);
  }
  return { state: next, analysis };
}

export function passBuzzleTurn(state: BuzzleGameState): BuzzleGameState {
  if (state.finished) throw new Error("This BUZZLE game is finished.");
  const passes = state.consecutivePasses + 1;
  const next = {
    ...state,
    currentPlayer: (state.currentPlayer + 1) % state.players.length,
    turn: state.turn + 1,
    consecutivePasses: passes,
  };
  return passes >= state.players.length * 3 ? finishBuzzleGame(next, null) : next;
}

export function exchangeBuzzleTiles(
  state: BuzzleGameState,
  tileIds: ReadonlyArray<string>,
  random: () => number = Math.random,
): BuzzleGameState {
  if (state.finished) throw new Error("This BUZZLE game is finished.");
  if (tileIds.length < 1 || tileIds.length > BUZZLE_RACK_SIZE || state.bag.length < tileIds.length) {
    throw new Error("Choose available rack tiles that the bag can replace.");
  }
  const selected = new Set(tileIds);
  if (selected.size !== tileIds.length) throw new Error("Choose each tile once.");
  const players = state.players.map((entry) => ({ ...entry, rack: [...entry.rack] }));
  const player = players[state.currentPlayer];
  const returned = player.rack.filter((tile) => selected.has(tile.id));
  if (returned.length !== tileIds.length) throw new Error("Exchange only tiles from the active rack.");
  const bag = [...state.bag];
  player.rack = player.rack.filter((tile) => !selected.has(tile.id));
  player.rack.push(...drawTiles(bag, returned.length));
  bag.unshift(...returned);
  return {
    ...state,
    bag: shuffleBuzzleTiles(bag, random),
    players,
    currentPlayer: (state.currentPlayer + 1) % players.length,
    turn: state.turn + 1,
    consecutivePasses: 0,
  };
}
